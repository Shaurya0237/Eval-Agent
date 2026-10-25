import { describe, expect, it } from 'vitest';
import { deepMatch, extractJsonObject } from './matching';

describe('deepMatch', () => {
  it('compares strings ignoring case and whitespace', () => {
    expect(deepMatch('  emea ', 'EMEA').ok).toBe(true);
    expect(deepMatch('APAC', 'EMEA').mismatches[0]).toContain('expected "EMEA"');
  });

  it('applies numeric tolerance and accepts numeric strings', () => {
    expect(deepMatch(12.4, 12.39, 0.1).ok).toBe(true);
    expect(deepMatch('12.4%', 12.39, 0.1).ok).toBe(true);
    expect(deepMatch('1,234', 1234).ok).toBe(true);
    expect(deepMatch(13, 12.39, 0.1).ok).toBe(false);
  });

  it('treats expected objects as subsets and reports missing fields', () => {
    expect(deepMatch({ a: 1, extra: true }, { a: 1 }).ok).toBe(true);
    expect(deepMatch({ b: 1 }, { a: 1 }).mismatches).toEqual(['$.a: missing']);
  });

  it('matches arrays element by element, in order', () => {
    expect(deepMatch([{ k: 'a' }, { k: 'b' }], [{ k: 'a' }, { k: 'b' }]).ok).toBe(true);
    expect(deepMatch([{ k: 'b' }, { k: 'a' }], [{ k: 'a' }, { k: 'b' }]).ok).toBe(false);
    expect(deepMatch([1], [1, 2]).mismatches[0]).toContain('expected 2 items');
  });
});

describe('extractJsonObject', () => {
  it('finds JSON inside prose and code fences', () => {
    expect(extractJsonObject('Sure! ```json\n{"region": "EMEA"}\n```')).toEqual({ region: 'EMEA' });
  });

  it('keeps the last top-level object (the final answer)', () => {
    expect(extractJsonObject('first {"a": 1} then {"b": {"c": 2}}')).toEqual({ b: { c: 2 } });
  });

  it('handles braces inside strings and returns null when there is no JSON', () => {
    expect(extractJsonObject('{"note": "a } brace"}')).toEqual({ note: 'a } brace' });
    expect(extractJsonObject('no json here')).toBeNull();
  });
});
