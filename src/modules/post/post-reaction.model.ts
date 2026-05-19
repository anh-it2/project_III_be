import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { postInclude, type PostRow } from './post.shared.js';
import type { ReactPostInput } from './post.validation.js';

/** emoji (FE ReactionId) → the denormalized counter column on Post. */
const COUNT_COL = {
  like: 'likeCount',
  love: 'loveCount',
  care: 'careCount',
  haha: 'hahaCount',
  wow: 'wowCount',
  sad: 'sadCount',
  angry: 'angryCount',
} as const;

type ReactionEmoji = keyof typeof COUNT_COL;

function counterDelta(
  emoji: ReactionEmoji,
  by: 1 | -1,
): Prisma.PostUpdateInput {
  return { [COUNT_COL[emoji]]: { increment: by } } as Prisma.PostUpdateInput;
}

function withViewer(postId: string, viewerId: string): Promise<PostRow> {
  return prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: postInclude(viewerId),
  });
}

/**
 * PostReaction is the source of truth (one row per user per post); the
 * Post.<kind>Count columns are denormalized totals kept in lock-step within
 * the SAME transaction so the feed read needs no aggregation.
 */
export const reactionStore = {
  /**
   * Upsert the viewer's reaction. Idempotent (same emoji again = no-op).
   * Swapping emoji is `-old +new` in one transaction. Returns the post with
   * the viewer's reaction included.
   */
  async react(
    postId: string,
    userId: string,
    input: ReactPostInput,
  ): Promise<PostRow> {
    const emoji = input.emoji;
    const existing = await prisma.postReaction.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { emoji: true },
    });

    if (existing?.emoji === emoji) return withViewer(postId, userId);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.postReaction.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId, emoji },
        update: { emoji },
      }),
      prisma.post.update({
        where: { id: postId },
        data: counterDelta(emoji, 1),
      }),
    ];
    if (existing) {
      ops.push(
        prisma.post.update({
          where: { id: postId },
          data: counterDelta(existing.emoji as ReactionEmoji, -1),
        }),
      );
    }
    await prisma.$transaction(ops);
    return withViewer(postId, userId);
  },

  /** Remove the viewer's reaction (if any) and decrement its counter. */
  async unreact(postId: string, userId: string): Promise<PostRow> {
    const existing = await prisma.postReaction.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { emoji: true },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.postReaction.delete({
          where: { postId_userId: { postId, userId } },
        }),
        prisma.post.update({
          where: { id: postId },
          data: counterDelta(existing.emoji as ReactionEmoji, -1),
        }),
      ]);
    }
    return withViewer(postId, userId);
  },
};
