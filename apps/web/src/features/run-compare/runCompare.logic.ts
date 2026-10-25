/** Logic for comparing two runs of the same task. */
import type { RunDetail } from '@eval-lab/shared';

export interface MetricRow {
  label: string;
  left: string;
  right: string;
  /** Better side on this metric, if any. */
  winner: 'left' | 'right' | null;
}

function row(label: string, l: number | undefined, r: number | undefined, fmt: (v: number) => string, higherIsBetter: boolean): MetricRow {
  const winner = l === undefined || r === undefined || l === r ? null : r > l === higherIsBetter ? 'right' : 'left';
  return { label, left: l === undefined ? '–' : fmt(l), right: r === undefined ? '–' : fmt(r), winner };
}

/** Side-by-side metrics, better side marked. */
export function compareMetrics(left: RunDetail, right: RunDetail): MetricRow[] {
  const L = left.score;
  const R = right.score;
  return [
    row('score', L?.score, R?.score, (v) => v.toFixed(2), true),
    row('cost', L?.metrics.costUsd, R?.metrics.costUsd, (v) => `$${v.toFixed(4)}`, false),
    row('time', L?.metrics.durationMs, R?.metrics.durationMs, (v) => `${(v / 1000).toFixed(1)}s`, false),
    row('model calls', L?.metrics.apiCalls, R?.metrics.apiCalls, String, false),
    row('tool calls', left.result?.toolCalls, right.result?.toolCalls, String, false),
  ];
}

/** Tool names in call order. */
export function toolPath(detail: RunDetail): string[] {
  return detail.trajectory.flatMap((s) => s.toolCalls.map((c) => c.name));
}
