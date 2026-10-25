/** Typed fetch wrappers for the NestJS API (types from @eval-lab/shared). */
import type {
  CreateExperimentRequest,
  DefinitionsResponse,
  ExperimentDetail,
  ExperimentStatusFile,
  HealthResponse,
  Report,
  RunDetail,
} from '@eval-lab/shared';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) {
    // Nest error body: { message: string | string[] }.
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
    throw new Error(message ?? `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export type LaunchRequest = CreateExperimentRequest & { simulated?: boolean };

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  definitions: () => request<DefinitionsResponse>('/api/definitions'),
  estimate: (req: CreateExperimentRequest) =>
    request<{ runs: number; estimatedCostUsd: number }>('/api/estimate', { method: 'POST', body: JSON.stringify(req) }),
  createExperiment: (req: LaunchRequest) =>
    request<ExperimentStatusFile>('/api/experiments', { method: 'POST', body: JSON.stringify(req) }),
  experiments: () => request<ExperimentStatusFile[]>('/api/experiments'),
  experiment: (id: string) => request<ExperimentDetail>(`/api/experiments/${encodeURIComponent(id)}`),
  retryBroken: (id: string) =>
    request<ExperimentStatusFile>(`/api/experiments/${encodeURIComponent(id)}/retry-broken`, { method: 'POST', body: '{}' }),
  exportUrl: (id: string, format: 'csv' | 'json') => `/api/experiments/${encodeURIComponent(id)}/export?format=${format}`,
  report: (id: string) => request<Report>(`/api/experiments/${encodeURIComponent(id)}/report`),
  run: (id: string, runId: string) => request<RunDetail>(`/api/experiments/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}`),
  workspaceFile: (id: string, runId: string, path: string) =>
    request<{ path: string; content: string; truncated: boolean }>(
      `/api/experiments/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/file?path=${encodeURIComponent(path)}`,
    ),
};
