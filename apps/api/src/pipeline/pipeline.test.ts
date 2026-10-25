/** End-to-end test of steps 1–6 on the sample suite with the simulated Hermes (deterministic mode). */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DefinitionsSnapshot, RunScore } from '@eval-lab/shared';
import { runPaths } from '../infrastructure/storage/experiment-layout';
import { freezeDefinitions, loadDefinitions } from './steps/1-load';
import { planRuns } from './steps/2-plan';
import { hermesConfigYaml, prepareRun, toHermesMemory } from './steps/3-prepare';
import { executeRun } from './steps/4-execute';
import { scoreRun } from './steps/5-score';
import { buildReport } from './steps/6-compare';

const SUITE = 'indian-criminal-law';
const SIMULATED_HERMES = resolve(__dirname, '../../simulator/simulated-hermes.mjs');
const ctx = { hermesBin: SIMULATED_HERMES, apiKey: 'test-key' };

/** A small slice of the suite: one task of each kind. */
async function snapshotWith(configIds: string[], taskIds: string[]): Promise<DefinitionsSnapshot> {
  const snapshot = await freezeDefinitions(await loadDefinitions(), SUITE, configIds);
  return { ...snapshot, suite: { ...snapshot.suite, tasks: snapshot.suite.tasks.filter((t) => taskIds.includes(t.id)) } };
}

describe('step 1 · load', () => {
  it('loads the sample suite and configs without errors', async () => {
    const defs = await loadDefinitions();
    expect(defs.errors).toEqual([]);
    expect(defs.suites.get(SUITE)?.tasks).toHaveLength(24);
    expect([...defs.configs.keys()].sort()).toEqual(['baseline', 'mapping-skill', 'open-book']);
  });
});

describe('step 2 · plan', () => {
  it('plans tasks × configs × trials with a cost estimate', async () => {
    const snapshot = await freezeDefinitions(await loadDefinitions(), SUITE, ['baseline', 'open-book']);
    const plan = planRuns(snapshot, 3);
    expect(plan.runs).toHaveLength(24 * 2 * 3);
    expect(plan.runs[0]).toEqual({ runId: 'sec-murder__baseline__t1', taskId: 'sec-murder', configId: 'baseline', trial: 1 });
    expect(plan.estimatedCostUsd).toBeGreaterThan(0);
  });
});

describe('step 3 · prepare', () => {
  it('writes a Hermes config with memory only when seeded, and converts memory separators', () => {
    const config = {
      id: 'a',
      description: '',
      model: 'm',
      toolsets: ['file'],
      skills: [],
      memory: null,
      maxTurns: 7,
      price: { inputPerMTok: 0, outputPerMTok: 0 },
    };
    expect(hermesConfigYaml(config)).toContain('memory_enabled: false');
    expect(hermesConfigYaml(config)).toContain('max_turns: 7');
    expect(toHermesMemory('fact one\n---\nfact two\n')).toBe('fact one\n§\nfact two');
  });
});

describe('steps 3 → 6 with the simulated Hermes', () => {
  it('file tools fix everything; the mapping skill fixes only IPC → BNS questions', async () => {
    const tasks = ['sec-murder', 'pun-theft', 'map-ipc-302', 'now-murder-2025'];
    const snapshot = await snapshotWith(['baseline', 'open-book', 'mapping-skill'], tasks);
    const tmp = mkdtempSync(join(tmpdir(), 'eval-pipeline-'));
    const scores: RunScore[] = [];
    const trajectories = new Map<string, string>();

    for (const planned of planRuns(snapshot, 1).runs) {
      const task = snapshot.suite.tasks.find((t) => t.id === planned.taskId)!;
      const config = snapshot.configs.find((c) => c.id === planned.configId)!;
      const run = runPaths(join(tmp, planned.runId));
      await prepareRun(snapshot, task, config, run);
      const { result, trajectory } = await executeRun(ctx, task, config, planned.runId, run);
      scores.push(await scoreRun({ suiteId: SUITE, task, config, trial: planned.trial, result, trajectory }, run.workspace));
      trajectories.set(planned.runId, JSON.stringify(trajectory));
    }
    const passed = (taskId: string, configId: string) => scores.find((s) => s.taskId === taskId && s.configId === configId)!.passed;

    // Closed book answers with stale or wrong numbers.
    expect(tasks.every((t) => !passed(t, 'baseline'))).toBe(true);
    const stale = scores.find((s) => s.taskId === 'now-murder-2025' && s.configId === 'baseline')!;
    expect(stale.outcomeChecks.map((c) => c.explanation).join(' ')).toContain('expected "BNS", got "IPC"');

    // Open book searches the statute and gets everything right.
    expect(tasks.every((t) => passed(t, 'open-book'))).toBe(true);
    expect(trajectories.get('sec-murder__open-book__t1')).toContain('search_files');

    // The skill helps exactly the transition questions, and the process check sees it being loaded.
    expect([passed('map-ipc-302', 'mapping-skill'), passed('now-murder-2025', 'mapping-skill')]).toEqual([true, true]);
    expect([passed('sec-murder', 'mapping-skill'), passed('pun-theft', 'mapping-skill')]).toEqual([false, false]);
    const skillRun = scores.find((s) => s.taskId === 'map-ipc-302' && s.configId === 'mapping-skill')!;
    expect(skillRun.processFlags.find((f) => f.id === 'used_skill')?.ok).toBe(true);
    const home = runPaths(join(tmp, 'map-ipc-302__mapping-skill__t1')).home;
    expect(readFileSync(join(home, 'skills', 'ipc-bns-mapping', 'SKILL.md'), 'utf8')).toContain('IPC → BNS');

    const report = buildReport('test', snapshot, 'baseline', scores, { iterations: 2000, confidence: 0.95, seed: 1 });
    const openBook = report.comparisons.find((c) => c.configId === 'open-book')!;
    const skill = report.comparisons.find((c) => c.configId === 'mapping-skill')!;
    expect(openBook.score).toMatchObject({ delta: 1, verdict: 'better' });
    expect([skill.improved, skill.unchanged]).toEqual([2, 2]);
  }, 60_000);

  it('marks a hung run as timeout and a crashing run as error', async () => {
    const snapshot = await snapshotWith(['baseline'], ['sec-murder']);
    const config = snapshot.configs[0];
    const tmp = mkdtempSync(join(tmpdir(), 'eval-broken-'));
    const base = snapshot.suite.tasks[0];

    const hung = { ...base, prompt: 'SLEEP forever', timeoutSec: 1 };
    let run = runPaths(join(tmp, 'hung'));
    await prepareRun(snapshot, hung, config, run);
    expect((await executeRun(ctx, hung, config, 'hung', run)).result.status).toBe('timeout');

    const crash = { ...base, prompt: 'CRASH now' };
    run = runPaths(join(tmp, 'crash'));
    await prepareRun(snapshot, crash, config, run);
    const crashed = await executeRun(ctx, crash, config, 'crash', run);
    expect(crashed.result.status).toBe('error');
    const score = await scoreRun({ suiteId: SUITE, task: crash, config, trial: 1, ...crashed }, run.workspace);
    expect(score).toMatchObject({ score: 0, passed: false, runStatus: 'error' });
  }, 30_000);
});
