/** TanStack Query cache keys, shared by queries and invalidation. */
export const queryKeys = {
  health: ['health'] as const,
  definitions: ['definitions'] as const,
  experiments: ['experiments'] as const,
  experiment: (id: string) => ['experiment', id] as const,
  report: (id: string, version: string | null | undefined) => ['report', id, version ?? ''] as const,
  estimate: (suiteId: string, configIds: string[], trials: number) => ['estimate', suiteId, configIds.join(','), trials] as const,
  run: (id: string, runId: string) => ['run', id, runId] as const,
  runFile: (id: string, runId: string, path: string | null) => ['run-file', id, runId, path ?? ''] as const,
};
