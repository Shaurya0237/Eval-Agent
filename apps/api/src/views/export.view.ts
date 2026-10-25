/** VIEW · Run scores → flat CSV / JSON export rows. */
import type { AgentKind, RunScore } from '@eval-lab/shared';

export interface ExportFile {
  filename: string;
  contentType: string;
  body: string;
}

function toRows(experimentId: string, agent: AgentKind, scores: RunScore[]) {
  return scores.map((s) => ({
    experimentId,
    agent,
    runId: s.runId,
    taskId: s.taskId,
    configId: s.configId,
    trial: s.trial,
    runStatus: s.runStatus,
    score: s.score,
    passed: s.passed,
    costUsd: s.metrics.costUsd,
    durationMs: s.metrics.durationMs,
    apiCalls: s.metrics.apiCalls,
    inputTokens: s.metrics.inputTokens,
    outputTokens: s.metrics.outputTokens,
    processWarnings: s.processFlags
      .filter((f) => !f.ok)
      .map((f) => f.id)
      .join(' '),
  }));
}

/** Quote a CSV cell (RFC 4180) when needed. */
function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toExportFile(experimentId: string, agent: AgentKind, scores: RunScore[], format: 'csv' | 'json'): ExportFile {
  const rows = toRows(experimentId, agent, scores);
  if (format === 'json') {
    return { filename: `${experimentId}.json`, contentType: 'application/json', body: JSON.stringify(rows, null, 2) };
  }
  const columns = Object.keys(rows[0] ?? { runId: '' }) as (keyof (typeof rows)[number])[];
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))];
  return { filename: `${experimentId}.csv`, contentType: 'text/csv; charset=utf-8', body: `${lines.join('\n')}\n` };
}
