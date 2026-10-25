/** VIEW · One run's models → run inspector response. */
import type {
  AgentKind,
  DefinitionsSnapshot,
  PlanFile,
  PlannedRun,
  RunDetail,
  RunResult,
  RunScore,
  TrajectoryStep,
  WorkspaceFile,
} from '@eval-lab/shared';

export interface RunViewInput {
  experimentId: string;
  agent: AgentKind;
  baselineConfigId: string;
  run: PlannedRun;
  plan: PlanFile;
  snapshot: DefinitionsSnapshot;
  result: RunResult | null;
  score: RunScore | null;
  trajectory: TrajectoryStep[];
  workspace: WorkspaceFile[];
}

export function toRunDetail(input: RunViewInput): RunDetail {
  const { run, plan, snapshot } = input;
  // Baseline run with the same task + trial.
  const baselineRun = plan.runs.find((r) => r.taskId === run.taskId && r.trial === run.trial && r.configId === input.baselineConfigId);
  return {
    run,
    experimentId: input.experimentId,
    agent: input.agent,
    baselineConfigId: input.baselineConfigId,
    baselineRunId: baselineRun && baselineRun.runId !== run.runId ? baselineRun.runId : null,
    task: snapshot.suite.tasks.find((t) => t.id === run.taskId)!,
    config: snapshot.configs.find((c) => c.id === run.configId)!,
    result: input.result,
    score: input.score,
    trajectory: input.trajectory,
    workspace: input.workspace,
  };
}
