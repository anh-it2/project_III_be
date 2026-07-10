import { z } from 'zod';

// Media is uploaded first via POST /posts/upload (multipart → MinIO URL); the
// story create call is pure JSON and stores that hosted URL verbatim.
export const createStorySchema = z.object({
  mediaUrl: z.string().url().max(2048),
  mediaType: z.enum(['image', 'video']),
  caption: z.string().max(300).optional(),
  musicId: z.string().max(100).optional(),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;
