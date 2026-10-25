import { describe, expect, it } from 'vitest';
import { cliCommand, emptyForm, toRequest, toggleConfig, validateForm } from './newRun.logic';

const base = { ...emptyForm(), suiteId: 'indian-criminal-law', configIds: ['baseline', 'mapping-skill'], baselineConfigId: 'baseline' };

describe('validateForm', () => {
  it('accepts a complete form', () => expect(validateForm(base, true)).toBeNull());
  it('requires two configs and a selected baseline', () => {
    expect(validateForm({ ...base, configIds: ['baseline'] }, true)).toMatch(/two configs/);
    expect(validateForm({ ...base, baselineConfigId: 'other' }, true)).toMatch(/baseline/);
  });
  it('blocks the real agent without a key but allows the simulated one', () => {
    expect(validateForm(base, false)).toMatch(/OPENAI_API_KEY/);
    expect(validateForm({ ...base, agent: 'simulated' }, false)).toBeNull();
  });
});

describe('toggleConfig', () => {
  it('keeps the baseline valid when it is deselected', () => {
    const next = toggleConfig(base, 'baseline');
    expect(next.configIds).toEqual(['mapping-skill']);
    expect(next.baselineConfigId).toBe('mapping-skill');
  });
});

describe('cliCommand', () => {
  it('lists the baseline first and adds --demo for the simulated agent', () => {
    const form = { ...base, configIds: ['mapping-skill', 'baseline'], agent: 'simulated' as const };
    expect(cliCommand(form)).toBe('pnpm eval:ci --suite indian-criminal-law --configs baseline,mapping-skill --trials 3 --demo');
  });
});

describe('toRequest', () => {
  it('maps the agent choice to the simulated flag', () => {
    expect(toRequest({ ...base, agent: 'simulated' }).simulated).toBe(true);
    expect(toRequest(base).name).toBeUndefined();
  });
});
