import { z } from 'zod';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 30;

/** Cursor + limit arrive as query strings; coerce + bound here. */
export const listMessagesQuerySchema = z.object({
  cursor: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
      message: 'cursor must be a positive epoch-ms number',
    }),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : DEFAULT_LIMIT))
    .refine((v) => Number.isInteger(v) && v > 0 && v <= MAX_LIMIT, {
      message: `limit must be 1..${MAX_LIMIT}`,
    }),
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
