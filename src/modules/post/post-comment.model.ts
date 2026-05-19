import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AUTHOR_SELECT } from './post.shared.js';
import type { CreateCommentInput } from './post.validation.js';

type CommentRow = Prisma.PostCommentGetPayload<{
  include: { author: typeof AUTHOR_SELECT };
}>;

export interface CommentDTO {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  text: string;
  imageUrl: string | null;
  createdAt: number;
}

export function toCommentDTO(row: CommentRow): CommentDTO {
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorName: row.author.name,
    authorAvatarUrl: row.author.profile?.avatarUrl ?? '',
    text: row.text,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.getTime(),
  };
}

export const commentStore = {
  /** A post's comments, oldest → newest (reading order). */
  async list(postId: string): Promise<CommentDTO[]> {
    const rows = await prisma.postComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: { author: AUTHOR_SELECT },
    });
    return rows.map(toCommentDTO);
  },

  /** Insert a comment and bump Post.commentsCount atomically. */
  async add(
    postId: string,
    authorId: string,
    input: CreateCommentInput,
  ): Promise<CommentDTO> {
    const [row] = await prisma.$transaction([
      prisma.postComment.create({
        data: {
          postId,
          authorId,
          text: input.text,
          imageUrl: input.imageUrl ?? null,
        },
        include: { author: AUTHOR_SELECT },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      }),
    ]);
    return toCommentDTO(row);
  },
};
