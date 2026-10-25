/** Experiment list logic: progress and overview stats. */
import type { ExperimentStatusFile } from '@eval-lab/shared';

export const progressOf = (s: ExperimentStatusFile): number => (s.runsTotal ? s.runsFinished / s.runsTotal : 0);

export interface OverviewStats {
  experiments: number;
  running: number;
  runsExecuted: number;
  /** Real spend only; simulated runs cost nothing. */
  spentUsd: number;
}

export function overviewStats(list: ExperimentStatusFile[]): OverviewStats {
  return {
    experiments: list.length,
    running: list.filter((e) => e.status === 'running').length,
    runsExecuted: list.reduce((n, e) => n + e.runsFinished, 0),
    spentUsd: list.filter((e) => e.agent !== 'simulated').reduce((n, e) => n + e.spentUsd, 0),
  };
}
