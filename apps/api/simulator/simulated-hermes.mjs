#!/usr/bin/env node
/**
 * Simulated `hermes` CLI (no model calls) mimicking `hermes -z` and `hermes sessions export`.
 * It looks up the task by prompt in suites/*, then answers right or wrong depending on what the
 * config gives the agent (file tools, the mapping skill, a stronger model).
 * Deterministic by default (tests); SIMULATED_HERMES_MODE=demo adds seeded randomness and live steps.
 * Prompts containing "SLEEP" hang and "CRASH" exit non-zero (timeout / error tests).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const home = process.env.HERMES_HOME;
const DEMO = process.env.SIMULATED_HERMES_MODE === 'demo';
const sessionFile = join(home, 'simulated-session.json');
const args = process.argv.slice(2);

if (args[0] === 'sessions' && args[1] === 'export') {
  writeFileSync(args[2], existsSync(sessionFile) ? readFileSync(sessionFile, 'utf8') + '\n' : '');
  process.exit(0);
}

const prompt = args[args.indexOf('-z') + 1];
const model = args[args.indexOf('-m') + 1];
const toolsets = (args[args.indexOf('-t') + 1] ?? '').split(',');

if (prompt.includes('CRASH')) {
  process.stderr.write('boom\n');
  process.exit(3);
}
if (prompt.includes('SLEEP')) setInterval(() => {}, 1000);
else await main();

/** Script one plausible run and write its session. */
async function main() {
  // Seed by run folder + attempt so trials differ and retries draw fresh.
  const rand = rngFor(`${home}#${process.env.SIMULATED_HERMES_ATTEMPT ?? 0}`);
  const chance = (p) => (DEMO ? rand() < p : p >= 0.5); // deterministic: likely events always happen
  const t0 = Date.now() / 1000;
  const messages = [{ role: 'user', content: prompt, timestamp: t0 }];
  let callNo = 0;

  /** Record one tool call and its result. */
  const tool = (name, argsObj, result, thought = '') => {
    const id = `call_${++callNo}`;
    const fn = { name, arguments: JSON.stringify(argsObj) };
    messages.push({
      role: 'assistant',
      content: thought,
      tool_calls: JSON.stringify([{ id, type: 'function', function: fn }]),
      timestamp: t0 + callNo,
    });
    messages.push({ role: 'tool', content: result, tool_name: name, tool_call_id: id, timestamp: t0 + callNo + 0.5 });
  };

  // A small share of demo runs hit an "API failure", like a real provider hiccup.
  if (DEMO && rand() < 0.03) {
    writeSession(messages, { input: 0, output: 0, apiCalls: 0 });
    process.stdout.write('API call failed after 3 retries: Connection error.\n');
    return;
  }

  const task = findTask(prompt);
  const answer = task ? answerFor(task, { rand, chance, tool }) : '{"answer": "unknown"}';
  messages.push({ role: 'assistant', content: answer, timestamp: t0 + callNo + 1 });

  // Demo: write messages to state.db one by one, like real Hermes, so they stream live.
  const strong = !model.includes('mini');
  if (DEMO) await streamToSessionDb(messages, () => (strong ? 260 : 160) + rand() * 260);
  const input = Math.round((strong ? 30_000 : 34_000) + (DEMO ? rand() * 12_000 : 0));
  writeSession(messages, { input, output: Math.round(350 + (DEMO ? rand() * 700 : 0)), apiCalls: callNo + 1 });
  process.stdout.write(answer + '\n');
}

/**
 * Answer from the task's expected values, right with probability p.
 * p grows with what the config provides: file tools (search the Act), the IPC→BNS skill, a stronger model.
 * Wrong answers are realistic: the repealed IPC number, or a near miss.
 */
