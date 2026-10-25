/**
 * Parse `hermes sessions export` JSONL into a trajectory + run metrics.
 * `hermes -z` prints only the final answer, so the session export is our trajectory source.
 */
import type { ToolCall, TrajectoryStep } from '@eval-lab/shared';

/** Export fields we use; all optional. */
export interface HermesExportedSession {
  id?: string;
  source?: string;
  started_at?: number;
  system_prompt?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  api_call_count?: number | null;
  tool_call_count?: number | null;
  actual_cost_usd?: number | null;
  estimated_cost_usd?: number | null;
  messages?: HermesExportedMessage[];
}

/** One message row, as exported (and as stored in Hermes's `messages` table). */
export interface HermesExportedMessage {
  role?: string;
  content?: string | null;
  tool_calls?: string | unknown[] | null;
  tool_name?: string | null;
  tool_call_id?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  timestamp?: number;
}

export interface ParsedSession {
  trajectory: TrajectoryStep[];
  finalAnswer: string;
  inputTokens: number;
  outputTokens: number;
  apiCalls: number;
  toolCalls: number;
  /** null when Hermes reported no cost. */
  costUsd: number | null;
}

/** Pick the newest session. */
export function pickRunSession(sessions: HermesExportedSession[]): HermesExportedSession | null {
  if (sessions.length === 0) return null;
  return [...sessions].sort((a, b) => (b.started_at ?? 0) - (a.started_at ?? 0))[0];
}

/** Parse tool_calls (JSON string or array) into ToolCalls. */
function parseToolCalls(raw: HermesExportedMessage['tool_calls']): ToolCall[] {
  if (!raw) return [];
  let list: unknown;
  try {
    list = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.map((item, i): ToolCall => {
    const call = (item ?? {}) as Record<string, unknown>;
    // OpenAI { function: { name, arguments } } or flat { name, arguments }.
    const fn = (call.function ?? call) as Record<string, unknown>;
    const args = fn.arguments;
    return {
      id: typeof call.id === 'string' ? call.id : `call-${i}`,
      name: typeof fn.name === 'string' ? fn.name : 'unknown',
      arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
    };
  });
}

function asRole(role: string | undefined): TrajectoryStep['role'] {
  return role === 'system' || role === 'user' || role === 'assistant' || role === 'tool' ? role : 'assistant';
}

/** Convert one Hermes message into a trajectory step. */
export function toTrajectoryStep(m: HermesExportedMessage, seq: number): TrajectoryStep {
  return {
    seq,
    role: asRole(m.role),
    content: m.content ?? '',
    toolCalls: parseToolCalls(m.tool_calls),
    toolName: m.tool_name ?? null,
    toolCallId: m.tool_call_id ?? null,
    reasoning: m.reasoning ?? m.reasoning_content ?? null,
    timestamp: m.timestamp ?? 0,
  };
}

/** Build trajectory, final answer and metrics from one session. */
export function parseSession(session: HermesExportedSession): ParsedSession {
  const steps: TrajectoryStep[] = [];

  // System prompt first: shows what Hermes injected (memory, skills index).
  if (session.system_prompt) {
    steps.push({
      seq: 0,
      role: 'system',
      content: session.system_prompt,
      toolCalls: [],
      toolName: null,
      toolCallId: null,
      reasoning: null,
      timestamp: session.started_at ?? 0,
    });
  }

  for (const m of session.messages ?? []) steps.push(toTrajectoryStep(m, steps.length));

  // Final answer = last non-empty assistant message.
  const lastAnswer = [...steps].reverse().find((s) => s.role === 'assistant' && s.content.trim() !== '');
  const toolCalls = steps.reduce((n, s) => n + s.toolCalls.length, 0);

  return {
    trajectory: steps,
    finalAnswer: lastAnswer?.content ?? '',
    inputTokens: session.input_tokens ?? 0,
    outputTokens: session.output_tokens ?? 0,
    apiCalls: session.api_call_count ?? steps.filter((s) => s.role === 'assistant').length,
    toolCalls: session.tool_call_count ?? toolCalls,
    costUsd: session.actual_cost_usd ?? session.estimated_cost_usd ?? null,
  };
}
