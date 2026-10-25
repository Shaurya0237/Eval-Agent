/**
 * STEP 1 · LOAD: read and validate suite/config YAML, then freeze a copy.
 * Invalid files are reported, never thrown.
 */
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import { agentConfigSchema, suiteSchema, type AgentConfig, type DefinitionsSnapshot, type Suite } from '@eval-lab/shared';
import { paths } from '../../config/paths';

export interface LoadedDefinitions {
  suites: Map<string, Suite>;
  configs: Map<string, AgentConfig>;
  errors: { file: string; message: string }[];
}

/** Format zod issues as one line. */
function describeZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

/** Parse and validate one YAML file. */
async function loadYaml<T>(file: string, schema: z.ZodType<T>): Promise<{ value?: T; error?: string }> {
  try {
    const parsed = schema.safeParse(parseYaml(await readFile(file, 'utf8')));
    return parsed.success ? { value: parsed.data } : { error: describeZodError(parsed.error) };
  } catch (err) {
    return { error: `Could not read YAML: ${(err as Error).message}` };
  }
}

/** Load every suite and config; invalid files go to `errors`. */
export async function loadDefinitions(): Promise<LoadedDefinitions> {
  const out: LoadedDefinitions = { suites: new Map(), configs: new Map(), errors: [] };
  const rel = (f: string) => relative(paths.root, f);

  // suites/<folder>/suite.yaml
  const suiteDirs = existsSync(paths.suites) ? readdirSync(paths.suites, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
  for (const dir of suiteDirs) {
    const file = join(paths.suites, dir.name, 'suite.yaml');
    if (!existsSync(file)) continue;
    const { value, error } = await loadYaml(file, suiteSchema);
    if (!value) {
      out.errors.push({ file: rel(file), message: error ?? 'invalid' });
      continue;
    }
    // Cross-checks: unique task ids, fixture folders exist.
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const task of value.tasks) {
      if (seen.has(task.id)) problems.push(`duplicate task id "${task.id}"`);
      seen.add(task.id);
      if (!existsSync(join(paths.suites, dir.name, task.fixtures)))
        problems.push(`task "${task.id}": fixtures folder "${task.fixtures}" not found`);
    }
    if (problems.length) out.errors.push({ file: rel(file), message: problems.join('; ') });
    else out.suites.set(value.id, value);
  }

  // configs/<id>.yaml
  const configFiles = existsSync(paths.configs) ? readdirSync(paths.configs).filter((f) => /\.ya?ml$/.test(f)) : [];
  for (const name of configFiles) {
    const file = join(paths.configs, name);
    const { value, error } = await loadYaml(file, agentConfigSchema);
    if (!value) {
      out.errors.push({ file: rel(file), message: error ?? 'invalid' });
      continue;
    }
    const problems: string[] = [];
    for (const skill of value.skills) {
      if (!existsSync(join(paths.skills, skill, 'SKILL.md')))
        problems.push(`skill "${skill}" not found (expected skills/${skill}/SKILL.md)`);
    }
    if (value.memory && !existsSync(join(paths.root, value.memory))) problems.push(`memory file "${value.memory}" not found`);
    if (problems.length) out.errors.push({ file: rel(file), message: problems.join('; ') });
    else out.configs.set(value.id, value);
  }

  return out;
}

/** Snapshot one suite + configs, including skill and memory text. */
export async function freezeDefinitions(defs: LoadedDefinitions, suiteId: string, configIds: string[]): Promise<DefinitionsSnapshot> {
  const suite = defs.suites.get(suiteId);
  if (!suite) throw new Error(`Unknown or invalid suite "${suiteId}"`);
  const configs = configIds.map((id) => {
    const config = defs.configs.get(id);
    if (!config) throw new Error(`Unknown or invalid config "${id}"`);
    return config;
  });

  const skills: Record<string, string> = {};
  const memories: Record<string, string> = {};
  for (const config of configs) {
    for (const skill of config.skills) skills[skill] ??= await readFile(join(paths.skills, skill, 'SKILL.md'), 'utf8');
    if (config.memory) memories[config.memory] ??= await readFile(join(paths.root, config.memory), 'utf8');
  }
  return { suite, configs, skills, memories };
}

/** Absolute path of a task's fixture folder. */
export function fixtureDir(suiteId: string, fixtures: string): string {
  return join(paths.suites, suiteId, fixtures);
}
