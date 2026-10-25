/**
 * CONTROLLER · Definitions.
 * GET  /api/definitions  suites, configs, validation errors
 * POST /api/estimate     run count + rough cost
 */
import { Body, Controller, Get, Post } from '@nestjs/common';
import type { DefinitionsResponse } from '@eval-lab/shared';
import { parseCreateExperiment } from '../dto/create-experiment.dto';
import { DefinitionsService } from '../services/definitions.service';

@Controller('api')
export class DefinitionsController {
  constructor(private readonly definitions: DefinitionsService) {}

  @Get('definitions')
  list(): Promise<DefinitionsResponse> {
    return this.definitions.list();
  }

  @Post('estimate')
  estimate(@Body() body: unknown): Promise<{ runs: number; estimatedCostUsd: number }> {
    return this.definitions.estimate(parseCreateExperiment(body));
  }
}
