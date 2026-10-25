import { describe, expect, it } from 'vitest';
import type { AgentConfig, DefinitionsSnapshot, RunScore, Task } from '@eval-lab/shared';
import { buildReport, estimateTrialsToResolve } from './6-compare';

const task = (id: string): Task => ({
  id,
  prompt: '',
  fixtures: '.',
  timeoutSec: 1,
  passThreshold: 1,
  checks: [{ type: 'answer_contains', value: 'x' }],
  processChecks: [],
});
const config = (id: string): AgentConfig => ({
  id,
  description: '',
  model: 'm',
  toolsets: ['file'],
  skills: [],
  memory: null,
  maxTurns: 5,
  price: { inputPerMTok: 0, outputPerMTok: 0 },
});
const snapshot: DefinitionsSnapshot = {
  suite: { id: 's', name: 's', description: '', groups: {}, tasks: ['a', 'b', 'c'].map(task) },
  configs: [config('base'), config('cand')],
  skills: {},
  memories: {},
};
const run = (taskId: string, configId: string, trial: number, score: number, runStatus: RunScore['runStatus'] = 'done'): RunScore => ({
  runId: `${taskId}-${configId}-${trial}`,
  taskId,
  configId,
  trial,
  runStatus,
  score,
  passed: score >= 1,
  outcomeChecks: [],
  processFlags: [],
  metrics: { costUsd: 0.01, durationMs: 1000, apiCalls: 2, inputTokens: 0, outputTokens: 0 },
});

describe('buildReport', () => {
  // a: improved (0 → 1), b: regressed (1 → 0.5, flaky candidate), c: unchanged (1 → 1)
  const scores = [
    run('a', 'base', 1, 0),
    run('a', 'base', 2, 0),
    run('a', 'cand', 1, 1),
    run('a', 'cand', 2, 1),
    run('b', 'base', 1, 1),
    run('b', 'base', 2, 1),
    run('b', 'cand', 1, 1),
    run('b', 'cand', 2, 0, 'error'),
    run('c', 'base', 1, 1),
    run('c', 'base', 2, 1),
    run('c', 'cand', 1, 1),
    run('c', 'cand', 2, 1),
  ];
  const report = buildReport('x', snapshot, 'base', scores, { iterations: 1000, confidence: 0.95, seed: 1 });

  it('counts improved / regressed / unchanged tasks', () => {
    const c = report.comparisons[0];
    expect([c.improved, c.regressed, c.unchanged]).toEqual([1, 1, 1]);
    expect(c.taskDiffs.find((d) => d.taskId === 'b')).toMatchObject({ change: 'regressed', delta: -0.5 });
  });

  it('measures reliability: pass^k, flaky tasks and broken runs', () => {
    const cand = report.configs.find((c) => c.configId === 'cand')!;
    expect(cand.passAllRate).toBeCloseTo(2 / 3); // a and c passed every trial
    expect(cand.flakyTasks).toBe(1); // b: one pass, one fail
    expect(cand.brokenRuns).toBe(1);
    const cellB = report.tasks.find((t) => t.taskId === 'b')!.cells.find((c) => c.configId === 'cand')!;
    expect(cellB).toMatchObject({ flaky: true, passAll: false, brokenRuns: 1, passRate: 0.5 });
  });
});

describe('estimateTrialsToResolve', () => {
  it('scales trials by (half-width / |Δ|)²', () => {
    // half-width 0.2, Δ 0.1 → 4× the trials
    expect(estimateTrialsToResolve(0.1, -0.1, 0.3, 3)).toBe(12);
  });
  it('returns null when there is no difference or it would take too many trials', () => {
    expect(estimateTrialsToResolve(0, -0.1, 0.1, 3)).toBeNull();
    expect(estimateTrialsToResolve(0.01, -0.3, 0.32, 3)).toBeNull();
  });
});
