import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { CreateStoryInput } from './story.validation.js';

const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Wire shape the FE parses (StoryDTO). Timestamps are epoch ms, not Date. */
export interface StoryDTO {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  musicId?: string;
  createdAt: number;
  expiresAt: number;
}

// Author name/avatar are read live (not denormalized), same as Post.
const STORY_INCLUDE = {
  author: {
    select: { id: true, name: true, profile: { select: { avatarUrl: true } } },
  },
} as const;

type StoryRow = Prisma.StoryGetPayload<{ include: typeof STORY_INCLUDE }>;

export function toStoryDTO(row: StoryRow): StoryDTO {
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.author.name,
    authorAvatarUrl: row.author.profile?.avatarUrl ?? '',
    mediaUrl: row.mediaUrl,
    mediaType: row.mediaType,
    // Omit optionals when null so the wire matches `caption?`/`musicId?`.
    ...(row.caption != null ? { caption: row.caption } : {}),
    ...(row.musicId != null ? { musicId: row.musicId } : {}),
    createdAt: row.createdAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
  };
}

export const storyStore = {
  createForAuthor(authorId: string, input: CreateStoryInput) {
    return prisma.story.create({
      data: {
        authorId,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
        caption: input.caption ?? null,
        musicId: input.musicId ?? null,
        // Prisma can't default to now()+24h, so compute it at write time.
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      },
      include: STORY_INCLUDE,
    });
  },

  /** Active (non-expired) stories, newest first. Expired rows are retained. */
  listActive(now: Date) {
    return prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      include: STORY_INCLUDE,
    });
  },
};
