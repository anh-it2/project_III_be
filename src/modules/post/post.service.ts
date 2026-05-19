import { ApiError } from '../../utils/api-error.js';
import { postStore, toPostDTO, type PostDTO } from './post.model.js';
import { reactionStore } from './post-reaction.model.js';
import { commentStore, type CommentDTO } from './post-comment.model.js';
import type {
  CreatePostInput,
  UpdatePostInput,
  ReactPostInput,
  CreateCommentInput,
} from './post.validation.js';

/**
 * Loads a post and asserts the caller authored it. Used by the mutating ops
 * that are owner-only (edit/delete/pin). Missing = 404, someone else's =
 * 403. Reacting/commenting is NOT owner-gated — only existence is checked.
 */
async function assertOwned(postId: string, userId: string): Promise<void> {
  const row = await postStore.findBare(postId);
  if (!row) throw ApiError.notFound('Post not found');
  if (row.authorId !== userId) throw ApiError.forbidden('Not your post');
}

async function assertExists(postId: string): Promise<void> {
  const row = await postStore.findBare(postId);
  if (!row) throw ApiError.notFound('Post not found');
}

export const postService = {
  async create(authorId: string, input: CreatePostInput): Promise<PostDTO> {
    return toPostDTO(await postStore.createForAuthor(authorId, input));
  },

  async listFeed(viewerId: string): Promise<PostDTO[]> {
    return (await postStore.listFeed(viewerId)).map(toPostDTO);
  },

  async listByAuthor(
    authorId: string,
    viewerId: string,
  ): Promise<PostDTO[]> {
    return (await postStore.listByAuthor(authorId, viewerId)).map(toPostDTO);
  },

  async update(
    postId: string,
    userId: string,
    input: UpdatePostInput,
  ): Promise<PostDTO> {
    await assertOwned(postId, userId);
    return toPostDTO(await postStore.update(postId, userId, input));
  },

  async setPinned(
    postId: string,
    userId: string,
    pinned: boolean,
  ): Promise<PostDTO> {
    await assertOwned(postId, userId);
    return toPostDTO(await postStore.setPinned(postId, userId, pinned));
  },

  async remove(postId: string, userId: string): Promise<void> {
    await assertOwned(postId, userId);
    await postStore.delete(postId);
  },

  // ─── reactions (any authed user, not owner-gated) ──────────────────
  async react(
    postId: string,
    userId: string,
    input: ReactPostInput,
  ): Promise<PostDTO> {
    await assertExists(postId);
    return toPostDTO(await reactionStore.react(postId, userId, input));
  },

  async unreact(postId: string, userId: string): Promise<PostDTO> {
    await assertExists(postId);
    return toPostDTO(await reactionStore.unreact(postId, userId));
  },

  // ─── comments ──────────────────────────────────────────────────────
  listComments(postId: string): Promise<CommentDTO[]> {
    return commentStore.list(postId);
  },

  async addComment(
    postId: string,
    authorId: string,
    input: CreateCommentInput,
  ): Promise<CommentDTO> {
    await assertExists(postId);
    return commentStore.add(postId, authorId, input);
  },
};
