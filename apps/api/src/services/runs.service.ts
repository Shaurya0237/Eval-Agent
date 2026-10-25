/** SERVICE · Loads one run's detail and workspace files. */
import { Injectable, NotFoundException } from '@nestjs/common';
import type { RunDetail } from '@eval-lab/shared';
import { DefinitionsRepository } from '../models/definitions.repository';
import { ExperimentRepository } from '../models/experiment.repository';
import { toRunDetail } from '../views/run.view';

@Injectable()
export class RunsService {
  constructor(
    private readonly experiments: ExperimentRepository,
    private readonly definitions: DefinitionsRepository,
  ) {}

  async detail(id: string, runId: string): Promise<RunDetail> {
    const [status, plan, snapshot] = await Promise.all([
      this.experiments.findStatus(id),
      this.experiments.findPlan(id),
      this.experiments.findSnapshot(id),
    ]);
    const run = plan?.runs.find((r) => r.runId === runId);
    if (!status || !plan || !snapshot || !run) throw new NotFoundException(`Run "${runId}" not found`);

    const task = snapshot.suite.tasks.find((t) => t.id === run.taskId)!;
    const [result, score, trajectory, workspace] = await Promise.all([
      this.experiments.findRunResult(id, runId),
      this.experiments.findRunScore(id, runId),
      this.experiments.findTrajectory(id, runId),
      this.experiments.listWorkspace(id, runId, this.definitions.fixtureDir(snapshot.suite.id, task.fixtures)),
    ]);
    return toRunDetail({
      experimentId: id,
      agent: status.agent ?? 'hermes',
      baselineConfigId: status.baselineConfigId,
      run,
      plan,
      snapshot,
      result,
      score,
      trajectory,
      workspace,
    });
  }

  async file(id: string, runId: string, path: string): Promise<{ path: string; content: string; truncated: boolean }> {
    const file = await this.experiments.readWorkspaceFile(id, runId, path);
    if (!file) throw new NotFoundException('File not found');
    return { path, ...file };
  }
}
