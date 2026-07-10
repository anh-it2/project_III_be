import { storyStore, toStoryDTO, type StoryDTO } from './story.model.js';
import type { CreateStoryInput } from './story.validation.js';

export const storyService = {
  async list(): Promise<StoryDTO[]> {
    const rows = await storyStore.listActive(new Date());
    return rows.map(toStoryDTO);
  },

  async create(authorId: string, input: CreateStoryInput): Promise<StoryDTO> {
    return toStoryDTO(await storyStore.createForAuthor(authorId, input));
  },
};
