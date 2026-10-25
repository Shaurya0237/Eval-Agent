import { mkdtempSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TrajectoryStep } from '@eval-lab/shared';
import { watchSessionSteps } from './session-watcher';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('watchSessionSteps', () => {
  it('emits each new message once, in order, including ones written before stop', async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), 'watch-')), 'state.db');
    const steps: TrajectoryStep[] = [];
    const stop = watchSessionSteps(dbPath, (s) => steps.push(s), 20);

    await sleep(50); // DB doesn't exist yet: no errors, no steps
    const db = new DatabaseSync(dbPath);
    db.exec(
      'CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, content TEXT, tool_calls TEXT, tool_name TEXT, tool_call_id TEXT, reasoning TEXT, timestamp REAL)',
    );
    const insert = db.prepare('INSERT INTO messages (role, content, tool_calls, timestamp) VALUES (?, ?, ?, ?)');
    insert.run('user', 'task', null, 1);
    insert.run('assistant', '', JSON.stringify([{ id: 'c1', function: { name: 'read_file', arguments: '{}' } }]), 2);
    await sleep(80);
    insert.run('assistant', 'done', null, 3);
    stop();
    db.close();

    expect(steps.map((s) => s.role)).toEqual(['user', 'assistant', 'assistant']);
    expect(steps.map((s) => s.seq)).toEqual([1, 2, 3]);
    expect(steps[1].toolCalls[0].name).toBe('read_file');
  });
});
