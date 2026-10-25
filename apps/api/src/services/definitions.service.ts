/** SERVICE · Lists definitions and estimates experiment size and cost. */
import { BadRequestException, Injectable } from '@nestjs/common';
import type { DefinitionsResponse } from '@eval-lab/shared';
import type { CreateExperimentDto } from '../dto/create-experiment.dto';
import { DefinitionsRepository } from '../models/definitions.repository';
import { planRuns } from '../pipeline/steps/2-plan';
import { toDefinitionsResponse } from '../views/definitions.view';

@Injectable()
export class DefinitionsService {
  constructor(private readonly definitions: DefinitionsRepository) {}

  async list(): Promise<DefinitionsResponse> {
    return toDefinitionsResponse(await this.definitions.loadAll());
  }

  /** Run steps 1–2 only: run count and rough cost. */
  async estimate(req: CreateExperimentDto): Promise<{ runs: number; estimatedCostUsd: number }> {
    try {
      const plan = planRuns(await this.definitions.snapshot(req.suiteId, req.configIds), req.trials);
      return { runs: plan.runs.length, estimatedCostUsd: plan.estimatedCostUsd };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}
