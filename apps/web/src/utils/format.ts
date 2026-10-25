/** Pure formatting helpers shared by all pages. */
import type { ComparedMetric, RunStatus } from '@eval-lab/shared';

export const formatUsd = (v: number): string => (Math.abs(v) < 0.01 && v !== 0 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`);
export const formatSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
export const formatScore = (v: number): string => v.toFixed(2);
export const formatPct = (v: number): string => `${Math.round(v * 100)}%`;
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Signed delta in the metric's unit, e.g. "+0.22", "−$0.010", "+3.1s". */
export function formatDelta(metric: ComparedMetric, v: number): string {
  const sign = v > 1e-9 ? '+' : v < -1e-9 ? '−' : '±';
  const abs = Math.abs(v);
  if (metric === 'costUsd') return `${sign}${formatUsd(abs)}`;
  if (metric === 'durationMs') return `${sign}${formatSeconds(abs)}`;
  return `${sign}${abs.toFixed(2)}`;
}

export const RUN_STATUS_STYLE: Record<RunStatus, { label: string; className: string }> = {
  pending: { label: 'pending', className: 'border-ink-700 bg-ink-800 text-ink-400' },
  running: { label: 'running', className: 'border-accent/40 bg-accent/10 text-accent' },
  done: { label: 'done', className: 'border-ink-600 bg-ink-800 text-ink-300' },
  timeout: { label: 'timeout', className: 'border-warn/40 bg-warn/10 text-warn' },
  error: { label: 'error', className: 'border-warn/40 bg-warn/10 text-warn' },
};

/** Chip classes for a run's score (0..1) and status. */
export function scoreChipClass(score: number | null, status: RunStatus): string {
  if (status === 'pending') return 'border-ink-600 border-dashed bg-ink-850 text-ink-500';
  if (status === 'running') return 'border-accent/50 text-accent running-shimmer';
  if (status === 'timeout' || status === 'error') return 'border-warn/50 bg-warn/15 text-warn';
  if (score === null) return 'border-ink-700 bg-ink-850';
  if (score >= 1) return 'border-good/50 bg-good/20 text-good';
  if (score > 0) return 'border-good/40 bg-good/5 text-good';
  return 'border-bad/40 bg-bad/15 text-bad';
}
