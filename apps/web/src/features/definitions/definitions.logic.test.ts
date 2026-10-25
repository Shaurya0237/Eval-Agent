import type { AgentConfig, Task } from '@eval-lab/shared';
import { describe, expect, it } from 'vitest';
import { configMatrix, expectedAnswer, groupTasks, shortQuestion } from './definitions.logic';

const task = (id: string, expect: Record<string, unknown>): Task => ({
  id,
  prompt: '',
  fixtures: 'f',
  timeoutSec: 60,
  passThreshold: 1,
  checks: [{ type: 'answer_json', expect }],
  processChecks: [],
});
const config = (id: string, over: Partial<AgentConfig> = {}): AgentConfig => ({
  id,
  description: '',
  model: 'm',
  toolsets: ['skills'],
  skills: [],
  memory: null,
  maxTurns: 12,
  price: { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  ...over,
});

describe('definitions logic', () => {
  it('strips answer-format boilerplate from the prompt', () => {
    const prompt = 'Which section?\n If you can read files, the Act is in x.txt. Reply with ONLY a JSON object: {"section": number}';
    expect(shortQuestion(prompt)).toBe('Which section?');
  });

  it('shows the expected answer in plain words', () => {
    expect(expectedAnswer(task('a', { code: 'BNS', maxYears: 10, communityService: true }))).toEqual([
      'code BNS',
      'max years 10',
      'community service yes',
    ]);
  });

  it('groups tasks by id prefix with readable labels', () => {
    const groups = groupTasks([task('sec-a', {}), task('pun-b', {}), task('sec-c', {})], { sec: 'Which section?' });
    expect(groups.map((g) => [g.label, g.tasks.length])).toEqual([
      ['Which section?', 2],
      ['pun', 1],
    ]);
  });

  it('splits config settings into differences and shared values', () => {
    const base = config('baseline');
    const { differs, shared } = configMatrix([base, config('skill', { skills: ['s'] })], base);
    expect(differs).toEqual([
      {
        label: 'Skills',
        cells: [
          { value: 'none', changed: false },
          { value: 's', changed: true },
        ],
      },
    ]);
    expect(shared.map((s) => s.label)).toContain('Model');
  });
});
