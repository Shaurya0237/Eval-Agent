/** STEP 2 · PLAN: list every task × config × trial run and estimate cost. */
import type { DefinitionsSnapshot, PlanFile, PlannedRun } from '@eval-lab/shared';

/** Rough per-run token usage, used only for the cost estimate. */
export const ESTIMATE_INPUT_TOKENS_PER_RUN = 40_000;
export const ESTIMATE_OUTPUT_TOKENS_PER_RUN = 1_500;

export function runIdFor(taskId: string, configId: string, trial: number): string {
  return `${taskId}__${configId}__t${trial}`;
}

/** Plan runs ordered trial → task → config, so configs interleave over time. */
export function planRuns(snapshot: DefinitionsSnapshot, trials: number): PlanFile {
  const runs: PlannedRun[] = [];
  for (let trial = 1; trial <= trials; trial++) {
    for (const task of snapshot.suite.tasks) {
      for (const config of snapshot.configs) {
        runs.push({ runId: runIdFor(task.id, config.id, trial), taskId: task.id, configId: config.id, trial });
      }
    }
  }

  const perRunCost = new Map(
    snapshot.configs.map((c) => [
      c.id,
      (ESTIMATE_INPUT_TOKENS_PER_RUN * c.price.inputPerMTok + ESTIMATE_OUTPUT_TOKENS_PER_RUN * c.price.outputPerMTok) / 1_000_000,
    ]),
  );
  const estimatedCostUsd = runs.reduce((sum, r) => sum + (perRunCost.get(r.configId) ?? 0), 0);

  return { runs, estimatedCostUsd };
}
