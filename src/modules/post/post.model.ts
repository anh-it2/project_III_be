import { prisma } from '../../config/prisma.js';
import { hashtagStore } from '../hashtag/hashtag.model.js';
import { extractHashtags } from '../hashtag/hashtag.parse.js';
import { jsonWrite, postInclude, type PostRow } from './post.shared.js';
import type { CreatePostInput, UpdatePostInput } from './post.validation.js';

// Newest-N feed cap. Matches the old FE behaviour (it never paginated the
// localStorage feed) and bounds the query until a real cursor is added.
const FEED_LIMIT = 50;

export interface PostFeelingDTO {
  id: string;
  emoji: string;
  label: string;
  kind: 'feeling' | 'activity';
}

/**
 * Wire shape returned to the Next proxy. The browser-side mapper turns this
 * into the FE `FeedPostData` (computes author initial/gradient + relative
 * time client-side; the server stays presentation-agnostic).
 */
export interface PostDTO {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  text: string;
  imageUrl: string | null;
  videoUrl: string | null;
  feeling: PostFeelingDTO | null;
  isLive: boolean;
  // Per-kind reaction counters (FE ReactionId). `likes` label = their sum.
  reactions: {
    like: number;
    love: number;
    care: number;
    haha: number;
    wow: number;
    sad: number;
    angry: number;
  };
  // The requesting user's own reaction on this post, or null.
  myReaction: string | null;
  commentsCount: number;
  sharesCount: number;
  sharedFrom: Record<string, unknown> | null;
  pinnedAt: number | null;
  createdAt: number;
  // Hashtags extracted from `text` at create/update time, lowercased + deduped.
  // Drives the trending sidebar + /hashtag/[tag] landing page on the FE.
  tags: string[];
}

export function toPostDTO(row: PostRow): PostDTO {
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.author.name,
    authorAvatarUrl: row.author.profile?.avatarUrl ?? '',
    text: row.text,
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    feeling: (row.feeling as PostFeelingDTO | null) ?? null,
    isLive: row.isLive,
    reactions: {
      like: row.likeCount,
      love: row.loveCount,
      care: row.careCount,
      haha: row.hahaCount,
      wow: row.wowCount,
      sad: row.sadCount,
      angry: row.angryCount,
    },
    myReaction: row.reactions[0]?.emoji ?? null,
    commentsCount: row.commentsCount,
    sharesCount: row.sharesCount,
    sharedFrom: (row.sharedFrom as Record<string, unknown> | null) ?? null,
    pinnedAt: row.pinnedAt ? row.pinnedAt.getTime() : null,
    createdAt: row.createdAt.getTime(),
    tags: row.hashtags.map((h) => h.hashtag.tag),
  };
}

/** Post CRUD + feed reads. Reactions/comments live in their own stores. */
export const postStore = {
  // Wrapped in $transaction so hashtag extraction + PostHashtag inserts +
  // Hashtag.usageCount increment are atomic with the post create — a crash
  // mid-tag-insert never leaves a post with partial tags.
  async createForAuthor(
    authorId: string,
    input: CreatePostInput,
  ): Promise<PostRow> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId,
          text: input.text,
          imageUrl: input.imageUrl ?? null,
          videoUrl: input.videoUrl ?? null,
          feeling: jsonWrite(input.feeling ?? null),
          isLive: input.isLive ?? false,
          sharedFrom: jsonWrite(input.sharedFrom ?? null),
        },
        select: { id: true },
      });
      await hashtagStore.applyTagDiff(
        tx,
        created.id,
        [],
        extractHashtags(input.text),
      );
      // Re-fetch with the full viewer-scoped include now that hashtags exist.
      const row = await tx.post.findUnique({
        where: { id: created.id },
        include: postInclude(authorId),
      });
      // Guaranteed by the create+findUnique on the same tx; satisfies TS.
      if (!row) throw new Error('Post create failed');
      return row;
    });
  },

  /**
   * Global feed: pinned first (newest pin), then friends' (and the viewer's
   * own) posts before strangers', newest-created within each group.
   *
   * Prisma's `orderBy` can't express "friend-first" (it depends on the
   * viewer's friend set), so we order pinned/newest in the DB then do a
   * stable reorder by friend-rank in app code. The fetched window is the
   * same newest-N as before, so no extra rows are dropped vs. the old order.
   */
  async listFeed(viewerId: string): Promise<PostRow[]> {
    const [rows, friendRows] = await Promise.all([
      prisma.post.findMany({
        orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: FEED_LIMIT,
        include: postInclude(viewerId),
      }),
      prisma.friend.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
        },
        select: { requesterId: true, addresseeId: true },
      }),
    ]);

    const friendIds = new Set<string>();
    for (const f of friendRows) {
      friendIds.add(f.requesterId === viewerId ? f.addresseeId : f.requesterId);
    }

    // 0 = own/friend, 1 = stranger. Array.prototype.sort is stable, so the
    // DB pinned/newest order is preserved within each rank.
    const rank = (r: PostRow) =>
      r.authorId === viewerId || friendIds.has(r.authorId) ? 0 : 1;

    return rows.sort((a, b) => {
      const pinDelta = (a.pinnedAt ? 0 : 1) - (b.pinnedAt ? 0 : 1);
      return pinDelta !== 0 ? pinDelta : rank(a) - rank(b);
    });
  },

  /** One author's posts (profile / photos / stats), same ordering. */
  listByAuthor(authorId: string, viewerId: string): Promise<PostRow[]> {
    return prisma.post.findMany({
      where: { authorId },
      orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: FEED_LIMIT,
      include: postInclude(viewerId),
    });
  },

  findById(id: string, viewerId: string): Promise<PostRow | null> {
    return prisma.post.findUnique({
      where: { id },
      include: postInclude(viewerId),
    });
  },

  /** Existence/ownership check without the per-viewer joins. */
  findBare(id: string) {
    return prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });
  },

  async update(
    id: string,
    viewerId: string,
    input: UpdatePostInput,
  ): Promise<PostRow> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.post.findUnique({
        where: { id },
        select: { text: true },
      });
      await tx.post.update({
        where: { id },
        data: {
          text: input.text,
          imageUrl: input.imageUrl ?? null,
          videoUrl: input.videoUrl ?? null,
          feeling: jsonWrite(input.feeling ?? null),
        },
        select: { id: true },
      });
      await hashtagStore.applyTagDiff(
        tx,
        id,
        extractHashtags(before?.text),
        extractHashtags(input.text),
      );
      const row = await tx.post.findUnique({
        where: { id },
        include: postInclude(viewerId),
      });
      if (!row) throw new Error('Post update failed');
      return row;
    });
  },

  setPinned(id: string, viewerId: string, pinned: boolean): Promise<PostRow> {
    return prisma.post.update({
      where: { id },
      data: { pinnedAt: pinned ? new Date() : null },
      include: postInclude(viewerId),
    });
  },

  // PostHashtag rows cascade with the post, but that wouldn't update
  // Hashtag.usageCount — do the diff explicitly first, then drop the post.
  async delete(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const row = await tx.post.findUnique({
        where: { id },
        select: { text: true },
      });
      await hashtagStore.applyTagDiff(
        tx,
        id,
        extractHashtags(row?.text),
        [],
      );
      await tx.post.delete({ where: { id } });
    });
  },
};
