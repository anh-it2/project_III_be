import type { Request, Response } from 'express';
import { storyService } from './story.service.js';

export const storyController = {
  async list(_req: Request, res: Response) {
    res.json({
      success: true,
      message: 'Lay danh sach story thanh cong',
      data: await storyService.list(),
    });
  },

  async create(req: Request, res: Response) {
    const story = await storyService.create(req.user!.sub, req.body);
    res
      .status(201)
      .json({ success: true, message: 'Dang story thanh cong', data: story });
  },
};
