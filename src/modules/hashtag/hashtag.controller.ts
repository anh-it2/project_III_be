import type { Request, Response } from 'express';
import { hashtagService } from './hashtag.service.js';

// limit is a query string, parse + clamp here (no validateBody for GETs).
const DEFAULT_TRENDING_LIMIT = 6;
const MAX_TRENDING_LIMIT = 50;

function parseLimit(raw: unknown): number {
  if (typeof raw !== 'string') return DEFAULT_TRENDING_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_TRENDING_LIMIT;
  return Math.min(Math.floor(n), MAX_TRENDING_LIMIT);
}

export const hashtagController = {
  async trending(req: Request, res: Response) {
    const limit = parseLimit(req.query.limit);
    res.json({ success: true, data: await hashtagService.trending(limit) });
  },

  async postsByTag(req: Request, res: Response) {
    res.json({
      success: true,
      data: await hashtagService.postsByTag(req.params.tag, req.user!.sub),
    });
  },
};
