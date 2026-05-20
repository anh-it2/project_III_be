import { Prisma } from '@prisma/client';

// Shared Prisma selects/types for the post module. Kept in one tiny file so
// post.model / post-reaction.model / post-comment.model don't duplicate the
// author join or the per-viewer reaction include (and don't import each
// other just for a type).

/**
 * author name/avatar are read live from User/Profile (NOT denormalized onto
 * Post) so renaming or changing an avatar updates every past post with no
 * backfill — the same trade-off Profile makes for the edit page.
 */
export const AUTHOR_SELECT = {
  select: {
    id: true,
    name: true,
    profile: { select: { avatarUrl: true } },
  },
} as const;

// `reactions` is filtered to the viewer at query time (the WHERE is added
// per-request by postInclude); the type only needs the shape, so the static
// include here omits the filter. `hashtags` always pulled — small list per
// post, used by toPostDTO to set `tags`.
const POST_INCLUDE = {
  author: AUTHOR_SELECT,
  reactions: { select: { emoji: true } },
  hashtags: { include: { hashtag: { select: { tag: true } } } },
} as const;

export type PostRow = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

/** Post read include scoped to one viewer (powers "my reaction"). */
export function postInclude(viewerId: string) {
  return {
    author: AUTHOR_SELECT,
    reactions: { where: { userId: viewerId }, select: { emoji: true } },
    hashtags: { include: { hashtag: { select: { tag: true } } } },
  };
}

// Json columns: Prisma rejects `undefined`; use DbNull to clear, or the
// JSON value to set. Build the field only when meaningful.
export function jsonWrite(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
