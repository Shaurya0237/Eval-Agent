import { describe, expect, it } from 'vitest';
import type { ExperimentStatusFile, Report } from '@eval-lab/shared';
import { deltaBar, diffRows, filterCounts, stepStates } from './experimentDetail.logic';

const status = (patch: Partial<ExperimentStatusFile>) => ({ status: 'running', currentStep: 'execute', ...patch }) as ExperimentStatusFile;

describe('stepStates', () => {
  it('marks earlier stages done and the per-run stage active while executing', () => {
    expect(stepStates(status({})).map((s) => s.state)).toEqual(['done', 'done', 'active', 'waiting']);
  });
  it('marks everything done when completed, and the current stage failed on failure', () => {
    expect(stepStates(status({ status: 'completed', currentStep: null })).every((s) => s.state === 'done')).toBe(true);
    expect(stepStates(status({ status: 'failed', currentStep: 'compare' }))[3].state).toBe('failed');
  });
});

const cell = (configId: string, flaky = false, brokenRuns = 0) => ({
  configId,
  meanScore: 0,
  passRate: 0,
  passAll: false,
  flaky,
  brokenRuns,
  runs: [],
});
const report = {
  baselineConfigId: 'base',
  comparisons: [
    {
      configId: 'cand',
      taskDiffs: [
        { taskId: 'a', baselineMean: 0, candidateMean: 1, delta: 1, change: 'improved' },
        { taskId: 'b', baselineMean: 1, candidateMean: 0, delta: -1, change: 'regressed' },
        { taskId: 'c', baselineMean: 1, candidateMean: 1, delta: 0, change: 'unchanged' },
      ],
    },
  ],
  tasks: [
    { taskId: 'a', cells: [cell('base'), cell('cand', true)] },
    { taskId: 'b', cells: [cell('base'), cell('cand')] },
    { taskId: 'c', cells: [cell('base', false, 1), cell('cand')] },
  ],
} as unknown as Report;

describe('diffRows', () => {
  it('sorts most-regressed first', () => {
    expect(diffRows(report, 'cand', 'all').map((r) => r.diff.taskId)).toEqual(['b', 'c', 'a']);
  });
  it('filters by change, flakiness and broken runs', () => {
    expect(filterCounts(report, 'cand')).toEqual({ all: 3, regressed: 1, improved: 1, unchanged: 1, flaky: 1, broken: 1 });
  });
});

describe('deltaBar', () => {
  it('grows right from the centre for gains and left for losses', () => {
    expect(deltaBar(0.5)).toEqual({ left: '50%', width: '25%' });
    expect(deltaBar(-0.5)).toEqual({ left: '25%', width: '25%' });
  });
});
