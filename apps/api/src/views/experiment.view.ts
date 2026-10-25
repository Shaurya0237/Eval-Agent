/** VIEW · Experiment models → detail response with per-run status. */
import type { ExperimentDetail, ExperimentStatusFile, PlanFile, PlannedRunWithStatus, RunScore } from '@eval-lab/shared';

/** Build experiment detail; a run's status comes from its score, else running/pending. */
export function toExperimentDetail(
  status: ExperimentStatusFile,
  plan: PlanFile | null,
  scoreOf: (runId: string) => RunScore | null,
  isInFlight: (runId: string) => boolean,
  hasReport: boolean,
): ExperimentDetail {
  const runs: PlannedRunWithStatus[] = (plan?.runs ?? []).map((r) => {
    const score = scoreOf(r.runId);
    if (score) return { ...r, status: score.runStatus, score: score.score, passed: score.passed };
    return { ...r, status: isInFlight(r.runId) ? 'running' : 'pending', score: null, passed: null };
  });
  return { status, runs, hasReport };
}
