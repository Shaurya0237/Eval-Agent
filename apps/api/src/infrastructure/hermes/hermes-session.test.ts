import { describe, expect, it } from 'vitest';
import { parseSession, pickRunSession } from './hermes-session';

// Shape of a real `hermes sessions export` (v0.15.2).
const session = {
  id: '20261024_200632_f5c4ae',
  source: 'cli',
  started_at: 100,
  system_prompt: 'You are Hermes Agent...',
  input_tokens: 5200,
  output_tokens: 310,
  api_call_count: 3,
  tool_call_count: 1,
  actual_cost_usd: null,
  estimated_cost_usd: 0.0031,
  messages: [
    { role: 'user', content: 'Which region?', tool_calls: null, timestamp: 101 },
    {
      role: 'assistant',
      content: '',
      tool_calls: JSON.stringify([
        { id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"bns-2023.txt"}' } },
      ]),
      timestamp: 102,
    },
    { role: 'tool', content: 'year,quarter,...', tool_name: 'read_file', tool_call_id: 'call_1', timestamp: 103 },
    { role: 'assistant', content: '{"region":"EMEA"}', tool_calls: null, timestamp: 104 },
  ],
};

describe('parseSession', () => {
  it('turns an export into a trajectory with the system prompt first', () => {
    const parsed = parseSession(session);
    expect(parsed.trajectory.map((s) => s.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant']);
    expect(parsed.trajectory[2].toolCalls).toEqual([{ id: 'call_1', name: 'read_file', arguments: '{"path":"bns-2023.txt"}' }]);
    expect(parsed.trajectory[3]).toMatchObject({ toolName: 'read_file', toolCallId: 'call_1' });
  });

  it('extracts the final answer and metrics, falling back to estimated cost', () => {
    const parsed = parseSession(session);
    expect(parsed.finalAnswer).toBe('{"region":"EMEA"}');
    expect(parsed).toMatchObject({ inputTokens: 5200, outputTokens: 310, apiCalls: 3, toolCalls: 1, costUsd: 0.0031 });
  });

  it('copes with a session that never got an answer (e.g. API failure)', () => {
    const parsed = parseSession({ id: 'x', messages: [{ role: 'user', content: 'hi' }] });
    expect(parsed.finalAnswer).toBe('');
    expect(parsed.costUsd).toBeNull();
  });
});

describe('pickRunSession', () => {
  it('takes the newest session', () => {
    expect(
      pickRunSession([
        { id: 'old', started_at: 1 },
        { id: 'new', started_at: 2 },
      ])?.id,
    ).toBe('new');
    expect(pickRunSession([])).toBeNull();
  });
});
