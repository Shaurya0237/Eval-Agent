/**
 * CONTROLLER · Runs.
 * GET /api/experiments/:id/runs/:runId             run detail
 * GET /api/experiments/:id/runs/:runId/file?path=  one workspace file
 */
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import type { RunDetail } from '@eval-lab/shared';
import { RunsService } from '../services/runs.service';

@Controller('api/experiments/:id/runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Get(':runId')
  detail(@Param('id') id: string, @Param('runId') runId: string): Promise<RunDetail> {
    return this.runs.detail(id, runId);
  }

  @Get(':runId/file')
  file(@Param('id') id: string, @Param('runId') runId: string, @Query('path') path: string) {
    if (!path) throw new BadRequestException('path is required');
    return this.runs.file(id, runId, path);
  }
}
