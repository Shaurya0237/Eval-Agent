/**
 * Seeded paired bootstrap (resampling tasks, then trials) for Δ and its CI.
 * A CI that excludes zero gives a verdict; otherwise "inconclusive".
 */
import type { Verdict } from '@eval-lab/shared';

/** One task's per-trial values for each config. */
export interface PairedTask {
  baseline: number[];
  candidate: number[];
}

export interface BootstrapOptions {
  iterations: number;
  /** e.g. 0.95 */
  confidence: number;
  seed: number;
}

export interface BootstrapResult {
  baselineMean: number;
  candidateMean: number;
  delta: number;
  ciLow: number;
  ciHigh: number;
}

export const DEFAULT_BOOTSTRAP: BootstrapOptions = { iterations: 10_000, confidence: 0.95, seed: 42 };

/** Seeded PRNG (mulberry32) returning floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Mean of a with-replacement resample. */
function resampleMean(xs: number[], rng: () => number): number {
  let sum = 0;
  for (let i = 0; i < xs.length; i++) sum += xs[Math.floor(rng() * xs.length)];
  return sum / xs.length;
}

/** Interpolated quantile of a sorted array. */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Paired Δ (candidate − baseline) with a bootstrap CI. */
export function pairedBootstrap(tasks: PairedTask[], options: BootstrapOptions = DEFAULT_BOOTSTRAP): BootstrapResult {
  // Only tasks seen under both configs can be paired.
  const usable = tasks.filter((t) => t.baseline.length > 0 && t.candidate.length > 0);
  if (usable.length === 0) {
    return { baselineMean: 0, candidateMean: 0, delta: 0, ciLow: 0, ciHigh: 0 };
  }

  const baselineMean = mean(usable.map((t) => mean(t.baseline)));
  const candidateMean = mean(usable.map((t) => mean(t.candidate)));
  const delta = candidateMean - baselineMean;

  const rng = createRng(options.seed);
  const deltas = new Array<number>(options.iterations);
  for (let it = 0; it < options.iterations; it++) {
    let sum = 0;
    for (let k = 0; k < usable.length; k++) {
      // Resample a task, then its trials.
      const task = usable[Math.floor(rng() * usable.length)];
      sum += resampleMean(task.candidate, rng) - resampleMean(task.baseline, rng);
    }
    deltas[it] = sum / usable.length;
  }
  deltas.sort((a, b) => a - b);

  const tail = (1 - options.confidence) / 2;
  return {
    baselineMean,
    candidateMean,
    delta,
    ciLow: quantile(deltas, tail),
    ciHigh: quantile(deltas, 1 - tail),
  };
}

/** Turn a CI into a verdict; `higherIsBetter` is false for cost and time. */
export function verdictFromInterval(ciLow: number, ciHigh: number, higherIsBetter: boolean): Verdict {
  const EPS = 1e-12; // CI [0, 0] means no difference
  if (ciLow > EPS) return higherIsBetter ? 'better' : 'worse';
  if (ciHigh < -EPS) return higherIsBetter ? 'worse' : 'better';
  return 'inconclusive';
}
