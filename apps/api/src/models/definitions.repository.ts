/** MODEL · Read access to YAML definitions (validation lives in step 1). */
import { Injectable } from '@nestjs/common';
import type { DefinitionsSnapshot } from '@eval-lab/shared';
import { fixtureDir, freezeDefinitions, loadDefinitions, type LoadedDefinitions } from '../pipeline/steps/1-load';

@Injectable()
export class DefinitionsRepository {
  /** Load all suites and configs; invalid files go to `errors`. */
  loadAll(): Promise<LoadedDefinitions> {
    return loadDefinitions();
  }

  /** Freeze one suite + configs (with their skill and memory text). */
  async snapshot(suiteId: string, configIds: string[]): Promise<DefinitionsSnapshot> {
    return freezeDefinitions(await this.loadAll(), suiteId, configIds);
  }

  /** Absolute path of a task's fixture folder. */
  fixtureDir(suiteId: string, fixtures: string): string {
    return fixtureDir(suiteId, fixtures);
  }
}
