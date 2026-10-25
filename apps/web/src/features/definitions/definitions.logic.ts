/** Definitions page logic: plain-language tasks, task groups, config differences. */
import type { AgentConfig, OutcomeCheck, Task } from '@eval-lab/shared';

/** "maxYears" → "max years". */
const words = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

const showValue = (v: unknown) => (typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'string' ? v : JSON.stringify(v));

/** One check in plain words, e.g. `section = 103`. */
export function describeCheck(check: OutcomeCheck): string {
  const tolerance = check.type !== 'answer_contains' && check.tolerance ? ` (±${check.tolerance})` : '';
  switch (check.type) {
    case 'answer_contains':
      return `answer mentions "${check.value}"`;
    case 'answer_json':
      return (
        Object.entries(check.expect)
          .map(([k, v]) => `${words(k)} = ${showValue(v)}`)
          .join(', ') + tolerance
      );
    case 'file_json':
      return `${check.path} holds the expected JSON${tolerance}`;
  }
}

/** The expected answer as short "label value" pairs, e.g. ["section 103", "max years 10"]. */
export function expectedAnswer(task: Task): string[] {
  return task.checks.flatMap((c) => {
    if (c.type === 'answer_json') return Object.entries(c.expect).map(([k, v]) => `${words(k)} ${showValue(v)}`);
    if (c.type === 'answer_contains') return [`"${c.value}"`];
    return [c.path];
  });
}

/** The question without answer-format boilerplate ("Reply with ONLY…", "If you can read files…"). */
export function shortQuestion(prompt: string): string {
  return prompt
    .replace(/\s+/g, ' ')
    .replace(/\s*Reply with\b.*$/i, '')
    .replace(/\s*If you can read files.*?\.(?=\s|$)/i, '')
    .trim();
}

export interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

/** Tasks grouped by id prefix (`sec-murder` → `sec`), in file order; labels from the suite's `groups`. */
export function groupTasks(tasks: Task[], labels: Record<string, string>): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const key = task.id.split('-')[0];
    if (!groups.has(key)) groups.set(key, { key, label: labels[key] ?? key, tasks: [] });
    groups.get(key)!.tasks.push(task);
  }
  return [...groups.values()];
}

/** Baseline config: "baseline" if present, else the first. */
export function pickBaseline(configs: AgentConfig[]): AgentConfig | undefined {
  return configs.find((c) => c.id === 'baseline') ?? configs[0];
}

const FIELDS: [string, (c: AgentConfig) => string][] = [
  ['Model', (c) => c.model],
  ['Tools', (c) => c.toolsets.join(', ')],
  ['Skills', (c) => c.skills.join(', ') || 'none'],
  ['Memory', (c) => c.memory ?? 'off'],
  ['Max turns', (c) => String(c.maxTurns)],
  ['Price per 1M tokens', (c) => `$${c.price.inputPerMTok} in / $${c.price.outputPerMTok} out`],
];

export interface MatrixRow {
  label: string;
  /** One cell per config; `changed` = differs from the baseline. */
  cells: { value: string; changed: boolean }[];
}

/** Settings that differ between configs (as a matrix) and those shared by all (as one list). */
export function configMatrix(
  configs: AgentConfig[],
  baseline: AgentConfig | undefined,
): { differs: MatrixRow[]; shared: { label: string; value: string }[] } {
  const differs: MatrixRow[] = [];
  const shared: { label: string; value: string }[] = [];
  for (const [label, get] of FIELDS) {
    const values = configs.map(get);
    if (new Set(values).size <= 1) shared.push({ label, value: values[0] ?? '' });
    else
      differs.push({
        label,
        cells: configs.map((c, i) => ({ value: values[i], changed: !!baseline && c.id !== baseline.id && values[i] !== get(baseline) })),
      });
  }
  return { differs, shared };
}
