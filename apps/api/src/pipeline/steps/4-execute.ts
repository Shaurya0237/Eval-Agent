/**
 * STEP 4 · EXECUTE: run `hermes -z` on one task (headless), then
 * `hermes sessions export` to get the trajectory, tokens and cost.
 * While it runs, new steps are streamed from the session DB via `onStep`.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentConfig, RunResult, Task, TrajectoryStep } from '@eval-lab/shared';
import { runProcess } from '../../infrastructure/hermes/hermes-process';
import { parseSession, pickRunSession, type HermesExportedSession } from '../../infrastructure/hermes/hermes-session';
import { watchSessionSteps } from '../../infrastructure/hermes/session-watcher';
import { API_KEY_ENV, HERMES_PROVIDER } from '../../config/model-provider';
import type { RunPaths } from '../../infrastructure/storage/experiment-layout';

export interface ExecuteContext {
  hermesBin: string;
  apiKey: string;
  /** CA bundle for TLS-intercepting proxies. */
  caBundle?: string;
  /** Extra env for the agent process. */
  extraEnv?: Record<string, string>;
}

/** Build Hermes's env, pointing HERMES_HOME at this run's private home. */
function hermesEnv(ctx: ExecuteContext, run: RunPaths): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Drop the user's own Hermes settings and other provider keys.
  for (const key of Object.keys(env)) if (key.startsWith('HERMES_') || key === 'OPENROUTER_API_KEY') delete env[key];
  env.HERMES_HOME = run.home;
  env[API_KEY_ENV] = ctx.apiKey;
  Object.assign(env, ctx.extraEnv);
  if (ctx.caBundle) {
    env.SSL_CERT_FILE = ctx.caBundle;
    env.REQUESTS_CA_BUNDLE = ctx.caBundle;
  }
  return env;
}

/** Run one task and return its result and trajectory. */
export async function executeRun(
  ctx: ExecuteContext,
  task: Task,
  config: AgentConfig,
  runId: string,
  run: RunPaths,
  onStep?: (step: TrajectoryStep) => void,
): Promise<{ result: RunResult; trajectory: TrajectoryStep[] }> {
  const env = hermesEnv(ctx, run);

  // ── Run (streaming steps live, if anyone listens) ──
  const args = ['-z', task.prompt, '-m', config.model, '--provider', HERMES_PROVIDER, '-t', config.toolsets.join(',')];
  const stopWatching = onStep ? watchSessionSteps(join(run.home, 'state.db'), onStep) : null;
  const proc = await runProcess(ctx.hermesBin, args, { cwd: run.workspace, env, timeoutMs: task.timeoutSec * 1000 });
  stopWatching?.();
  await writeFile(
    run.log,
    `$ hermes ${args.map((a) => JSON.stringify(a)).join(' ')}\n\n--- exit code: ${proc.exitCode} (timed out: ${proc.timedOut})\n--- stdout\n${proc.stdout}\n--- stderr\n${proc.stderr}\n`,
  );

  // ── Export session (also after timeout, for partial trajectories) ──
  const exp = await runProcess(ctx.hermesBin, ['sessions', 'export', run.sessionExport], {
    cwd: run.workspace,
    env,
    timeoutMs: 30_000,
  });
  let session: HermesExportedSession | null = null;
  try {
    const lines = (await readFile(run.sessionExport, 'utf8')).split('\n').filter((l) => l.trim());
    session = pickRunSession(lines.map((l) => JSON.parse(l) as HermesExportedSession));
  } catch {
    await appendFile(run.log, `\n--- session export failed\n${exp.stdout}\n${exp.stderr}\n`);
  }
  const parsed = session ? parseSession(session) : null;

  // ── Outcome: `hermes -z` exits 0 even on API failure, so also require an answer ──
  const finalAnswer = parsed?.finalAnswer || proc.stdout.trim();
  let status: RunResult['status'] = 'done';
  let error: string | null = null;
  if (proc.timedOut) {
    status = 'timeout';
    error = `Killed after ${task.timeoutSec}s (task timeoutSec).`;
  } else if (proc.exitCode !== 0 || !parsed?.finalAnswer) {
    status = 'error';
    const output = `${proc.stdout}\n${proc.stderr}`.trim();
    error = output ? output.slice(-2000) : `Hermes exited with code ${proc.exitCode} and produced no answer.`;
  }

  // ── Cost: Hermes's number, else tokens × price ──
  const inputTokens = parsed?.inputTokens ?? 0;
  const outputTokens = parsed?.outputTokens ?? 0;
  const estimated = (inputTokens * config.price.inputPerMTok + outputTokens * config.price.outputPerMTok) / 1_000_000;

  const result: RunResult = {
    runId,
    status,
    finalAnswer: status === 'done' ? finalAnswer : '',
    exitCode: proc.exitCode,
    durationMs: proc.durationMs,
    inputTokens,
    outputTokens,
    costUsd: parsed?.costUsd ?? estimated,
    costSource: parsed?.costUsd != null ? 'hermes' : 'estimated',
    apiCalls: parsed?.apiCalls ?? 0,
    toolCalls: parsed?.toolCalls ?? 0,
    error,
  };

  return { result, trajectory: parsed?.trajectory ?? [] };
}
