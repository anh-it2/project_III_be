import { z } from 'zod';

/**
 * FE Feeling snapshot (shared/data/constants FEELINGS) — stored verbatim as
 * JSON. Validated so a malformed object can't poison the column.
 */
export const feelingSchema = z.object({
  id: z.string().min(1),
  emoji: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['feeling', 'activity']),
});

// SharedPostRef is an opaque, already-rendered snapshot the FE builds when
// resharing. It is display-only and never queried by field, so it is stored
// as-is. Bounded to keep a single row from blowing up (it embeds a post).
const sharedFromSchema = z.record(z.string(), z.unknown());

/**
 * Create payload. Author is taken from the JWT (never the body). Mirrors the
 * FE composer output minus the fields the server owns (id/author/counts/
 * timestamps). A post must carry at least one of text/media/feeling/share —
 * an entirely empty post is rejected (same rule as the FE `canSubmit`).
 */
export const createPostSchema = z
  .object({
    text: z.string().max(500).default(''),
    imageUrl: z.string().max(2048).optional(),
    videoUrl: z.string().max(2048).optional(),
    feeling: feelingSchema.nullish(),
    isLive: z.boolean().optional().default(false),
    sharedFrom: sharedFromSchema.nullish(),
  })
  .refine(
    (p) =>
      p.text.trim().length > 0 ||
      !!p.imageUrl ||
      !!p.videoUrl ||
      !!p.feeling ||
      !!p.sharedFrom,
    { message: 'Post is empty' },
  );

export type CreatePostInput = z.infer<typeof createPostSchema>;

/**
 * Edit payload — replaces the editable fields of an existing post. The FE
 * edit modal always submits text + current media + feeling, so this is a
 * full replace of those fields (null clears media/feeling), not a sparse
 * patch. Ownership is enforced in the service, not here.
 */
export const updatePostSchema = z.object({
  text: z.string().max(500).default(''),
  imageUrl: z.string().max(2048).nullish(),
  videoUrl: z.string().max(2048).nullish(),
  feeling: feelingSchema.nullish(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

/** Pin toggle body. `pinned:true` stamps pinnedAt=now, false clears it. */
export const pinPostSchema = z.object({
  pinned: z.boolean(),
});

export type PinPostInput = z.infer<typeof pinPostSchema>;

/** Reaction kinds — must stay byte-aligned with the FE ReactionId union. */
export const REACTION_EMOJIS = [
  'like',
  'love',
  'care',
  'haha',
  'wow',
  'sad',
  'angry',
] as const;

export const reactPostSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
});

export type ReactPostInput = z.infer<typeof reactPostSchema>;

/** A comment must carry text and/or an image (mirrors FE CommentInput). */
export const createCommentSchema = z
  .object({
    text: z.string().max(1000).default(''),
    imageUrl: z.string().max(2048).optional(),
  })
  .refine((c) => c.text.trim().length > 0 || !!c.imageUrl, {
    message: 'Comment is empty',
  });

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
