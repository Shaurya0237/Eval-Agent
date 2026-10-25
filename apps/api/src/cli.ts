/**
 * CLI: runs the pipeline for CI (`pnpm eval:ci`) or the simulated demo (`pnpm demo`).
 * Exits 1 when a config is "worse" than baseline (or not "better" with --fail-on inconclusive).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { ExperimentRepository } from './models/experiment.repository';
import { PipelineRunner } from './services/pipeline-runner.service';

interface CliArgs {
  suite: string;
  configs: string[];
  baseline?: string;
  trials: number;
  name?: string;
  failOn: 'worse' | 'inconclusive';
  simulated: boolean;
}

/** Parse CLI flags; `--demo` fills in sample-suite defaults. */
function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const simulated = argv.includes('--demo') || argv.includes('--simulated');
  const configs = (get('--configs') ?? (simulated ? 'baseline,open-book,mapping-skill' : '')).split(',').filter(Boolean);
  const suite = get('--suite') ?? (simulated ? 'indian-criminal-law' : '');
  if (!suite || configs.length < 2) {
    console.error(
      'Usage: pnpm eval:ci --suite <id> --configs <baseline>,<candidate>[,...] [--trials N] [--baseline id] [--name text] [--fail-on worse|inconclusive] [--demo]',
    );
    process.exit(2);
  }
  const failOn = get('--fail-on') === 'inconclusive' ? 'inconclusive' : 'worse';
  return {
    suite,
    configs,
    baseline: get('--baseline'),
    trials: Number(get('--trials') ?? 3),
    name: get('--name') ?? (simulated ? 'Demo · simulated agent' : undefined),
    failOn,
    simulated,
  };
}

const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const pipeline = app.get(PipelineRunner);
  const experiments = app.get(ExperimentRepository);

  const started = await pipeline.start(
    { suiteId: args.suite, configIds: args.configs, baselineConfigId: args.baseline, trials: args.trials, name: args.name },
    args.simulated ? { agent: 'simulated' } : {},
  );
  console.log(`▶ Experiment ${started.id}${args.simulated ? ' (SIMULATED agent)' : ''}`);

  const ticker = setInterval(async () => {
    const s = await experiments.findStatus(started.id);
    if (s?.runsTotal) process.stdout.write(`\r  runs ${s.runsFinished}/${s.runsTotal}`);
  }, 1000);
  const status = await pipeline.waitFor(started.id);
  clearInterval(ticker);
  process.stdout.write('\n');

  if (status.status !== 'completed') {
    console.error(`✖ Experiment failed: ${status.error}`);
    await app.close();
    process.exit(1);
  }

  const report = (await experiments.findReport(started.id))!;
  console.log(`\nVerdicts vs baseline "${report.baselineConfigId}" (score Δ in points, 95% CI):`);
  let gateFailed = false;
  for (const c of report.comparisons) {
    const s = c.score;
    const fails = s.verdict === 'worse' || (args.failOn === 'inconclusive' && s.verdict !== 'better');
    gateFailed ||= fails;
    console.log(
      `  ${fails ? '✖' : '✓'} ${c.configId.padEnd(18)} ${s.verdict.padEnd(13)} Δ ${pct(s.delta)} [${pct(s.ciLow)}, ${pct(s.ciHigh)}]` +
        `  ▲${c.improved} ▼${c.regressed} =${c.unchanged}`,
    );
  }
  const spent =
    status.agent === 'simulated'
      ? `Simulated: nothing billed (a real run would cost ≈ $${status.spentUsd.toFixed(2)})`
      : `Spent $${status.spentUsd.toFixed(4)}`;
  console.log(`\n${spent} · open http://localhost:3000/experiments/${started.id} (with the server running)`);
  await app.close();
  if (gateFailed) {
    console.error(`\n✖ Regression gate failed (--fail-on ${args.failOn}).`);
    process.exit(1);
  }
}

void main();
