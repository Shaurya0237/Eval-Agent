/** Turn live events into short activity-feed lines. */
import type { TrajectoryStep } from '@eval-lab/shared';

export interface RunRef {
  taskId: string;
  configId: string;
  trial: number;
}

export interface ActivityItem {
  id: number;
  at: number;
  runId: string;
  run: RunRef;
  kind: 'started' | 'step' | 'passed' | 'failed' | 'broken';
  text: string;
}

/** Run ids are `<task>__<config>__t<trial>` (see pipeline step 2). */
export function parseRunId(runId: string): RunRef {
  const [taskId = runId, configId = '', trial = 't0'] = runId.split('__');
  return { taskId, configId, trial: Number(trial.slice(1)) || 0 };
}

/** One-line description of a trajectory step. */
export function describeStep(step: TrajectoryStep): string {
  if (step.toolCalls.length) return `calls ${step.toolCalls.map((c) => c.name).join(', ')}`;
  if (step.role === 'tool') return `${step.toolName ?? 'tool'} returned`;
  if (step.role === 'user') return 'received the task';
  const text = step.content.trim().replace(/\s+/g, ' ');
  return text ? `says “${text.length > 60 ? `${text.slice(0, 60)}…` : text}”` : 'is thinking';
}
