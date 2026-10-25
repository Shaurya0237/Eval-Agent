/** Process checks: warnings from the trajectory; never affect the score. */
import type { ProcessCheckId, ProcessFlag, RunResult, TrajectoryStep } from '@eval-lab/shared';

export interface ProcessContext {
  trajectory: TrajectoryStep[];
  result: RunResult;
  /** Input file names copied into the workspace. */
  fixtureFiles: string[];
  /** Skills installed for this config. */
  skills: string[];
  maxTurns: number;
}

const allToolCalls = (trajectory: TrajectoryStep[]) => trajectory.flatMap((step) => step.toolCalls);

/** True if a tool result reports an error. */
function isToolError(step: TrajectoryStep): boolean {
  const text = step.content.trim();
  if (/^error\b/i.test(text)) return true;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      return obj.success === false || (typeof obj.error === 'string' && obj.error.length > 0);
    }
  } catch {
    // plain-text output: not an error
  }
  return false;
}

/** Run one process check. */
export function runProcessCheck(id: ProcessCheckId, ctx: ProcessContext): ProcessFlag {
  switch (id) {
    case 'read_inputs': {
      if (ctx.fixtureFiles.length === 0) return { id, ok: true, explanation: 'Task has no input files.' };
      // Any tool call that names an input file.
      const touched = ctx.fixtureFiles.filter((f) => allToolCalls(ctx.trajectory).some((c) => c.arguments.includes(f)));
      return touched.length > 0
        ? { id, ok: true, explanation: `Opened input file(s): ${touched.join(', ')}.` }
        : { id, ok: false, explanation: `Answered without touching any input file (${ctx.fixtureFiles.join(', ')}). It may have guessed.` };
    }

    case 'used_skill': {
      if (ctx.skills.length === 0) return { id, ok: true, explanation: 'No skills installed in this config.' };
      const viewed = ctx.skills.filter((s) => allToolCalls(ctx.trajectory).some((c) => c.name === 'skill_view' && c.arguments.includes(s)));
      return viewed.length > 0
        ? { id, ok: true, explanation: `Loaded skill(s): ${viewed.join(', ')}.` }
        : { id, ok: false, explanation: `Skill(s) ${ctx.skills.join(', ')} were available but never loaded.` };
    }

    case 'tool_errors': {
      const errors = ctx.trajectory.filter((s) => s.role === 'tool' && isToolError(s));
      return errors.length === 0
        ? { id, ok: true, explanation: 'No failing tool calls.' }
        : {
            id,
            ok: false,
            explanation: `${errors.length} tool call(s) failed (${[...new Set(errors.map((e) => e.toolName ?? '?'))].join(', ')}).`,
          };
    }

    case 'hit_turn_limit': {
      const hit = ctx.result.apiCalls >= ctx.maxTurns;
      return hit
        ? { id, ok: false, explanation: `Used ${ctx.result.apiCalls} of ${ctx.maxTurns} allowed turns; it was probably cut off.` }
        : { id, ok: true, explanation: `Used ${ctx.result.apiCalls} of ${ctx.maxTurns} allowed turns.` };
    }
  }
}
