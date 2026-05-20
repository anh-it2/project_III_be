import { toPostDTO, type PostDTO } from '../post/post.model.js';
import { hashtagStore, type HashtagTrendingDTO } from './hashtag.model.js';

export const hashtagService = {
  trending(limit: number): Promise<HashtagTrendingDTO[]> {
    return hashtagStore.listTrending(limit);
  },

  async postsByTag(tag: string, viewerId: string): Promise<PostDTO[]> {
    const rows = await hashtagStore.listPostsByTag(tag.toLowerCase(), viewerId);
    return rows.map(toPostDTO);
  },
};
