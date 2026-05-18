import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Full-replace edit-profile payload. Mirrors the frontend zod schema
 * (edit-profile.schema.ts) 1:1 — the form always submits every field, so
 * this is a PUT-style replace, not a sparse patch. `name` is persisted to
 * User; the rest to Profile.
 */
export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60, 'Max 60 chars'),
  bio: z.string().max(160, 'Max 160 chars').default(''),
  location: z.string().min(1, 'Location is required'),
  work: z.string().default(''),
  education: z.string().default(''),
  relationship: z.string().default(''),
  avatarUrl: z.string().default(''),
  coverUrl: z.string().default(''),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
