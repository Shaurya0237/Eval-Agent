import { describe, expect, it } from 'vitest';
import type { TrajectoryStep } from '@eval-lab/shared';
import { describeStep, parseRunId } from './activity';

const step = (s: Partial<TrajectoryStep>): TrajectoryStep => ({
  seq: 1,
  role: 'assistant',
  content: '',
  toolCalls: [],
  toolName: null,
  toolCallId: null,
  reasoning: null,
  timestamp: 0,
  ...s,
});

describe('activity', () => {
  it('parses run ids', () => {
    expect(parseRunId('map-ipc-302__mapping-skill__t2')).toEqual({ taskId: 'map-ipc-302', configId: 'mapping-skill', trial: 2 });
  });
  it('describes steps briefly', () => {
    expect(describeStep(step({ toolCalls: [{ id: '1', name: 'read_file', arguments: '{}' }] }))).toBe('calls read_file');
    expect(describeStep(step({ role: 'tool', toolName: 'terminal' }))).toBe('terminal returned');
    expect(describeStep(step({ content: '{"count": 7}' }))).toBe('says “{"count": 7}”');
  });
});