function answerFor(task, { rand, chance, tool }) {
  const expected = Object.assign({}, ...task.checks.filter((c) => c.type === 'answer_json').map((c) => c.expect));
  const transition = task.id.startsWith('map-') || task.id.startsWith('now-');
  let p = model.includes('mini') ? 0.4 : 0.6;

  if (toolsets.includes('file') && existsSync('bns-2023.txt')) {
    p = 0.9;
    const statute = readFileSync('bns-2023.txt', 'utf8').split('\n');
    const hit = expected.section ? statute.findIndex((l) => l.startsWith(`${expected.section}. `)) : -1;
    const lines = statute.slice(Math.max(hit, 0), Math.max(hit, 0) + 3).join('\n');
    tool(
      'search_files',
      { pattern: expected.section ? `^${expected.section}\\.` : 'imprisonment', path: 'bns-2023.txt' },
      JSON.stringify({ matches: lines }),
      'Let me search the Act.',
    );
  }
  if (transition && existsSync(join(home, 'skills', 'ipc-bns-mapping', 'SKILL.md'))) {
    tool(
      'skill_view',
      { name: 'ipc-bns-mapping' },
      JSON.stringify({ content: '# IPC → BNS mapping …' }),
      'There is an IPC → BNS mapping skill.',
    );
    p = Math.max(p, 0.93);
  }
  if (chance(p)) return JSON.stringify(expected);

  const ipc = /Section (\d+[A-Z]?) of the Indian Penal Code/.exec(task.prompt)?.[1];
  const stale = { 'now-murder-2025': 302, 'now-cheating-2025': 420 }[task.id];
  const wrong = { ...expected };
  if ('code' in wrong) wrong.code = 'IPC';
  if ('section' in wrong) wrong.section = ipc ? Number.parseInt(ipc, 10) : (stale ?? expected.section + 1 + Math.floor(rand() * 3));
  for (const k of ['maxYears', 'minYears'])
    if (k in wrong) wrong[k] = [1, 2, 3, 5, 7, 10].filter((y) => y !== expected[k])[Math.floor(rand() * 5)];
  if ('communityService' in wrong) wrong.communityService = !expected.communityService;
  return JSON.stringify(wrong);
}

/** Find the task (by prompt) in the repo's suites. */
function findTask(text) {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) dir = dirname(dir);
  for (const suite of readdirSync(join(dir, 'suites'))) {
    const file = join(dir, 'suites', suite, 'suite.yaml');
    if (!existsSync(file)) continue;
    const task = parseYaml(readFileSync(file, 'utf8')).tasks.find((t) => t.prompt.trim() === text.trim());
    if (task) return task;
  }
  return null;
}

/** Seeded RNG (FNV hash + mulberry32). */
function rngFor(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Insert messages into HERMES_HOME/state.db one at a time (Hermes's `messages` table shape). */
async function streamToSessionDb(messages, delayMs) {
  process.removeAllListeners('warning'); // silence node:sqlite's ExperimentalWarning
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(home, 'state.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, role TEXT, content TEXT, tool_calls TEXT,
    tool_name TEXT, tool_call_id TEXT, reasoning TEXT, timestamp REAL)`);
  const insert = db.prepare(
    'INSERT INTO messages (session_id, role, content, tool_calls, tool_name, tool_call_id, reasoning, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const m of messages) {
    await new Promise((r) => setTimeout(r, delayMs()));
    insert.run(
      'simulated',
      m.role,
      m.content ?? '',
      m.tool_calls ?? null,
      m.tool_name ?? null,
      m.tool_call_id ?? null,
      null,
      Date.now() / 1000,
    );
  }
  db.close();
}

/** Write the session that `hermes sessions export` returns. */
function writeSession(messages, usage) {
  const session = {
    id: 'simulated',
    source: 'cli',
    started_at: messages[0].timestamp,
    model,
    system_prompt: '[SIMULATED AGENT: no model was called]\nYou are Hermes Agent...',
    input_tokens: usage.input,
    output_tokens: usage.output,
    api_call_count: usage.apiCalls,
    tool_call_count: messages.filter((m) => m.role === 'tool').length,
    actual_cost_usd: null,
    estimated_cost_usd: null,
    messages,
  };
  writeFileSync(sessionFile, JSON.stringify(session));
}
