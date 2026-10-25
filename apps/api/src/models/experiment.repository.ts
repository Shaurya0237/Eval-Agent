/** MODEL · Reads and writes experiment data (JSON files under data/experiments/). */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { readFile, rm, stat } from 'node:fs/promises';
import { join, normalize, relative, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import type {
  DefinitionsSnapshot,
  ExperimentStatusFile,
  PlanFile,
  Report,
  RunResult,
  RunScore,
  TrajectoryStep,
  WorkspaceFile,
} from '@eval-lab/shared';
import { paths } from '../config/paths';
import { experimentPaths, type RunPaths } from '../infrastructure/storage/experiment-layout';
import { readJsonIfExists, readJsonLines, writeJson, writeJsonLines } from '../infrastructure/storage/json-store';

/** Max characters returned when viewing a workspace file. */
const MAX_FILE_CHARS = 100_000;

/** List files under `dir`, relative to it. */
function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(dir, join(d.parentPath, d.name)));
}

const sha256 = async (file: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');

@Injectable()
export class ExperimentRepository {
  // ── Experiment files ──

  /** All experiment statuses, newest first. */
  async listStatuses(): Promise<ExperimentStatusFile[]> {
    if (!existsSync(paths.experiments)) return [];
    const all = await Promise.all(readdirSync(paths.experiments).map((id) => this.findStatus(id)));
    return all.filter((s): s is ExperimentStatusFile => s !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findStatus(id: string): Promise<ExperimentStatusFile | null> {
    return readJsonIfExists<ExperimentStatusFile>(experimentPaths(id).status);
  }
  saveStatus(status: ExperimentStatusFile): Promise<void> {
    return writeJson(experimentPaths(status.id).status, status);
  }

  findSnapshot(id: string): Promise<DefinitionsSnapshot | null> {
    return readJsonIfExists<DefinitionsSnapshot>(experimentPaths(id).definitions);
  }
  saveSnapshot(id: string, snapshot: DefinitionsSnapshot): Promise<void> {
    return writeJson(experimentPaths(id).definitions, snapshot);
  }

  findPlan(id: string): Promise<PlanFile | null> {
    return readJsonIfExists<PlanFile>(experimentPaths(id).plan);
  }
  savePlan(id: string, plan: PlanFile): Promise<void> {
    return writeJson(experimentPaths(id).plan, plan);
  }

  async findScores(id: string): Promise<RunScore[]> {
    return (await readJsonIfExists<RunScore[]>(experimentPaths(id).scores)) ?? [];
  }
  saveScores(id: string, scores: RunScore[]): Promise<void> {
    return writeJson(experimentPaths(id).scores, scores);
  }

  hasReport(id: string): boolean {
    return existsSync(experimentPaths(id).report);
  }
  findReport(id: string): Promise<Report | null> {
    return readJsonIfExists<Report>(experimentPaths(id).report);
  }
  saveReport(id: string, report: Report): Promise<void> {
    return writeJson(experimentPaths(id).report, report);
  }

  // ── Run files ──

  /** Paths of one run's folder. */
  runPaths(id: string, runId: string): RunPaths {
    return experimentPaths(id).run(runId);
  }

  /** Delete a run's folder before a retry. */
  deleteRun(id: string, runId: string): Promise<void> {
    return rm(this.runPaths(id, runId).dir, { recursive: true, force: true });
  }

  findRunResult(id: string, runId: string): Promise<RunResult | null> {
    return readJsonIfExists<RunResult>(this.runPaths(id, runId).result);
  }
  findRunScore(id: string, runId: string): Promise<RunScore | null> {
    return readJsonIfExists<RunScore>(this.runPaths(id, runId).score);
  }
  findTrajectory(id: string, runId: string): Promise<TrajectoryStep[]> {
    return readJsonLines<TrajectoryStep>(this.runPaths(id, runId).trajectory);
  }

  /** Save one run's trajectory, result and score. */
  async saveRunOutcome(
    id: string,
    runId: string,
    outcome: { result: RunResult; trajectory: TrajectoryStep[]; score: RunScore },
  ): Promise<void> {
    const run = this.runPaths(id, runId);
    await writeJsonLines(run.trajectory, outcome.trajectory);
    await writeJson(run.result, outcome.result);
    await writeJson(run.score, outcome.score);
  }

  /** List workspace files, marked added/modified/unchanged vs fixtures. */
  async listWorkspace(id: string, runId: string, fixturesDir: string): Promise<WorkspaceFile[]> {
    const workspace = this.runPaths(id, runId).workspace;
    return Promise.all(
      listFiles(workspace).map(async (path): Promise<WorkspaceFile> => {
        const file = join(workspace, path);
        const original = join(fixturesDir, path);
        const change = !existsSync(original) ? 'added' : (await sha256(file)) === (await sha256(original)) ? 'unchanged' : 'modified';
        return { path, size: (await stat(file)).size, change };
      }),
    );
  }

  /** Read a workspace file; null if missing or outside the workspace. */
  async readWorkspaceFile(id: string, runId: string, path: string): Promise<{ content: string; truncated: boolean } | null> {
    const root = normalize(this.runPaths(id, runId).workspace);
    const file = normalize(join(root, path));
    if (!file.startsWith(root + sep) || !existsSync(file)) return null;
    const text = await readFile(file, 'utf8');
    return { content: text.slice(0, MAX_FILE_CHARS), truncated: text.length > MAX_FILE_CHARS };
  }
}
