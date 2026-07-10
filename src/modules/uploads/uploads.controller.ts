import type { Request, Response } from 'express';
import { storeObject } from '../../config/minio.js';
import { ApiError } from '../../utils/api-error.js';

export const uploadsController = {
  /**
   * POST /uploads/single — generic single-image upload for any feature (chat
   * images, etc.). The optional `uploadType` text field (e.g. "CHAT_IMAGE")
   * is accepted for the caller's own bookkeeping; all objects share the one
   * public-read bucket. Returns the stored public URL as `fileUrl`.
   */
  async single(req: Request, res: Response) {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    const fileUrl = await storeObject(req.file);
    res.status(201).json({ success: true, data: { fileUrl } });
  },
};
