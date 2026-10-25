/** CONTROLLER · GET /api/health: Hermes install and API key status. */
import { existsSync, readFileSync } from 'node:fs';
import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@eval-lab/shared';
import { API_KEY_ENV, HERMES_PROVIDER } from '../config/model-provider';
import { paths } from '../config/paths';

@Controller('api/health')
export class HealthController {
  @Get()
  health(): HealthResponse {
    return {
      apiKeyConfigured: Boolean(process.env[API_KEY_ENV]),
      hermesInstalled: existsSync(paths.hermesBin),
      hermesVersion: existsSync(paths.hermesVersionMarker) ? readFileSync(paths.hermesVersionMarker, 'utf8').trim() : null,
      provider: HERMES_PROVIDER,
    };
  }
}
