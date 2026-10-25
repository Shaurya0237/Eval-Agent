import { describe, expect, it } from 'vitest';
import type { TrajectoryStep } from '@eval-lab/shared';
import { buildTimeline, preview } from './trajectory.logic';

const step = (s: Partial<TrajectoryStep>): TrajectoryStep => ({
  seq: 0,
  role: 'assistant',
  content: '',
  toolCalls: [],
  toolName: null,
  toolCallId: null,
  reasoning: null,
  timestamp: 0,
  ...s,
});

describe('buildTimeline', () => {
  it('pairs each tool call with its result and marks the final answer', () => {
    const timeline = buildTimeline([
      step({ role: 'user', content: 'task' }),
      step({ toolCalls: [{ id: 'c1', name: 'read_file', arguments: '{"path":"a.csv"}' }] }),
      step({ role: 'tool', content: 'rows', toolCallId: 'c1', toolName: 'read_file' }),
      step({ content: '{"answer":1}' }),
    ]);
    expect(timeline.map((t) => t.kind)).toEqual(['user', 'tool', 'final']);
    const tool = timeline[1];
    expect(tool.kind === 'tool' && tool.result?.content).toBe('rows');
  });
});

describe('preview', () => {
  it('truncates long text', () => {
    expect(preview('x'.repeat(10), 4)).toEqual({ text: 'xxxx…', truncated: true });
  });
});
