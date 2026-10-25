/**
 * CONTROLLER · Experiments.
 * POST /api/experiments                   start
 * GET  /api/experiments                   list
 * GET  /api/experiments/:id               progress + run status
 * GET  /api/experiments/:id/report        report
 * POST /api/experiments/:id/retry-broken  re-run timeout/error runs
 * GET  /api/experiments/:id/export        CSV or JSON export
 * GET  /api/experiments/:id/events        live events (Server-Sent Events)
 */
import { Body, Controller, Get, Param, Post, Query, Res, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { FastifyReply } from 'fastify';
import type { ExperimentDetail, ExperimentStatusFile, Report } from '@eval-lab/shared';
import { parseCreateExperiment } from '../dto/create-experiment.dto';
import { EventsService, type SseMessage } from '../services/events.service';
import { ExperimentsService } from '../services/experiments.service';

@Controller('api/experiments')
export class ExperimentsController {
  constructor(
    private readonly experiments: ExperimentsService,
    private readonly events: EventsService,
  ) {}

  @Sse(':id/events')
  stream(@Param('id') id: string): Observable<SseMessage> {
    return this.events.stream(id);
  }

  @Post()
  create(@Body() body: unknown): Promise<ExperimentStatusFile> {
    return this.experiments.start(parseCreateExperiment(body));
  }

  @Get()
  list(): Promise<ExperimentStatusFile[]> {
    return this.experiments.list();
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<ExperimentDetail> {
    return this.experiments.detail(id);
  }

  @Get(':id/report')
  report(@Param('id') id: string): Promise<Report> {
    return this.experiments.report(id);
  }

  @Post(':id/retry-broken')
  retryBroken(@Param('id') id: string): Promise<ExperimentStatusFile> {
    return this.experiments.retryBroken(id);
  }

  @Get(':id/export')
  async export(@Param('id') id: string, @Query('format') format: string, @Res({ passthrough: true }) reply: FastifyReply): Promise<string> {
    const file = await this.experiments.export(id, format === 'json' ? 'json' : 'csv');
    reply.header('Content-Type', file.contentType).header('Content-Disposition', `attachment; filename="${file.filename}"`);
    return file.body;
  }
}
