import type { Request, Response } from 'express';
import { authService } from './auth.service.js';

export const authController = {
  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  },

  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  },
};
