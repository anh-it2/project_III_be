import type { Request, Response } from 'express';
import { friendService } from './friend.service.js';

/** Thin HTTP layer — auth (req.user.sub) is guaranteed by requireAuth. */
export const friendController = {
  async snapshot(req: Request, res: Response) {
    res.json({ success: true, data: await friendService.snapshot(req.user!.sub) });
  },

  async getStatus(req: Request, res: Response) {
    const status = await friendService.getStatus(req.user!.sub, req.params.userId);
    res.json({ success: true, data: { status } });
  },

  async sendRequest(req: Request, res: Response) {
    await friendService.sendRequest(req.user!.sub, req.params.userId);
    res.status(201).json({ success: true });
  },

  async cancelRequest(req: Request, res: Response) {
    await friendService.cancelRequest(req.user!.sub, req.params.userId);
    res.json({ success: true });
  },

  async acceptRequest(req: Request, res: Response) {
    await friendService.acceptRequest(req.user!.sub, req.params.userId);
    res.json({ success: true });
  },

  async rejectRequest(req: Request, res: Response) {
    await friendService.rejectRequest(req.user!.sub, req.params.userId);
    res.json({ success: true });
  },

  async unfriend(req: Request, res: Response) {
    await friendService.unfriend(req.user!.sub, req.params.userId);
    res.json({ success: true });
  },
};
