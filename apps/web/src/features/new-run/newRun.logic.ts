/** New-run logic: form → request, validation, CLI equivalent. */
import type { AgentKind } from '@eval-lab/shared';
import type { LaunchRequest } from '../../api';

export interface NewRunFormState {
  name: string;
  suiteId: string;
  configIds: string[];
  baselineConfigId: string;
  trials: number;
  /** "hermes" = real agent (needs a key); "simulated" = scripted, no model calls. */
  agent: AgentKind;
}

export function emptyForm(): NewRunFormState {
  return { name: '', suiteId: '', configIds: [], baselineConfigId: '', trials: 3, agent: 'hermes' };
}

/** What's missing, or null when submittable. */
export function validateForm(form: NewRunFormState, apiKeyConfigured: boolean): string | null {
  if (!form.suiteId) return 'Select a suite.';
  if (form.configIds.length < 2) return 'Select at least two configs.';
  if (!form.configIds.includes(form.baselineConfigId)) return 'Mark one selected config as the baseline.';
  if (!Number.isInteger(form.trials) || form.trials < 1 || form.trials > 20) return 'Trials must be 1–20.';
  if (form.agent === 'hermes' && !apiKeyConfigured) return 'OPENAI_API_KEY is not set. Use the simulated agent, or add the key to .env.';
  return null;
}

export function toRequest(form: NewRunFormState): LaunchRequest {
  return {
    name: form.name.trim() || undefined,
    suiteId: form.suiteId,
    configIds: form.configIds,
    baselineConfigId: form.baselineConfigId,
    trials: form.trials,
    simulated: form.agent === 'simulated',
  };
}

/** Toggle a config, keeping the baseline valid. */
export function toggleConfig(form: NewRunFormState, id: string): NewRunFormState {
  const configIds = form.configIds.includes(id) ? form.configIds.filter((c) => c !== id) : [...form.configIds, id];
  const baselineConfigId = configIds.includes(form.baselineConfigId) ? form.baselineConfigId : (configIds[0] ?? '');
  return { ...form, configIds, baselineConfigId };
}

/** Equivalent `pnpm eval:ci` command, baseline first. */
export function cliCommand(form: NewRunFormState): string {
  const configs = [form.baselineConfigId, ...form.configIds.filter((c) => c !== form.baselineConfigId)].filter(Boolean);
  const parts = [
    'pnpm eval:ci',
    `--suite ${form.suiteId || '<suite>'}`,
    `--configs ${configs.join(',') || '<a>,<b>'}`,
    `--trials ${form.trials}`,
  ];
  if (form.name.trim()) parts.push(`--name "${form.name.trim().replace(/"/g, '\\"')}"`);
  if (form.agent === 'simulated') parts.push('--demo');
  return parts.join(' ');
}
