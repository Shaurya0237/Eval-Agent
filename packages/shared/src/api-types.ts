/** Shapes the pipeline writes to data/experiments/<id>/ and the API returns. */
import type { AgentConfig, OutcomeCheck, ProcessCheckId, Suite, Task } from './definitions';

// ── Experiment ──

/** The six pipeline steps, in order. */
export const PIPELINE_STEPS = ['load', 'plan', 'prepare', 'execute', 'score', 'compare'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export type ExperimentStatus = 'running' | 'completed' | 'failed';

/** Agent that produced the runs; "simulated" makes no model calls. */
export type AgentKind = 'hermes' | 'simulated';

export interface CreateExperimentRequest {
  name?: string;
  suiteId: string;
  configIds: string[];
  /** Config others are compared against; defaults to configIds[0]. */
  baselineConfigId?: string;
  /** Repetitions per (task, config) pair. */
  trials: number;
}

/** status.json: live progress. */
export interface ExperimentStatusFile {
  id: string;
  name: string;
  suiteId: string;
  configIds: string[];
  baselineConfigId: string;
  trials: number;
  agent: AgentKind;
  status: ExperimentStatus;
  currentStep: PipelineStep | null;
  runsTotal: number;
  runsFinished: number;
  estimatedCostUsd: number;
  spentUsd: number;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
  /** Times broken runs were retried. */
  retries: number;
}

/** 1-definitions.json: frozen definitions. */
export interface DefinitionsSnapshot {
  suite: Suite;
  configs: AgentConfig[];
  /** Skill name → SKILL.md text. */
  skills: Record<string, string>;
  /** Memory seed path → text. */
  memories: Record<string, string>;
}

/** One row of 2-plan.json. */
export interface PlannedRun {
  runId: string;
  taskId: string;
  configId: string;
  trial: number;
}

export interface PlanFile {
  runs: PlannedRun[];
  estimatedCostUsd: number;
}

// ── One run (step 4 output) ──

export type RunStatus = 'pending' | 'running' | 'done' | 'timeout' | 'error';

/** runs/<id>/result.json */
export interface RunResult {
  runId: string;
  status: Exclude<RunStatus, 'pending' | 'running'>;
  finalAnswer: string;
  exitCode: number | null;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** "hermes" if reported by Hermes, else estimated from tokens × price. */
  costSource: 'hermes' | 'estimated';
  /** Model calls (one per agent-loop iteration). */
  apiCalls: number;
  toolCalls: number;
  error: string | null;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON arguments string. */
  arguments: string;
}

/** One line of runs/<id>/trajectory.jsonl */
export interface TrajectoryStep {
  seq: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls: ToolCall[];
  /** For role "tool": the tool and the call it answers. */
  toolName: string | null;
  toolCallId: string | null;
  reasoning: string | null;
  timestamp: number;
}

// ── Scoring (step 5 output) ──

export interface OutcomeCheckResult {
  id: string;
  type: OutcomeCheck['type'];
  /** 0..1 */
  score: number;
  passed: boolean;
  explanation: string;
}

export interface ProcessFlag {
  id: ProcessCheckId;
  /** false = warning. */
  ok: boolean;
  explanation: string;
}

export interface RunMetrics {
  costUsd: number;
  durationMs: number;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
}

/** runs/<id>/score.json, and one row of 5-scores.json */
export interface RunScore {
  runId: string;
  taskId: string;
  configId: string;
  trial: number;
  runStatus: RunResult['status'];
  /** Mean of outcome checks (0 for broken runs). */
  score: number;
  passed: boolean;
  outcomeChecks: OutcomeCheckResult[];
  /** Efficiency metrics. */
  metrics: RunMetrics;
  /** Process warnings. */
  processFlags: ProcessFlag[];
}

// ── Comparison (step 6 output) ──

export type Verdict = 'better' | 'worse' | 'inconclusive';
export type ComparedMetric = 'score' | 'costUsd' | 'durationMs';

/** Paired comparison of one metric: candidate config vs baseline. */
export interface MetricComparison {
  metric: ComparedMetric;
  baselineMean: number;
  candidateMean: number;
  /** candidate − baseline, averaged over tasks */
  delta: number;
  ciLow: number;
  ciHigh: number;
  /** User-facing verdict; lower is better for cost and time. */
  verdict: Verdict;
}

/** How one task moved for a candidate vs the baseline. */
export type TaskChange = 'improved' | 'regressed' | 'unchanged';

export interface TaskDiff {
  taskId: string;
  baselineMean: number;
  candidateMean: number;
  delta: number;
  change: TaskChange;
}

export interface ConfigComparison {
  configId: string;
  score: MetricComparison;
  costUsd: MetricComparison;
  durationMs: MetricComparison;
  /** Task counts by change. */
  improved: number;
  regressed: number;
  unchanged: number;
  taskDiffs: TaskDiff[];
  /** Rough trials per task to settle an inconclusive verdict; null if unlikely to help. */
  trialsToResolve: number | null;
}

export interface ConfigSummary {
  configId: string;
  meanScore: number;
  passRate: number;
  meanCostUsd: number;
  meanDurationMs: number;
  /** pass^k: fraction of tasks where every trial passed. */
  passAllRate: number;
  /** Tasks with mixed pass/fail trials. */
  flakyTasks: number;
  runs: number;
  /** Runs that timed out or errored. */
  brokenRuns: number;
}

export interface TaskCell {
  configId: string;
  meanScore: number;
  passRate: number;
  /** Every trial passed. */
  passAll: boolean;
  /** Some trials passed, some failed. */
  flaky: boolean;
  brokenRuns: number;
  runs: { runId: string; trial: number; score: number; passed: boolean; runStatus: RunResult['status'] }[];
}

export interface TaskRow {
  taskId: string;
  cells: TaskCell[];
}

/** 6-report.json */
export interface Report {
  experimentId: string;
  baselineConfigId: string;
  configs: ConfigSummary[];
  comparisons: ConfigComparison[];
  tasks: TaskRow[];
  method: { iterations: number; confidence: number; seed: number };
}

// ── UI read models ──

export interface DefinitionsResponse {
  suites: { id: string; name: string; description: string; groups: Record<string, string>; taskIds: string[]; tasks: Task[] }[];
  configs: AgentConfig[];
  /** Files that failed validation. */
  errors: { file: string; message: string }[];
}

export interface PlannedRunWithStatus extends PlannedRun {
  status: RunStatus;
  score: number | null;
  passed: boolean | null;
}

export interface ExperimentDetail {
  status: ExperimentStatusFile;
  runs: PlannedRunWithStatus[];
  hasReport: boolean;
}

export interface WorkspaceFile {
  path: string;
  size: number;
  /** Change vs the original fixtures. */
  change: 'added' | 'modified' | 'unchanged';
}

/**
 * Live events streamed over SSE from GET /api/experiments/:id/events.
 * `run-step` carries each new trajectory step as Hermes writes it.
 */
export type ExperimentEvent =
  | { type: 'status'; status: ExperimentStatusFile }
  | { type: 'run-started'; runId: string; taskId: string; configId: string; trial: number }
  | { type: 'run-step'; runId: string; step: TrajectoryStep }
  | { type: 'run-finished'; runId: string; runStatus: RunResult['status']; score: number; passed: boolean };

export interface HealthResponse {
  apiKeyConfigured: boolean;
  hermesInstalled: boolean;
  hermesVersion: string | null;
  provider: string;
}

export interface RunDetail {
  run: PlannedRun;
  experimentId: string;
  agent: AgentKind;
  baselineConfigId: string;
  /** Baseline run with the same task and trial; null if this is the baseline. */
  baselineRunId: string | null;
  task: Task;
  config: AgentConfig;
  result: RunResult | null;
  score: RunScore | null;
  trajectory: TrajectoryStep[];
  workspace: WorkspaceFile[];
}
