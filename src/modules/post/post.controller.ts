import type { Request, Response } from 'express';
import { postService } from './post.service.js';
import { env } from '../../config/env.js';
import { minioClient, BUCKET } from '../../config/minio.js';
import { objectName } from './post.upload.js';

export const postController = {
  /**
   * GET /posts            → global feed
   * GET /posts?mine=1     → my posts (profile/photos/stats)
   * GET /posts?authorId=X → a specific user's posts
   */
  async list(req: Request, res: Response) {
    const viewerId = req.user!.sub;
    const { mine, authorId } = req.query;
    if (mine === '1') {
      return res.json({
        success: true,
        data: await postService.listByAuthor(viewerId, viewerId),
      });
    }
    if (typeof authorId === 'string' && authorId) {
      return res.json({
        success: true,
        data: await postService.listByAuthor(authorId, viewerId),
      });
    }
    res.json({ success: true, data: await postService.listFeed(viewerId) });
  },

  async getOne(req: Request, res: Response) {
    res.json({
      success: true,
      data: await postService.getById(req.params.id, req.user!.sub),
    });
  },

  async create(req: Request, res: Response) {
    const post = await postService.create(req.user!.sub, req.body);
    res.status(201).json({ success: true, data: post });
  },

  async update(req: Request, res: Response) {
    res.json({
      success: true,
      data: await postService.update(req.params.id, req.user!.sub, req.body),
    });
  },

  async pin(req: Request, res: Response) {
    res.json({
      success: true,
      data: await postService.setPinned(
        req.params.id,
        req.user!.sub,
        req.body.pinned,
      ),
    });
  },

  async remove(req: Request, res: Response) {
    await postService.remove(req.params.id, req.user!.sub);
    res.json({ success: true, data: { id: req.params.id } });
  },

  // ─── reactions ─────────────────────────────────────────────────────
  async react(req: Request, res: Response) {
    res.json({
      success: true,
      data: await postService.react(req.params.id, req.user!.sub, req.body),
    });
  },

  async unreact(req: Request, res: Response) {
    res.json({
      success: true,
      data: await postService.unreact(req.params.id, req.user!.sub),
    });
  },

  // ─── comments ──────────────────────────────────────────────────────
  async listComments(req: Request, res: Response) {
    res.json({
      success: true,
      data: await postService.listComments(req.params.id),
    });
  },

  async addComment(req: Request, res: Response) {
    res.status(201).json({
      success: true,
      data: await postService.addComment(
        req.params.id,
        req.user!.sub,
        req.body,
      ),
    });
  },

  /**
   * Multer buffered the file in memory; `req.file` is set by the upload route.
   * Stream it to MinIO and return the permanent public URL the browser embeds
   * (this URL is what the FE persists on the post).
   */
  async uploadMedia(req: Request, res: Response) {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file uploaded' });
    }
    const name = objectName(file.originalname);
    await minioClient.putObject(BUCKET, name, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
    res.status(201).json({
      success: true,
      data: { url: `${env.minio.publicUrl}/${BUCKET}/${name}` },
    });
  },
};
