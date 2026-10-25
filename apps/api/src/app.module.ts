/** Root module: controllers (HTTP), services (logic), models (storage), views (presenters). */
import { Module } from '@nestjs/common';
import { DefinitionsController } from './controllers/definitions.controller';
import { ExperimentsController } from './controllers/experiments.controller';
import { HealthController } from './controllers/health.controller';
import { RunsController } from './controllers/runs.controller';
import { DefinitionsRepository } from './models/definitions.repository';
import { ExperimentRepository } from './models/experiment.repository';
import { DefinitionsService } from './services/definitions.service';
import { EventsService } from './services/events.service';
import { ExperimentsService } from './services/experiments.service';
import { PipelineRunner } from './services/pipeline-runner.service';
import { RunsService } from './services/runs.service';

@Module({
  controllers: [HealthController, DefinitionsController, ExperimentsController, RunsController],
  providers: [
    // models
    ExperimentRepository,
    DefinitionsRepository,
    // services
    EventsService,
    PipelineRunner,
    DefinitionsService,
    ExperimentsService,
    RunsService,
  ],
})
export class AppModule {}
