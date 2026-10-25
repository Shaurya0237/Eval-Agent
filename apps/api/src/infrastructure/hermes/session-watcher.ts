/**
 * Live trajectory: tail Hermes's session DB (HERMES_HOME/state.db) while a run executes.
 * Hermes writes each message as the agent loop progresses (SQLite WAL allows concurrent reads).
 */
import { existsSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import type { TrajectoryStep } from '@eval-lab/shared';
import { toTrajectoryStep, type HermesExportedMessage } from './hermes-session';

const POLL_MS = 400;

type MessageRow = HermesExportedMessage & { id: number };

/** Call `onStep` for every new message in `dbPath`. Returns a stop function (does a final read). */
export function watchSessionSteps(dbPath: string, onStep: (step: TrajectoryStep) => void, intervalMs = POLL_MS): () => void {
  let db: DatabaseSync | null = null;
  let lastId = 0;
  let seq = 1; // seq 0 is the system prompt, added from the final export

  const read = (): void => {
    try {
      if (!db) {
        if (!existsSync(dbPath)) return;
        // Lazy require: node:sqlite logs an ExperimentalWarning on load.
        const { DatabaseSync: Database } = require('node:sqlite') as typeof import('node:sqlite');
        db = new Database(dbPath, { readOnly: true });
      }
      const rows = db
        .prepare(
          'SELECT id, role, content, tool_calls, tool_name, tool_call_id, reasoning, timestamp FROM messages WHERE id > ? ORDER BY id',
        )
        .all(lastId) as unknown as MessageRow[];
      for (const row of rows) {
        lastId = row.id;
        onStep(toTrajectoryStep(row, seq++));
      }
    } catch {
      // Table not created yet, or the writer holds a lock: try again next tick.
    }
  };

  const timer = setInterval(read, intervalMs);
  return () => {
    clearInterval(timer);
    read();
    db?.close();
  };
}
