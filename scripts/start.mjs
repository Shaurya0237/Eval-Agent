#!/usr/bin/env node
/**
 * `pnpm start`: check prerequisites, install deps and pinned Hermes, build, and start the server.
 * Dependency-free so it runs before `pnpm install`.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pinned Hermes version. */
const HERMES_VERSION = '0.15.2';

const isWin = process.platform === 'win32';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENV = join(ROOT, '.venv');
const VENV_BIN = join(VENV, isWin ? 'Scripts' : 'bin');
const HERMES_BIN = join(VENV_BIN, isWin ? 'hermes.exe' : 'hermes');
const PYTHON_BIN = join(VENV_BIN, isWin ? 'python.exe' : 'python');
const VERSION_MARKER = join(VENV, '.hermes-version');

const step = (n, msg) => console.log(`\n\x1b[1m[${n}/6] ${msg}\x1b[0m`);
const fail = (msg) => {
  console.error(`\n\x1b[31m✖ ${msg}\x1b[0m\n`);
  process.exit(1);
};
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: isWin, ...opts });
  if (r.status !== 0) fail(`Command failed: ${cmd} ${args.join(' ')}`);
};

// ── 1. Prerequisites ──
step(1, 'Checking prerequisites');
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) fail(`Node ${process.versions.node} found; Node 22 or newer is required.`);

/** Find a Python ≥ 3.11 on PATH. */
function findPython() {
  for (const candidate of ['python3', 'python3.13', 'python3.12', 'python3.11', 'python']) {
    try {
      const v = execFileSync(candidate, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' }).trim();
      const [major, minor] = v.split('.').map(Number);
      if (major === 3 && minor >= 11) return { cmd: candidate, version: v };
    } catch {
      // not installed; try next
    }
  }
  return null;
}
const python = findPython();
if (!python) fail('Python 3.11+ is required (Hermes Agent needs it). Install it, e.g. `brew install python@3.12`.');
console.log(`  node ${process.versions.node} · python ${python.version} (${python.cmd})`);

// ── 2. Node dependencies ──
step(2, 'Node dependencies');
if (existsSync(join(ROOT, 'node_modules'))) console.log('  already installed');
else run('pnpm', ['install']);

// ── 3. Hermes in a private Python venv ──
step(3, `Hermes Agent ${HERMES_VERSION}`);
const installed = existsSync(VERSION_MARKER) ? readFileSync(VERSION_MARKER, 'utf8').trim() : null;
if (existsSync(HERMES_BIN) && installed === HERMES_VERSION) {
  console.log('  already installed in .venv');
} else {
  console.log('  installing into .venv (first run only, takes a minute)…');
  if (!existsSync(VENV)) run(python.cmd, ['-m', 'venv', VENV]);
  run(PYTHON_BIN, ['-m', 'pip', 'install', '--quiet', `hermes-agent==${HERMES_VERSION}`]);
  writeFileSync(VERSION_MARKER, HERMES_VERSION);
}

// ── 4. API key ──
step(4, 'Configuration (.env)');
const envFile = join(ROOT, '.env');
const env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
if (!/^OPENAI_API_KEY=\S+/m.test(env) && !process.env.OPENAI_API_KEY) {
  console.log('  \x1b[33m⚠ OPENAI_API_KEY is not set.\x1b[0m You can browse the UI, but not run experiments.');
  console.log('    Fix: cp .env.example .env, add your key, restart.');
} else {
  console.log('  OPENAI_API_KEY found');
}

// ── 5. Build ──
step(5, 'Building shared types, web UI and API');
run('pnpm', ['build']);

// ── 6. Start ──
step(6, 'Starting server');
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', join(ROOT, 'apps', 'api', 'dist', 'main.js')], {
  cwd: ROOT,
  stdio: 'inherit',
});
const stop = () => server.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
