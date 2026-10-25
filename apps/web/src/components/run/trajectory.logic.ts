/** Turns trajectory steps into a timeline, pairing tool calls with results. */
import type { ToolCall, TrajectoryStep } from '@eval-lab/shared';

export type TimelineEntry =
  | { kind: 'system'; seq: number; content: string }
  | { kind: 'user'; seq: number; content: string }
  | { kind: 'thought'; seq: number; content: string; reasoning: string | null }
  | { kind: 'tool'; seq: number; call: ToolCall; argsPretty: string; result: TrajectoryStep | null }
  | { kind: 'final'; seq: number; content: string };

/** Pretty-print JSON tool args; else return as-is. */
export function prettyArgs(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function buildTimeline(steps: TrajectoryStep[]): TimelineEntry[] {
  const resultsByCallId = new Map(steps.filter((s) => s.role === 'tool' && s.toolCallId).map((s) => [s.toolCallId!, s]));
  const lastAssistantWithText = [...steps].reverse().find((s) => s.role === 'assistant' && s.content.trim() && s.toolCalls.length === 0);

  const items: TimelineEntry[] = [];
  for (const step of steps) {
    if (step.role === 'system') items.push({ kind: 'system', seq: step.seq, content: step.content });
    else if (step.role === 'user') items.push({ kind: 'user', seq: step.seq, content: step.content });
    else if (step.role === 'assistant') {
      if (step === lastAssistantWithText) {
        items.push({ kind: 'final', seq: step.seq, content: step.content });
        continue;
      }
      if (step.content.trim() || step.reasoning)
        items.push({ kind: 'thought', seq: step.seq, content: step.content, reasoning: step.reasoning });
      for (const call of step.toolCalls) {
        items.push({
          kind: 'tool',
          seq: step.seq,
          call,
          argsPretty: prettyArgs(call.arguments),
          result: resultsByCallId.get(call.id) ?? null,
        });
      }
    }
    // "tool" results render inside their call.
  }
  return items;
}

/** Truncate long tool output for display. */
export function preview(text: string, max = 600): { text: string; truncated: boolean } {
  return text.length > max ? { text: `${text.slice(0, max)}…`, truncated: true } : { text, truncated: false };
}
