import { describe, expect, it } from 'vitest';
import { formatDelta, formatUsd, scoreChipClass } from './format';

describe('format', () => {
  it('formats signed deltas in the unit of the metric', () => {
    expect(formatDelta('score', 0.25)).toBe('+0.25');
    expect(formatDelta('score', -0.1)).toBe('−0.10');
    expect(formatDelta('score', 0)).toBe('±0.00');
    expect(formatDelta('durationMs', 1500)).toBe('+1.5s');
  });
  it('shows small costs with more precision', () => {
    expect(formatUsd(0.0016)).toBe('$0.0016');
    expect(formatUsd(2.5)).toBe('$2.50');
  });
  it('colours chips by outcome, and broken runs differently from wrong answers', () => {
    expect(scoreChipClass(1, 'done')).toContain('good');
    expect(scoreChipClass(0, 'done')).toContain('bad');
    expect(scoreChipClass(null, 'timeout')).toContain('warn');
  });
});
