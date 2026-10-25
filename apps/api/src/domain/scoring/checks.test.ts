import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RunResult, TrajectoryStep } from '@eval-lab/shared';
import { runOutcomeCheck } from './outcome-checks';
import { runProcessCheck } from './process-checks';

const workspace = mkdtempSync(join(tmpdir(), 'eval-checks-'));

describe('outcome checks', () => {
  it('answer_contains', async () => {
    const r = await runOutcomeCheck({ type: 'answer_contains', value: 'EMEA' }, 0, {
      finalAnswer: 'It was emea.',
      workspaceDir: workspace,
    });
    expect(r).toMatchObject({ id: 'answer_contains-1', score: 1, passed: true });
  });

  it('answer_json gives partial credit per field', async () => {
    const r = await runOutcomeCheck({ type: 'answer_json', expect: { region: 'EMEA', dropPct: 12.39 }, tolerance: 0.1 }, 0, {
      finalAnswer: '{"region": "APAC", "dropPct": 12.4}',
      workspaceDir: workspace,
    });
    expect(r.score).toBe(0.5);
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain('expected "EMEA"');
  });

  it('answer_json explains a missing JSON object', async () => {
    const r = await runOutcomeCheck({ type: 'answer_json', expect: { a: 1 } }, 0, { finalAnswer: 'I think 1', workspaceDir: workspace });
    expect(r).toMatchObject({ score: 0, explanation: 'No JSON object found in the final answer.' });
  });

  it('file_json reads the workspace and refuses paths outside it', async () => {
    writeFileSync(join(workspace, 'report.json'), JSON.stringify({ total: 412, extra: 1 }));
    const ok = await runOutcomeCheck({ type: 'file_json', path: 'report.json', expect: { total: 412 } }, 0, {
      finalAnswer: '',
      workspaceDir: workspace,
    });
    expect(ok.score).toBe(1);
    const missing = await runOutcomeCheck({ type: 'file_json', path: 'nope.json', expect: {} }, 0, {
      finalAnswer: '',
      workspaceDir: workspace,
    });
    expect(missing.explanation).toContain('was not created');
    const escape = await runOutcomeCheck({ type: 'file_json', path: '../../etc/passwd', expect: {} }, 0, {
      finalAnswer: '',
      workspaceDir: workspace,
    });
    expect(escape.explanation).toContain('outside the workspace');
  });
});

describe('process checks', () => {
  const step = (s: Partial<TrajectoryStep>): TrajectoryStep => ({
    seq: 0,
    role: 'assistant',
    content: '',
    toolCalls: [],
    toolName: null,
    toolCallId: null,
    reasoning: null,
    timestamp: 0,
    ...s,
  });
  const result = { apiCalls: 3 } as RunResult;
  const base = { result, fixtureFiles: ['bns-2023.txt'], skills: [] as string[], maxTurns: 20 };

  it('read_inputs flags answers given without touching the input files', () => {
    const touched = [step({ toolCalls: [{ id: '1', name: 'read_file', arguments: '{"path":"bns-2023.txt"}' }] })];
    expect(runProcessCheck('read_inputs', { ...base, trajectory: touched }).ok).toBe(true);
    expect(runProcessCheck('read_inputs', { ...base, trajectory: [] }).ok).toBe(false);
  });

  it('used_skill checks that an installed skill was actually loaded', () => {
    const viewed = [step({ toolCalls: [{ id: '1', name: 'skill_view', arguments: '{"name":"ipc-bns-mapping"}' }] })];
    expect(runProcessCheck('used_skill', { ...base, skills: ['ipc-bns-mapping'], trajectory: viewed }).ok).toBe(true);
    expect(runProcessCheck('used_skill', { ...base, skills: ['ipc-bns-mapping'], trajectory: [] }).ok).toBe(false);
    expect(runProcessCheck('used_skill', { ...base, trajectory: [] }).ok).toBe(true);
  });

  it('tool_errors counts structured tool failures', () => {
    const traj = [step({ role: 'tool', toolName: 'terminal', content: '{"success": false, "error": "no such file"}' })];
    expect(runProcessCheck('tool_errors', { ...base, trajectory: traj })).toMatchObject({ ok: false });
    expect(runProcessCheck('tool_errors', { ...base, trajectory: [step({ role: 'tool', content: 'a,b\n1,2' })] }).ok).toBe(true);
  });

  it('hit_turn_limit', () => {
    expect(runProcessCheck('hit_turn_limit', { ...base, trajectory: [], result: { apiCalls: 20 } as RunResult }).ok).toBe(false);
    expect(runProcessCheck('hit_turn_limit', { ...base, trajectory: [] }).ok).toBe(true);
  });
});
