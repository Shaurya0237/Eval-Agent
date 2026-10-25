import { describe, expect, it } from 'vitest';
import type { ExperimentStatusFile } from '@eval-lab/shared';
import { overviewStats, progressOf } from './experiments.logic';

const exp = (p: Partial<ExperimentStatusFile>) =>
  ({ status: 'completed', agent: 'hermes', runsFinished: 0, runsTotal: 0, spentUsd: 0, ...p }) as ExperimentStatusFile;

describe('experiments logic', () => {
  it('computes progress', () => expect(progressOf(exp({ runsFinished: 3, runsTotal: 12 }))).toBe(0.25));
  it('counts real spend only', () => {
    const stats = overviewStats([
      exp({ spentUsd: 1.5, runsFinished: 10 }),
      exp({ agent: 'simulated', spentUsd: 9, status: 'running', runsFinished: 4 }),
    ]);
    expect(stats).toEqual({ experiments: 2, running: 1, runsExecuted: 14, spentUsd: 1.5 });
  });
});
