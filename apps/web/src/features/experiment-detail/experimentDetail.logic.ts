/** Experiment page logic: pipeline stage states, run grid, regression explorer. */
import type { ExperimentStatusFile, PipelineStep, PlannedRunWithStatus, Report, TaskCell, TaskDiff } from '@eval-lab/shared';
export type StepState = 'done' | 'active' | 'waiting' | 'failed';

/** Four progress stages; per-run steps 3–5 collapse into one "run" stage. */
const STAGES: { step: PipelineStep; label: string; covers: PipelineStep[] }[] = [
  { step: 'load', label: 'Load', covers: ['load'] },
  { step: 'plan', label: 'Plan', covers: ['plan'] },
  { step: 'execute', label: 'Run tasks', covers: ['prepare', 'execute', 'score'] },
  { step: 'compare', label: 'Compare', covers: ['compare'] },
];
// Restates PIPELINE order: the web app imports only types from @eval-lab/shared.
const ORDER: readonly PipelineStep[] = ['load', 'plan', 'prepare', 'execute', 'score', 'compare'];

export function stepStates(status: ExperimentStatusFile): { step: PipelineStep; label: string; state: StepState }[] {
  const currentIndex = status.currentStep ? ORDER.indexOf(status.currentStep) : -1;
  return STAGES.map(({ step, label, covers }) => {
    if (status.status === 'completed') return { step, label, state: 'done' };
    const active = status.currentStep !== null && covers.includes(status.currentStep);
    const before = Math.max(...covers.map((c) => ORDER.indexOf(c))) < currentIndex;
    const state: StepState = active ? (status.status === 'failed' ? 'failed' : 'active') : before ? 'done' : 'waiting';
    return { step, label, state };
  });
}

export interface GridRow {
  taskId: string;
  cells: { configId: string; runs: PlannedRunWithStatus[] }[];
}

/** Task × config grid; each cell holds that pair's trials in order. */
export function buildRunGrid(runs: PlannedRunWithStatus[], configIds: string[]): GridRow[] {
  const taskIds = [...new Set(runs.map((r) => r.taskId))];
  return taskIds.map((taskId) => ({
    taskId,
    cells: configIds.map((configId) => ({
      configId,
      runs: runs.filter((r) => r.taskId === taskId && r.configId === configId).sort((a, b) => a.trial - b.trial),
    })),
  }));
}

export const brokenRunCount = (runs: PlannedRunWithStatus[]): number =>
  runs.filter((r) => r.status === 'timeout' || r.status === 'error').length;

// ── Regression explorer ──────────────────────────────────────────────────────

export type DiffFilter = 'all' | 'regressed' | 'improved' | 'unchanged' | 'flaky' | 'broken';
export const DIFF_FILTERS: DiffFilter[] = ['all', 'regressed', 'improved', 'unchanged', 'flaky', 'broken'];

export interface DiffRow {
  diff: TaskDiff;
  baseline: TaskCell;
  candidate: TaskCell;
}

function matches(row: DiffRow, filter: DiffFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'flaky') return row.baseline.flaky || row.candidate.flaky;
  if (filter === 'broken') return row.baseline.brokenRuns + row.candidate.brokenRuns > 0;
  return row.diff.change === filter;
}

/** Rows for one candidate, most-regressed first. */
export function diffRows(report: Report, candidateId: string, filter: DiffFilter): DiffRow[] {
  const comparison = report.comparisons.find((c) => c.configId === candidateId);
  if (!comparison) return [];
  return comparison.taskDiffs
    .map((diff) => {
      const cells = report.tasks.find((t) => t.taskId === diff.taskId)!.cells;
      return {
        diff,
        baseline: cells.find((c) => c.configId === report.baselineConfigId)!,
        candidate: cells.find((c) => c.configId === candidateId)!,
      };
    })
    .filter((row) => matches(row, filter))
    .sort((a, b) => a.diff.delta - b.diff.delta);
}

export function filterCounts(report: Report, candidateId: string): Record<DiffFilter, number> {
  return Object.fromEntries(DIFF_FILTERS.map((f) => [f, diffRows(report, candidateId, f).length])) as Record<DiffFilter, number>;
}

/** Width/offset of a zero-centred bar for Δ in [-1, 1]. */
export function deltaBar(delta: number): { left: string; width: string } {
  const clamped = Math.max(-1, Math.min(1, delta));
  const width = Math.abs(clamped) * 50;
  return { left: `${clamped < 0 ? 50 - width : 50}%`, width: `${Math.max(width, 0.5)}%` };
}

// ── Overview numbers ──

/** Rows for the forest plot: every non-baseline config's score Δ with its CI. */
export function forestRows(report: Report) {
  return report.comparisons.map((c) => ({
    label: c.configId,
    delta: c.score.delta,
    ciLow: c.score.ciLow,
    ciHigh: c.score.ciHigh,
    verdict: c.score.verdict,
  }));
}

/** Config with the highest mean score (ties: first). */
export function bestConfig(report: Report): { configId: string; meanScore: number } | null {
  return report.configs.reduce<{ configId: string; meanScore: number } | null>(
    (best, c) => (!best || c.meanScore > best.meanScore ? { configId: c.configId, meanScore: c.meanScore } : best),
    null,
  );
}

/** Plain-language summary of the verdicts (used as the chart's screen-reader caption). */
export function verdictSummary(report: Report): string {
  const parts = report.comparisons.map((c) => `${c.configId} is ${c.score.verdict} (Δ ${c.score.delta.toFixed(2)})`);
  return `Compared with ${report.baselineConfigId}: ${parts.join('; ')}.`;
}
