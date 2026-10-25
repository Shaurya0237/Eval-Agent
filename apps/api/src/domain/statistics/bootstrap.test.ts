import { describe, expect, it } from 'vitest';
import { createRng, pairedBootstrap, verdictFromInterval } from './bootstrap';

const OPTS = { iterations: 4000, confidence: 0.95, seed: 1 };

describe('pairedBootstrap', () => {
  it('reports no difference (CI [0,0]) when both configs score identically', () => {
    const tasks = [
      { baseline: [1, 1, 1], candidate: [1, 1, 1] },
      { baseline: [0, 0, 0], candidate: [0, 0, 0] },
    ];
    const r = pairedBootstrap(tasks, OPTS);
    expect(r.delta).toBe(0);
    expect(r.ciLow).toBe(0);
    expect(r.ciHigh).toBe(0);
    expect(verdictFromInterval(r.ciLow, r.ciHigh, true)).toBe('inconclusive');
  });

  it('finds a clear, consistent improvement', () => {
    const tasks = Array.from({ length: 6 }, () => ({ baseline: [0, 0, 0], candidate: [1, 1, 1] }));
    const r = pairedBootstrap(tasks, OPTS);
    expect(r.delta).toBe(1);
    expect(r.ciLow).toBeGreaterThan(0);
    expect(verdictFromInterval(r.ciLow, r.ciHigh, true)).toBe('better');
  });

  it('is inconclusive when only 1 of 6 tasks improves (the "skill helps one task" case)', () => {
    const tasks = [
      { baseline: [0, 0, 0], candidate: [1, 1, 1] },
      ...Array.from({ length: 5 }, () => ({ baseline: [1, 1, 1], candidate: [1, 1, 1] })),
    ];
    const r = pairedBootstrap(tasks, OPTS);
    expect(r.delta).toBeCloseTo(1 / 6);
    // Many resamples miss the improved task, so 0 stays in the CI.
    expect(r.ciLow).toBeLessThanOrEqual(0);
    expect(verdictFromInterval(r.ciLow, r.ciHigh, true)).toBe('inconclusive');
  });

  it('is inconclusive for noisy, mixed results', () => {
    const tasks = [
      { baseline: [1, 0, 1], candidate: [0, 1, 1] },
      { baseline: [0, 1, 0], candidate: [1, 0, 0] },
      { baseline: [1, 1, 0], candidate: [1, 0, 1] },
    ];
    const r = pairedBootstrap(tasks, OPTS);
    expect(verdictFromInterval(r.ciLow, r.ciHigh, true)).toBe('inconclusive');
  });

  it('is deterministic for a given seed', () => {
    const tasks = [
      { baseline: [0, 1, 0], candidate: [1, 1, 0] },
      { baseline: [0.5], candidate: [1] },
    ];
    expect(pairedBootstrap(tasks, OPTS)).toEqual(pairedBootstrap(tasks, OPTS));
  });

  it('ignores tasks that were not observed under both configs', () => {
    const r = pairedBootstrap(
      [
        { baseline: [1], candidate: [] },
        { baseline: [0], candidate: [1] },
      ],
      OPTS,
    );
    expect(r.delta).toBe(1);
  });
});

describe('verdictFromInterval', () => {
  it('flips meaning when lower is better (cost, time)', () => {
    expect(verdictFromInterval(0.01, 0.05, false)).toBe('worse'); // costs more
    expect(verdictFromInterval(-0.05, -0.01, false)).toBe('better'); // costs less
    expect(verdictFromInterval(-0.01, 0.01, false)).toBe('inconclusive');
  });
});

describe('createRng', () => {
  it('produces values in [0, 1)', () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
