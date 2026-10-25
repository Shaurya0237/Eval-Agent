/**
 * STEP 5 · SCORE: outcome (the score), efficiency (metrics), process (warnings only).
 * Broken runs score 0 but keep their status.
 */
import { readdirSync } from 'node:fs';
import type { AgentConfig, RunResult, RunScore, Task, TrajectoryStep } from '@eval-lab/shared';
import { runOutcomeCheck } from '../../domain/scoring/outcome-checks';
import { runProcessCheck } from '../../domain/scoring/process-checks';
import { fixtureDir } from './1-load';

export interface ScoreInput {
  suiteId: string;
  task: Task;
  config: AgentConfig;
  trial: number;
  result: RunResult;
  trajectory: TrajectoryStep[];
}

/** Score one finished run; file checks read `workspaceDir`. */
export async function scoreRun(input: ScoreInput, workspaceDir: string): Promise<RunScore> {
  const { task, config, result, trajectory } = input;

  // Outcome: only checked when the run finished.
  const outcomeChecks =
    result.status === 'done'
      ? await Promise.all(task.checks.map((c, i) => runOutcomeCheck(c, i, { finalAnswer: result.finalAnswer, workspaceDir })))
      : task.checks.map((c, i) => ({
          id: c.id ?? `${c.type}-${i + 1}`,
          type: c.type,
          score: 0,
          passed: false,
          explanation: `Not checked: run ${result.status} (${result.error ?? 'no details'}).`,
        }));
  const score = outcomeChecks.reduce((s, c) => s + c.score, 0) / outcomeChecks.length;

  // Process: diagnostics from the trajectory.
  const fixtureFiles = readdirSync(fixtureDir(input.suiteId, task.fixtures));
  const processFlags = task.processChecks.map((id) =>
    runProcessCheck(id, { trajectory, result, fixtureFiles, skills: config.skills, maxTurns: config.maxTurns }),
  );

  const runScore: RunScore = {
    runId: result.runId,
    taskId: task.id,
    configId: config.id,
    trial: input.trial,
    runStatus: result.status,
    score,
    passed: result.status === 'done' && score >= task.passThreshold,
    outcomeChecks,
    // Efficiency: copied from the run result.
    metrics: {
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      apiCalls: result.apiCalls,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
    processFlags,
  };

  return runScore;
}
