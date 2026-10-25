/** VIEW · Definitions → API response. */
import type { DefinitionsResponse } from '@eval-lab/shared';
import type { LoadedDefinitions } from '../pipeline/steps/1-load';

export function toDefinitionsResponse(defs: LoadedDefinitions): DefinitionsResponse {
  return {
    suites: [...defs.suites.values()].map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      groups: s.groups,
      taskIds: s.tasks.map((t) => t.id),
      tasks: s.tasks,
    })),
    configs: [...defs.configs.values()],
    errors: defs.errors,
  };
}
