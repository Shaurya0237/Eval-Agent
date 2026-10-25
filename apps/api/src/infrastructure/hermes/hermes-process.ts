/** Runs the Hermes CLI as an isolated child process with a timeout. */
import { spawn } from 'node:child_process';

export interface ProcessOutcome {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface SpawnOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
}

/** Run a command to completion; kill it and its children after `timeoutMs`. */
export function runProcess(command: string, args: string[], options: SpawnOptions): Promise<ProcessOutcome> {
  return new Promise((resolve) => {
    const started = Date.now();
    const isJs = command.endsWith('.mjs') || command.endsWith('.js');
    const spawnCmd = isJs ? process.execPath : command;
    const spawnArgs = isJs ? [command, ...args] : args;

    // detached: own process group, so one kill reaches Hermes and its tool subprocesses.
    const child = spawn(spawnCmd, spawnArgs, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid && process.platform !== 'win32') {
          process.kill(-child.pid, 'SIGKILL');
        } else {
          child.kill('SIGKILL');
        }
      } catch {
        child.kill('SIGKILL');
      }
    }, options.timeoutMs);

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut, durationMs: Date.now() - started });
    };
    child.on('error', (err) => {
      stderr += `\n${err.message}`;
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}
