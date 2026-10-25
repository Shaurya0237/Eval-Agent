import { describe, expect, it } from 'vitest';
import type { ExperimentStatusFile, PlanFile, RunScore } from '@eval-lab/shared';
import { toExperimentDetail } from './experiment.view';
import { toExportFile } from './export.view';

const score = (runId: string, runStatus: RunScore['runStatus'] = 'done'): RunScore => ({
  runId,
  taskId: 't',
  configId: 'c',
  trial: 1,
  runStatus,
  score: 1,
  passed: true,
  outcomeChecks: [],
  processFlags: [{ id: 'read_inputs', ok: false, explanation: '' }],
  metrics: { costUsd: 0.01, durationMs: 1000, apiCalls: 2, inputTokens: 10, outputTokens: 5 },
});

describe('toExperimentDetail', () => {
  it('derives each run status from its score and the in-flight set', () => {
    const plan: PlanFile = {
      estimatedCostUsd: 0,
      runs: ['a', 'b', 'c'].map((runId) => ({ runId, taskId: 't', configId: 'c', trial: 1 })),
    };
    const detail = toExperimentDetail(
      { id: 'x' } as ExperimentStatusFile,
      plan,
      (id) => (id === 'a' ? score('a', 'timeout') : null),
      (id) => id === 'b',
      false,
    );
    expect(detail.runs.map((r) => r.status)).toEqual(['timeout', 'running', 'pending']);
  });
});

describe('toExportFile', () => {
  it('writes CSV with a header row and quotes cells that need it', () => {
    const file = toExportFile('exp,1', 'hermes', [score('r1')], 'csv');
    const [header, row] = file.body.trim().split('\n');
    expect(header.split(',')[0]).toBe('experimentId');
    expect(row.startsWith('"exp,1",hermes,r1,')).toBe(true);
    expect(row).toContain('read_inputs');
    expect(file.contentType).toContain('text/csv');
  });

  it('writes JSON rows', () => {
    const rows = JSON.parse(toExportFile('e', 'simulated', [score('r1')], 'json').body);
    expect(rows[0]).toMatchObject({ runId: 'r1', agent: 'simulated', costUsd: 0.01 });
  });
});
