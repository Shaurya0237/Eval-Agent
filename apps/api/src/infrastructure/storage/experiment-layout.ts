/** On-disk file layout of an experiment and its runs (data/experiments/<id>/). */
import { join } from 'node:path';
import { paths } from '../../config/paths';

/** File paths of one experiment. */
export function experimentPaths(experimentId: string) {
  const dir = join(paths.experiments, experimentId);
  return {
    dir,
    status: join(dir, 'status.json'),
    definitions: join(dir, '1-definitions.json'),
    plan: join(dir, '2-plan.json'),
    scores: join(dir, '5-scores.json'),
    report: join(dir, '6-report.json'),
    run: (runId: string) => runPaths(join(dir, 'runs', runId)),
  };
}

/** Folder layout of one run. */
export function runPaths(runDir: string) {
  return {
    dir: runDir,
    home: join(runDir, 'home'),
    workspace: join(runDir, 'workspace'),
    trajectory: join(runDir, 'trajectory.jsonl'),
    sessionExport: join(runDir, 'session-export.jsonl'),
    result: join(runDir, 'result.json'),
    score: join(runDir, 'score.json'),
    log: join(runDir, 'hermes-output.log'),
  };
}
export type RunPaths = ReturnType<typeof runPaths>;
