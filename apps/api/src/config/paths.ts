/** On-disk paths, all derived from the repo root (found via pnpm-workspace.yaml). */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function findRepoRoot(start: string): string {
  let dir = start;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
  throw new Error(`Could not find repo root (pnpm-workspace.yaml) above ${start}`);
}

export const REPO_ROOT = process.env.EVAL_ROOT ?? findRepoRoot(__dirname);

export const paths = {
  root: REPO_ROOT,
  /** Authored definitions (YAML + markdown). */
  suites: join(REPO_ROOT, 'suites'),
  configs: join(REPO_ROOT, 'configs'),
  skills: join(REPO_ROOT, 'skills'),
  /** Pipeline output (gitignored). */
  experiments: join(REPO_ROOT, 'data', 'experiments'),
  /** Built web app, served in production. */
  webDist: join(REPO_ROOT, 'apps', 'web', 'dist'),
  /** Pinned Hermes installed by `pnpm start`. */
  hermesBin:
    process.env.EVAL_HERMES_BIN ??
    join(REPO_ROOT, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'hermes.exe' : 'hermes'),
  hermesVersionMarker: join(REPO_ROOT, '.venv', '.hermes-version'),
  /** Scripted Hermes stand-in for tests and demos (no model calls). */
  simulatedHermesBin: join(REPO_ROOT, 'apps', 'api', 'simulator', 'simulated-hermes.mjs'),
};
