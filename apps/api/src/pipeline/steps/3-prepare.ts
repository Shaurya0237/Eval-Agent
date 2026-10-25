/**
 * STEP 3 · PREPARE: create each run's private HERMES_HOME and a fresh workspace copy.
 * Isolation stops one run's memory/skills leaking into the next.
 */
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify as toYaml } from 'yaml';
import type { AgentConfig, DefinitionsSnapshot, Task } from '@eval-lab/shared';
import { HERMES_PROVIDER } from '../../config/model-provider';
import type { RunPaths } from '../../infrastructure/storage/experiment-layout';
import { fixtureDir } from './1-load';

/** Hermes's memory entry separator. */
const HERMES_MEMORY_DELIMITER = '\n§\n';

/** Build the config.yaml Hermes reads from HERMES_HOME. */
export function hermesConfigYaml(config: AgentConfig): string {
  return toYaml({
    model: { default: config.model, provider: HERMES_PROVIDER },
    agent: { max_turns: config.maxTurns },
    memory: {
      // Memory is on only when the config seeds it.
      memory_enabled: config.memory !== null,
      user_profile_enabled: false,
    },
    // Run commands locally in the workspace (process cwd).
    terminal: { backend: 'local', cwd: '.' },
  });
}

/** Convert "---"-separated seed memory to Hermes's "§" format. */
export function toHermesMemory(seed: string): string {
  return seed
    .split(/\n-{3,}\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(HERMES_MEMORY_DELIMITER);
}

/** Create one run's home (config, skills, memory) and workspace. */
export async function prepareRun(snapshot: DefinitionsSnapshot, task: Task, config: AgentConfig, run: RunPaths): Promise<void> {
  await mkdir(run.home, { recursive: true });
  await mkdir(run.workspace, { recursive: true });

  await writeFile(join(run.home, 'config.yaml'), hermesConfigYaml(config));

  // From the frozen snapshot, not the live files.
  for (const skill of config.skills) {
    const dir = join(run.home, 'skills', skill);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), snapshot.skills[skill]);
  }

  if (config.memory) {
    const memDir = join(run.home, 'memories');
    await mkdir(memDir, { recursive: true });
    await writeFile(join(memDir, 'MEMORY.md'), toHermesMemory(snapshot.memories[config.memory]));
  }

  // Copy, not link: agent edits must not leak into other runs.
  await cp(fixtureDir(snapshot.suite.id, task.fixtures), run.workspace, { recursive: true });
}
