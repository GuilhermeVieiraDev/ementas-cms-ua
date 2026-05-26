import { z } from 'zod';

import { diffDaysInclusive, isValidIsoDate } from '../../lib/dates.js';

const includeAnomaliesSchema = z
  .union([
    z.boolean(),
    z
      .enum(['true', 'false', '1', '0'])
      .transform((value) => value === 'true' || value === '1'),
  ])
  .optional()
  .default(false);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Date must use YYYY-MM-DD format')
  .refine(isValidIsoDate, 'Invalid ISO date');

export const menusQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    canteens: z.string().optional(),
    includeAnomalies: includeAnomaliesSchema,
  })
  .transform((value) => {
    return {
      from: value.from,
      to: value.to,
      canteens: value.canteens
        ?.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      includeAnomalies: value.includeAnomalies,
    };
  })
  .superRefine((value, context) => {
    if (!value.from && !value.to) return;

    const from = value.from ?? value.to;
    const to = value.to ?? value.from;
    if (!from || !to) return;

    if (from > to) {
      context.addIssue({
        code: 'custom',
        message: '`from` must be before or equal to `to`',
        path: ['from'],
      });
    }

    if (diffDaysInclusive(from, to) > 31) {
      context.addIssue({
        code: 'custom',
        message: 'Date range cannot exceed 31 days',
        path: ['to'],
      });
    }
  });
