/**
 * STEP 6 · COMPARE: bootstrap score/cost/duration verdicts vs baseline,
 * plus per-task diffs, reliability (pass^k, flaky) and a trials-to-resolve estimate.
 */
import type {
  ComparedMetric,
  ConfigComparison,
  ConfigSummary,
  DefinitionsSnapshot,
  MetricComparison,
  Report,
  RunScore,
  TaskDiff,
  TaskRow,
} from '@eval-lab/shared';
import {
  DEFAULT_BOOTSTRAP,
  pairedBootstrap,
  verdictFromInterval,
  type BootstrapOptions,
  type PairedTask,
} from '../../domain/statistics/bootstrap';

type MetricOf = (s: RunScore) => number;

const METRICS: { metric: ComparedMetric; of: MetricOf; higherIsBetter: boolean }[] = [
  { metric: 'score', of: (s) => s.score, higherIsBetter: true },
  { metric: 'costUsd', of: (s) => s.metrics.costUsd, higherIsBetter: false },
  { metric: 'durationMs', of: (s) => s.metrics.durationMs, higherIsBetter: false },
];

/** Per-task score changes smaller than this count as "unchanged". */
const CHANGE_EPSILON = 1e-6;

/** Cap for the suggested trials per task. */
const MAX_SUGGESTED_TRIALS = 30;

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Collect per-task trial values for the baseline and one candidate. */
function pairByTask(scores: RunScore[], taskIds: string[], baselineId: string, candidateId: string, of: MetricOf): PairedTask[] {
  return taskIds.map((taskId) => ({
    baseline: scores.filter((s) => s.taskId === taskId && s.configId === baselineId).map(of),
    candidate: scores.filter((s) => s.taskId === taskId && s.configId === candidateId).map(of),
  }));
}

/** Rough trials per task to resolve an inconclusive result: n × (halfWidth / |Δ|)². */
export function estimateTrialsToResolve(delta: number, ciLow: number, ciHigh: number, trials: number): number | null {
  if (Math.abs(delta) < CHANGE_EPSILON || trials < 1) return null;
  const halfWidth = (ciHigh - ciLow) / 2;
  const needed = Math.ceil(trials * (halfWidth / Math.abs(delta)) ** 2);
  if (needed <= trials) return trials + 1;
  return needed <= MAX_SUGGESTED_TRIALS ? needed : null;
}

/** Build the step 6 report from all run scores. */
export function buildReport(
  experimentId: string,
  snapshot: DefinitionsSnapshot,
  baselineConfigId: string,
  scores: RunScore[],
  options: BootstrapOptions = DEFAULT_BOOTSTRAP,
): Report {
  const taskIds = snapshot.suite.tasks.map((t) => t.id);
  const configIds = snapshot.configs.map((c) => c.id);
  const trials = Math.max(1, ...scores.map((s) => s.trial));
  const runsOf = (taskId: string, configId: string) =>
    scores.filter((s) => s.taskId === taskId && s.configId === configId).sort((a, b) => a.trial - b.trial);

  // ── Per-task cells ──
  const tasks: TaskRow[] = taskIds.map((taskId) => ({
    taskId,
    cells: configIds.map((configId) => {
      const own = runsOf(taskId, configId);
      const passed = own.filter((s) => s.passed).length;
      return {
        configId,
        meanScore: mean(own.map((s) => s.score)),
        passRate: own.length ? passed / own.length : 0,
        passAll: own.length > 0 && passed === own.length,
        flaky: passed > 0 && passed < own.length,
        brokenRuns: own.filter((s) => s.runStatus !== 'done').length,
        runs: own.map((s) => ({ runId: s.runId, trial: s.trial, score: s.score, passed: s.passed, runStatus: s.runStatus })),
      };
    }),
  }));
  const cellsOf = (configId: string) => tasks.map((t) => t.cells.find((c) => c.configId === configId)!);

  // ── Per-config summary ──
  const configs: ConfigSummary[] = configIds.map((configId) => {
    const own = scores.filter((s) => s.configId === configId);
    const cells = cellsOf(configId);
    return {
      configId,
      meanScore: mean(own.map((s) => s.score)),
      passRate: mean(own.map((s) => (s.passed ? 1 : 0))),
      passAllRate: mean(cells.map((c) => (c.passAll ? 1 : 0))),
      flakyTasks: cells.filter((c) => c.flaky).length,
      meanCostUsd: mean(own.map((s) => s.metrics.costUsd)),
      meanDurationMs: mean(own.map((s) => s.metrics.durationMs)),
      runs: own.length,
      brokenRuns: own.filter((s) => s.runStatus !== 'done').length,
    };
  });

  // ── Candidate vs baseline ──
  const comparisons: ConfigComparison[] = configIds
    .filter((id) => id !== baselineConfigId)
    .map((configId) => {
      const [score, costUsd, durationMs] = METRICS.map(({ metric, of, higherIsBetter }): MetricComparison => {
        const r = pairedBootstrap(pairByTask(scores, taskIds, baselineConfigId, configId, of), options);
        return { metric, ...r, verdict: verdictFromInterval(r.ciLow, r.ciHigh, higherIsBetter) };
      });

      const taskDiffs: TaskDiff[] = tasks.map((t) => {
        const baselineMean = t.cells.find((c) => c.configId === baselineConfigId)!.meanScore;
        const candidateMean = t.cells.find((c) => c.configId === configId)!.meanScore;
        const delta = candidateMean - baselineMean;
        const change = delta > CHANGE_EPSILON ? 'improved' : delta < -CHANGE_EPSILON ? 'regressed' : 'unchanged';
        return { taskId: t.taskId, baselineMean, candidateMean, delta, change };
      });

      return {
        configId,
        score,
        costUsd,
        durationMs,
        improved: taskDiffs.filter((d) => d.change === 'improved').length,
        regressed: taskDiffs.filter((d) => d.change === 'regressed').length,
        unchanged: taskDiffs.filter((d) => d.change === 'unchanged').length,
        taskDiffs,
        trialsToResolve: score.verdict === 'inconclusive' ? estimateTrialsToResolve(score.delta, score.ciLow, score.ciHigh, trials) : null,
      };
    });

  return { experimentId, baselineConfigId, configs, comparisons, tasks, method: options };
}
