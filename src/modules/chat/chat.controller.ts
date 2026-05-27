import type { Request, Response } from 'express';
import { chatService } from './chat.service.js';
import type { ListMessagesQuery } from './chat.validation.js';

export const chatController = {
  /**
   * GET /chat/:conversationId/messages?cursor=<ms>&limit=<n>
   *
   * Returns one cursor-paginated page of history for a conversation. The FE
   * stacks these via TanStack `useInfiniteQuery`; scroll-up triggers the
   * next page with the previous page's `nextCurosr`.
   */
  async listMessages(req: Request, res: Response) {
    const viewerId = req.user!.sub;
    const { conversationId } = req.params;
    const { cursor, limit } = (
      req as Request & { validatedQuery: ListMessagesQuery }
    ).validatedQuery;

    const page = await chatService.listHistory(
      conversationId,
      viewerId,
      cursor,
      limit,
    );
    res.json({ success: true, data: page });
  },
};
