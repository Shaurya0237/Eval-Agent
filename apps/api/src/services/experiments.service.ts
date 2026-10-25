/** SERVICE · Starts, lists, reads, retries and exports experiments. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ExperimentDetail, ExperimentStatusFile, Report, RunScore } from '@eval-lab/shared';
import type { CreateExperimentDto } from '../dto/create-experiment.dto';
import { DefinitionsRepository } from '../models/definitions.repository';
import { ExperimentRepository } from '../models/experiment.repository';
import { toExperimentDetail } from '../views/experiment.view';
import { toExportFile, type ExportFile } from '../views/export.view';
import { PipelineRunner } from './pipeline-runner.service';

@Injectable()
export class ExperimentsService {
  constructor(
    private readonly experiments: ExperimentRepository,
    private readonly definitions: DefinitionsRepository,
    private readonly runner: PipelineRunner,
  ) {}

  async start(req: CreateExperimentDto): Promise<ExperimentStatusFile> {
    const defs = await this.definitions.loadAll();
    if (!defs.suites.has(req.suiteId)) throw new BadRequestException(`Unknown or invalid suite "${req.suiteId}"`);
    const missing = req.configIds.filter((id) => !defs.configs.has(id));
    if (missing.length) throw new BadRequestException(`Unknown or invalid config(s): ${missing.join(', ')}`);

    const { simulated, ...request } = req;
    try {
      return await this.runner.start(request, simulated ? { agent: 'simulated' } : {});
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  list(): Promise<ExperimentStatusFile[]> {
    return this.experiments.listStatuses();
  }

  async detail(id: string): Promise<ExperimentDetail> {
    const status = await this.requireStatus(id);
    const plan = await this.experiments.findPlan(id);
    const scores = new Map<string, RunScore>();
    for (const run of plan?.runs ?? []) {
      const score = await this.experiments.findRunScore(id, run.runId);
      if (score) scores.set(run.runId, score);
    }
    return toExperimentDetail(
      status,
      plan,
      (runId) => scores.get(runId) ?? null,
      (runId) => this.runner.isRunInFlight(id, runId),
      this.experiments.hasReport(id),
    );
  }

  async report(id: string): Promise<Report> {
    await this.requireStatus(id);
    const report = await this.experiments.findReport(id);
    if (!report) throw new NotFoundException('Report not ready yet');
    return report;
  }

  async retryBroken(id: string): Promise<ExperimentStatusFile> {
    try {
      return await this.runner.retryBroken(id);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  async export(id: string, format: 'csv' | 'json'): Promise<ExportFile> {
    const status = await this.requireStatus(id);
    return toExportFile(id, status.agent ?? 'hermes', await this.experiments.findScores(id), format);
  }

  private async requireStatus(id: string): Promise<ExperimentStatusFile> {
    const status = await this.experiments.findStatus(id);
    if (!status) throw new NotFoundException(`Experiment "${id}" not found`);
    return status;
  }
}
