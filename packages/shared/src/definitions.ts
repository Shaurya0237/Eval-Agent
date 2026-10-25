/** Zod schemas (and inferred types) for suite and config YAML files. */
import { z } from 'zod';

// ── Outcome checks (decide the score) ──

/** Passes when the final answer contains `value` (case/whitespace-insensitive). */
const answerContainsCheck = z.object({
  type: z.literal('answer_contains'),
  id: z.string().optional(),
  value: z.string().min(1),
});

/** Passes when the answer's JSON matches `expect`; `tolerance` is absolute for numbers. */
const answerJsonCheck = z.object({
  type: z.literal('answer_json'),
  id: z.string().optional(),
  expect: z.record(z.string(), z.unknown()),
  tolerance: z.number().nonnegative().optional(),
});

/** Passes when a workspace file holds JSON matching `expect`. */
const fileJsonCheck = z.object({
  type: z.literal('file_json'),
  id: z.string().optional(),
  path: z.string().min(1),
  expect: z.unknown(),
  tolerance: z.number().nonnegative().optional(),
});

export const outcomeCheckSchema = z.discriminatedUnion('type', [answerContainsCheck, answerJsonCheck, fileJsonCheck]);
export type OutcomeCheck = z.infer<typeof outcomeCheckSchema>;

// ── Process checks (diagnostics only) ──

export const PROCESS_CHECK_IDS = ['read_inputs', 'used_skill', 'tool_errors', 'hit_turn_limit'] as const;
export const processCheckIdSchema = z.enum(PROCESS_CHECK_IDS);
export type ProcessCheckId = z.infer<typeof processCheckIdSchema>;

const DEFAULT_PROCESS_CHECKS: ProcessCheckId[] = ['read_inputs', 'tool_errors', 'hit_turn_limit'];

// ── Task and suite ──

export const taskSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'use lowercase letters, digits and dashes'),
  /** What the agent is asked to do. */
  prompt: z.string().min(1),
  /** Folder (relative to the suite) copied into the agent's workspace. */
  fixtures: z.string().min(1),
  /** Per-run time limit; Hermes is killed after this. */
  timeoutSec: z.number().int().positive().default(240),
  /** Minimum score (mean of outcome checks) to pass. */
  passThreshold: z.number().min(0).max(1).default(1),
  checks: z.array(outcomeCheckSchema).min(1),
  processChecks: z.array(processCheckIdSchema).default(DEFAULT_PROCESS_CHECKS),
});
export type Task = z.infer<typeof taskSchema>;

export const suiteSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string().default(''),
  /** Readable names for task groups, keyed by task id prefix (e.g. `sec` for `sec-murder`). */
  groups: z.record(z.string(), z.string()).default({}),
  tasks: z.array(taskSchema).min(1),
});
export type Suite = z.infer<typeof suiteSchema>;

// ── Agent config ──

export const agentConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().default(''),
  /** OpenAI model id, e.g. "gpt-4.1-mini". */
  model: z.string().min(1),
  /** Hermes toolsets to enable; keep equal across compared configs. */
  toolsets: z.array(z.string()).min(1).default(['file', 'terminal', 'skills', 'memory']),
  /** Skill folders under skills/ to install. */
  skills: z.array(z.string()).default([]),
  /** Seed memory file path from repo root; null = memory off. */
  memory: z.string().nullable().default(null),
  /** Max tool-calling iterations (Hermes `agent.max_turns`). */
  maxTurns: z.number().int().positive().default(20),
  /** USD per million tokens, for estimates and when Hermes reports no cost. */
  price: z
    .object({
      inputPerMTok: z.number().nonnegative(),
      outputPerMTok: z.number().nonnegative(),
    })
    .default({ inputPerMTok: 0, outputPerMTok: 0 }),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;
