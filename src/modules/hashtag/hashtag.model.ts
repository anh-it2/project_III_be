import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { postInclude, type PostRow } from '../post/post.shared.js';

// Same FEED_LIMIT as post.model — tag pages cap at the same window for now
// (no cursor pagination yet; matches the global feed).
const FEED_LIMIT = 50;

export interface HashtagTrendingDTO {
  tag: string;
  count: number;
}

/**
 * Per-post tag lifecycle. Caller MUST pass a transaction client so the
 * Hashtag.usageCount counter stays consistent with PostHashtag rows even
 * across concurrent post writes. Set semantics: `prev` and `next` are tag
 * arrays from extractHashtags (deduped, lowercased).
 */
export const hashtagStore = {
  async applyTagDiff(
    tx: Prisma.TransactionClient,
    postId: string,
    prev: string[],
    next: string[],
  ): Promise<void> {
    const prevSet = new Set(prev);
    const nextSet = new Set(next);
    const added = next.filter((t) => !prevSet.has(t));
    const removed = prev.filter((t) => !nextSet.has(t));

    for (const tag of added) {
      const row = await tx.hashtag.upsert({
        where: { tag },
        create: { tag, usageCount: 1 },
        update: { usageCount: { increment: 1 } },
      });
      await tx.postHashtag.create({
        data: { postId, hashtagId: row.id },
      });
    }

    if (removed.length > 0) {
      const rows = await tx.hashtag.findMany({
        where: { tag: { in: removed } },
        select: { id: true },
      });
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        await tx.postHashtag.deleteMany({
          where: { postId, hashtagId: { in: ids } },
        });
        await tx.hashtag.updateMany({
          where: { id: { in: ids } },
          data: { usageCount: { decrement: 1 } },
        });
      }
    }
  },

  listTrending(limit: number): Promise<HashtagTrendingDTO[]> {
    return prisma.hashtag
      .findMany({
        where: { usageCount: { gt: 0 } },
        orderBy: [{ usageCount: 'desc' }, { tag: 'asc' }],
        take: limit,
        select: { tag: true, usageCount: true },
      })
      .then((rows) =>
        rows.map((r) => ({ tag: r.tag, count: r.usageCount })),
      );
  },

  listPostsByTag(tag: string, viewerId: string): Promise<PostRow[]> {
    return prisma.post.findMany({
      where: { hashtags: { some: { hashtag: { tag } } } },
      orderBy: [
        { pinnedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: FEED_LIMIT,
      include: postInclude(viewerId),
    });
  },
};
