/** Outcome checks: score 0–1 per check (partial credit per JSON field); the only input to the score. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import type { OutcomeCheck, OutcomeCheckResult } from '@eval-lab/shared';
import { deepMatch, extractJsonObject, normalizeText } from './matching';

export interface OutcomeContext {
  finalAnswer: string;
  workspaceDir: string;
}

/** Score an object field by field for partial credit. */
function scoreObject(actual: unknown, expected: unknown, tolerance: number): { score: number; mismatches: string[] } {
  const isPlainObject = expected !== null && typeof expected === 'object' && !Array.isArray(expected);
  if (!isPlainObject || actual === null || typeof actual !== 'object') {
    const m = deepMatch(actual, expected, tolerance);
    return { score: m.ok ? 1 : 0, mismatches: m.mismatches };
  }
  const entries = Object.entries(expected as Record<string, unknown>);
  if (entries.length === 0) return { score: 1, mismatches: [] };
  let matched = 0;
  const mismatches: string[] = [];
  for (const [key, value] of entries) {
    const m = deepMatch({ [key]: (actual as Record<string, unknown>)[key] }, { [key]: value }, tolerance);
    if (m.ok) matched++;
    else mismatches.push(...m.mismatches);
  }
  return { score: matched / entries.length, mismatches };
}

function result(check: OutcomeCheck, index: number, score: number, explanation: string): OutcomeCheckResult {
  return { id: check.id ?? `${check.type}-${index + 1}`, type: check.type, score, passed: score >= 1, explanation };
}

/** Run one outcome check. */
export async function runOutcomeCheck(check: OutcomeCheck, index: number, ctx: OutcomeContext): Promise<OutcomeCheckResult> {
  switch (check.type) {
    case 'answer_contains': {
      const ok = normalizeText(ctx.finalAnswer).includes(normalizeText(check.value));
      return result(check, index, ok ? 1 : 0, ok ? `Answer mentions "${check.value}".` : `Answer does not mention "${check.value}".`);
    }

    case 'answer_json': {
      const json = extractJsonObject(ctx.finalAnswer);
      if (!json) return result(check, index, 0, 'No JSON object found in the final answer.');
      const { score, mismatches } = scoreObject(json, check.expect, check.tolerance ?? 0);
      return result(check, index, score, mismatches.length ? mismatches.join('; ') : 'All expected fields match.');
    }

    case 'file_json': {
      // Path must stay inside the workspace.
      const file = normalize(join(ctx.workspaceDir, check.path));
      if (!file.startsWith(normalize(ctx.workspaceDir) + sep)) {
        return result(check, index, 0, `Path "${check.path}" points outside the workspace.`);
      }
      if (!existsSync(file)) return result(check, index, 0, `File "${check.path}" was not created.`);
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readFile(file, 'utf8'));
      } catch {
        return result(check, index, 0, `File "${check.path}" is not valid JSON.`);
      }
      const { score, mismatches } = scoreObject(parsed, check.expect, check.tolerance ?? 0);
      return result(
        check,
        index,
        score,
        mismatches.length ? `${check.path}: ${mismatches.join('; ')}` : `${check.path} matches the expected content.`,
      );
    }
  }
}
