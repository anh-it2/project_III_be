import type { Request, Response } from 'express';
import { userService } from './user.service.js';

export const userController = {
  async create(req: Request, res: Response) {
    const user = await userService.create(req.body);
    res.status(201).json({ success: true, data: user });
  },

  async list(_req: Request, res: Response) {
    res.json({ success: true, data: await userService.list() });
  },

  async getById(req: Request, res: Response) {
    res.json({ success: true, data: await userService.getById(req.params.id) });
  },

  async me(req: Request, res: Response) {
    res.json({ success: true, data: await userService.getById(req.user!.sub) });
  },

  async getMyProfile(req: Request, res: Response) {
    res.json({
      success: true,
      data: await userService.getMyProfile(req.user!.sub),
    });
  },

  async updateMyProfile(req: Request, res: Response) {
    res.json({
      success: true,
      data: await userService.updateMyProfile(req.user!.sub, req.body),
    });
  },

  async updateMyAvatar(req: Request, res: Response) {
    const avatarUrl = await userService.setProfileImage(
      req.user!.sub,
      'avatarUrl',
      req.file,
    );
    res.json({ success: true, data: { avatarUrl } });
  },

  async updateMyCover(req: Request, res: Response) {
    const coverUrl = await userService.setProfileImage(
      req.user!.sub,
      'coverUrl',
      req.file,
    );
    res.json({ success: true, data: { coverUrl } });
  },
};
