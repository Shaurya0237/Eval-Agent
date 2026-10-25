/**
 * SERVICE · Runs steps 1–6 for an experiment and tracks progress.
 * Steps 3–5 run per run, EVAL_CONCURRENCY (default 2) at a time.
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import type {
  AgentKind,
  CreateExperimentRequest,
  DefinitionsSnapshot,
  ExperimentStatusFile,
  PlanFile,
  PlannedRun,
  RunScore,
  TrajectoryStep,
} from '@eval-lab/shared';
import { API_KEY_ENV } from '../config/model-provider';
import { paths } from '../config/paths';
import { DefinitionsRepository } from '../models/definitions.repository';
import { ExperimentRepository } from '../models/experiment.repository';
import { EventsService } from './events.service';
import { planRuns } from '../pipeline/steps/2-plan';
import { prepareRun } from '../pipeline/steps/3-prepare';
import { executeRun, type ExecuteContext } from '../pipeline/steps/4-execute';
import { scoreRun } from '../pipeline/steps/5-score';
import { buildReport } from '../pipeline/steps/6-compare';

/** Agent binary and credentials; defaults to the pinned Hermes. */
export interface AgentOptions {
  hermesBin?: string;
  apiKey?: string;
  agent?: AgentKind;
  /** Retry number; varies the simulated agent's randomness. */
  attempt?: number;
}

type SaveStatus = (patch: Partial<ExperimentStatusFile>) => Promise<void>;

/** Run `worker` over `items` with at most `limit` in flight. */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(lanes);
}

/** Timestamp-based experiment id with a random suffix. */
const newExperimentId = (): string => `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${randomBytes(2).toString('hex')}`;

@Injectable()
export class PipelineRunner {
  private readonly logger = new Logger(PipelineRunner.name);
  /** Run ids executing now, per experiment. */
  private readonly inFlight = new Map<string, Set<string>>();
  /** Promise per running experiment, for `waitFor`. */
  private readonly active = new Map<string, Promise<void>>();

  constructor(
    private readonly experiments: ExperimentRepository,
    private readonly definitions: DefinitionsRepository,
    private readonly events: EventsService,
  ) {}

  // ── Public API ──

  /** Save the initial status and run steps 1–6 in the background. */
  async start(req: CreateExperimentRequest, opts: AgentOptions = {}): Promise<ExperimentStatusFile> {
    const ctx = this.agentContext(opts);
    const status: ExperimentStatusFile = {
      id: newExperimentId(),
      name: req.name?.trim() || `${req.suiteId}: ${req.configIds.join(' vs ')}`,
      suiteId: req.suiteId,
      configIds: req.configIds,
      baselineConfigId: req.baselineConfigId ?? req.configIds[0],
      trials: req.trials,
      agent: opts.agent ?? 'hermes',
      status: 'running',
      currentStep: 'load',
      runsTotal: 0,
      runsFinished: 0,
      estimatedCostUsd: 0,
      spentUsd: 0,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      retries: 0,
    };
    await this.persistStatus(status);
    this.launch(status, () => this.runAll(status, ctx));
    return status;
  }

  /** Re-run timed-out/errored/unfinished runs, then re-score and re-compare. */
  async retryBroken(experimentId: string, opts: AgentOptions = {}): Promise<ExperimentStatusFile> {
    const status = await this.experiments.findStatus(experimentId);
    if (!status) throw new Error(`Experiment "${experimentId}" not found`);
    if (status.status === 'running') throw new Error('Experiment is still running.');
    const [plan, snapshot] = await Promise.all([this.experiments.findPlan(experimentId), this.experiments.findSnapshot(experimentId)]);
    if (!plan || !snapshot) throw new Error('This experiment never got past planning; start a new one instead.');

    // Broken = timeout/error, or never finished.
    const broken: PlannedRun[] = [];
    for (const run of plan.runs) {
      const score = await this.experiments.findRunScore(experimentId, run.runId);
      if (!score || score.runStatus !== 'done') broken.push(run);
    }
    if (broken.length === 0) throw new Error('No broken runs to retry.');

    // Keep simulated experiments simulated.
    const ctx = this.agentContext({ ...opts, agent: status.agent === 'simulated' ? 'simulated' : opts.agent, attempt: status.retries + 1 });
    Object.assign(status, {
      status: 'running',
      currentStep: 'execute',
      runsFinished: plan.runs.length - broken.length,
      error: null,
      finishedAt: null,
      retries: status.retries + 1,
    } satisfies Partial<ExperimentStatusFile>);
    await this.persistStatus(status);

    this.launch(status, async () => {
      const save = this.statusSaver(status);
      for (const run of broken) await this.experiments.deleteRun(status.id, run.runId);
      await this.executeRuns(status, snapshot, broken, ctx, save);
      await this.finish(status, snapshot, plan, save);
    });
    return status;
  }

  /** Wait for the experiment's current pass to finish. */
  async waitFor(experimentId: string): Promise<ExperimentStatusFile> {
    await this.active.get(experimentId);
    const status = await this.experiments.findStatus(experimentId);
    if (!status) throw new Error(`Experiment "${experimentId}" not found`);
    return status;
  }

  /** On startup, mark experiments left "running" as failed. */
  async recoverInterrupted(): Promise<void> {
    for (const status of await this.experiments.listStatuses()) {
      if (status.status !== 'running') continue;
      await this.persistStatus({
        ...status,
        status: 'failed',
        error: 'Interrupted: the server stopped while this experiment was running. Use "Retry broken" to finish it.',
        finishedAt: new Date().toISOString(),
      });
    }
  }

  /** True if the run is executing now. */
  isRunInFlight(experimentId: string, runId: string): boolean {
    return this.inFlight.get(experimentId)?.has(runId) ?? false;
  }

