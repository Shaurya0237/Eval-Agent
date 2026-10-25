/** Tolerant matching of agent output against expected answers (case, whitespace, numeric tolerance, subset objects). */

export interface MatchResult {
  ok: boolean;
  /** Readable mismatch reasons. */
  mismatches: string[];
}

/** Trim, collapse whitespace, lowercase. */
export function normalizeText(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Parse a number or numeric string ("12.4%", "1,234"); else null. */
function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/,/g, '').replace(/%$/, '').trim();
  if (cleaned === '' || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Short JSON preview for messages. */
function show(value: unknown): string {
  const text = JSON.stringify(value);
  return text === undefined ? String(value) : text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/** Deep tolerant compare; expected objects are subsets, arrays match in order. */
export function deepMatch(actual: unknown, expected: unknown, tolerance = 0, path = '$'): MatchResult {
  const fail = (msg: string): MatchResult => ({ ok: false, mismatches: [`${path}: ${msg}`] });

  if (typeof expected === 'number') {
    const n = asNumber(actual);
    if (n === null) return fail(`expected number ${expected}, got ${show(actual)}`);
    return Math.abs(n - expected) <= tolerance + 1e-9
      ? { ok: true, mismatches: [] }
      : fail(`expected ${expected}${tolerance ? ` (±${tolerance})` : ''}, got ${n}`);
  }

  if (typeof expected === 'string') {
    if (typeof actual !== 'string' && typeof actual !== 'number') return fail(`expected "${expected}", got ${show(actual)}`);
    return normalizeText(String(actual)) === normalizeText(expected)
      ? { ok: true, mismatches: [] }
      : fail(`expected "${expected}", got ${show(actual)}`);
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return fail(`expected an array, got ${show(actual)}`);
    if (actual.length !== expected.length) return fail(`expected ${expected.length} items, got ${actual.length}`);
    const mismatches = expected.flatMap((e, i) => deepMatch(actual[i], e, tolerance, `${path}[${i}]`).mismatches);
    return { ok: mismatches.length === 0, mismatches };
  }

  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      return fail(`expected an object, got ${show(actual)}`);
    }
    const mismatches = Object.entries(expected).flatMap(([key, e]) => {
      if (!(key in actual)) return [`${path}.${key}: missing`];
      return deepMatch((actual as Record<string, unknown>)[key], e, tolerance, `${path}.${key}`).mismatches;
    });
    return { ok: mismatches.length === 0, mismatches };
  }

  // booleans and null: exact
  return actual === expected ? { ok: true, mismatches: [] } : fail(`expected ${show(expected)}, got ${show(actual)}`);
}

/** Extract the last top-level JSON object from free text (prose, code fences). */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  let found: Record<string, unknown> | null = null;
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try {
          const parsed: unknown = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            found = parsed as Record<string, unknown>;
            start = i; // skip nested objects
          }
        } catch {
          // not valid JSON; try the next "{"
        }
        break;
      }
    }
  }
  return found;
}
