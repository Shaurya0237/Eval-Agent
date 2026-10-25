/** DTO · Start-experiment / estimate request body. */
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const createExperimentSchema = z
  .object({
    name: z.string().max(120).optional(),
    suiteId: z.string().min(1),
    configIds: z.array(z.string().min(1)).min(2, 'pick at least two configs to compare'),
    baselineConfigId: z.string().optional(),
    trials: z.number().int().min(1).max(20),
    /** Use the simulated agent (no model calls). */
    simulated: z.boolean().optional(),
  })
  .refine((r) => new Set(r.configIds).size === r.configIds.length, 'configs must be unique')
  .refine((r) => !r.baselineConfigId || r.configIds.includes(r.baselineConfigId), 'baseline must be one of the chosen configs');

export type CreateExperimentDto = z.infer<typeof createExperimentSchema>;

/** Validate a request body; throw 400 on failure. */
export function parseCreateExperiment(body: unknown): CreateExperimentDto {
  const parsed = createExperimentSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
  return parsed.data;
}