  // ── Pipeline ──

  /** Run steps 1–6. */
  private async runAll(status: ExperimentStatusFile, ctx: ExecuteContext): Promise<void> {
    const save = this.statusSaver(status);

    // Step 1 · Load (validate + freeze)
    const snapshot = await this.definitions.snapshot(status.suiteId, status.configIds);
    await this.experiments.saveSnapshot(status.id, snapshot);

    // Step 2 · Plan
    await save({ currentStep: 'plan' });
    const plan = planRuns(snapshot, status.trials);
    await this.experiments.savePlan(status.id, plan);
    await save({ runsTotal: plan.runs.length, estimatedCostUsd: plan.estimatedCostUsd });

    // Steps 3–5 · per run
    await this.executeRuns(status, snapshot, plan.runs, ctx, save);

    // Step 6 · Compare
    await this.finish(status, snapshot, plan, save);
  }

  /** Run steps 3–5 for each run, with limited concurrency. */
  private async executeRuns(
    status: ExperimentStatusFile,
    snapshot: DefinitionsSnapshot,
    runs: PlannedRun[],
    ctx: ExecuteContext,
    save: SaveStatus,
  ): Promise<void> {
    await save({ currentStep: 'execute' });
    const inFlight = new Set<string>();
    this.inFlight.set(status.id, inFlight);
    const concurrency = Math.max(1, Number(process.env.EVAL_CONCURRENCY) || 2);

    await runWithConcurrency(runs, concurrency, async (planned) => {
      const task = snapshot.suite.tasks.find((t) => t.id === planned.taskId)!;
      const config = snapshot.configs.find((c) => c.id === planned.configId)!;
      const run = this.experiments.runPaths(status.id, planned.runId);
      inFlight.add(planned.runId);
      this.events.publish(status.id, {
        type: 'run-started',
        runId: planned.runId,
        taskId: planned.taskId,
        configId: planned.configId,
        trial: planned.trial,
      });
      const onStep = (step: TrajectoryStep) => this.events.publish(status.id, { type: 'run-step', runId: planned.runId, step });
      try {
        await prepareRun(snapshot, task, config, run); // step 3
        const { result, trajectory } = await executeRun(ctx, task, config, planned.runId, run, onStep); // step 4
        const score = await scoreRun({ suiteId: snapshot.suite.id, task, config, trial: planned.trial, result, trajectory }, run.workspace); // step 5
        await this.experiments.saveRunOutcome(status.id, planned.runId, { result, trajectory, score });
        this.events.publish(status.id, {
          type: 'run-finished',
          runId: planned.runId,
          runStatus: result.status,
          score: score.score,
          passed: score.passed,
        });
        await save({ runsFinished: status.runsFinished + 1, spentUsd: status.spentUsd + result.costUsd });
      } finally {
        inFlight.delete(planned.runId);
      }
    });
    this.inFlight.delete(status.id);
  }

  /** Collect run scores, write the report, and mark completed. */
  private async finish(status: ExperimentStatusFile, snapshot: DefinitionsSnapshot, plan: PlanFile, save: SaveStatus): Promise<void> {
    await save({ currentStep: 'score' });
    const scores: RunScore[] = [];
    for (const run of plan.runs) {
      const score = await this.experiments.findRunScore(status.id, run.runId);
      if (score) scores.push(score);
    }
    await this.experiments.saveScores(status.id, scores);

    await save({ currentStep: 'compare' });
    await this.experiments.saveReport(status.id, buildReport(status.id, snapshot, status.baselineConfigId, scores));

    await save({ status: 'completed', currentStep: null, finishedAt: new Date().toISOString() });
    this.logger.log(`Experiment ${status.id} completed (${scores.length} runs)`);
  }

  // ── Helpers ──

  /** Resolve the agent binary and credentials. */
  private agentContext(opts: AgentOptions): ExecuteContext {
    if (opts.agent === 'simulated') {
      // No model calls; "demo" mode behaves like an imperfect agent.
      return {
        hermesBin: paths.simulatedHermesBin,
        apiKey: 'simulated-no-model-calls',
        extraEnv: { SIMULATED_HERMES_MODE: 'demo', SIMULATED_HERMES_ATTEMPT: String(opts.attempt ?? 0) },
      };
    }
    const apiKey = opts.apiKey ?? process.env[API_KEY_ENV];
    if (!apiKey) throw new Error(`${API_KEY_ENV} is not set. Add it to .env and restart.`);
    const hermesBin = opts.hermesBin ?? paths.hermesBin;
    if (!existsSync(hermesBin)) throw new Error(`Hermes not found at ${hermesBin}. Run "pnpm start" to install it.`);
    return { hermesBin, apiKey, caBundle: process.env.EVAL_CA_BUNDLE || undefined };
  }

  /** Patch the in-memory status and persist it. */
  private statusSaver(status: ExperimentStatusFile): SaveStatus {
    return (patch) => this.persistStatus(Object.assign(status, patch));
  }

  /** Save status.json and push it to live listeners. */
  private async persistStatus(status: ExperimentStatusFile): Promise<void> {
    await this.experiments.saveStatus(status);
    this.events.publish(status.id, { type: 'status', status: { ...status } });
  }

  /** Run work in the background; record failures on the experiment. */
  private launch(status: ExperimentStatusFile, work: () => Promise<void>): void {
    const done = work()
      .catch(async (err: Error) => {
        this.logger.error(`Experiment ${status.id} failed: ${err.message}`);
        await this.persistStatus({ ...status, status: 'failed', error: err.message, finishedAt: new Date().toISOString() });
      })
      .finally(() => this.active.delete(status.id));
    this.active.set(status.id, done);
  }
}
