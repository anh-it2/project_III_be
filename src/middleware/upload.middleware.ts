import type { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { ApiError } from '../utils/api-error.js';

// Avatars/covers and chat images are small; the FE caps them tighter (4MB
// profile, 2MB chat). 5MB is a generous server-side backstop.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// In-memory: the handler streams the buffer straight to MinIO. One image per
// request keeps RAM bounded.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files allowed'));
  },
});

/**
 * `upload.single('file')` wrapped so multer's own errors (too large, wrong
 * type) surface as a 400 ApiError instead of a generic 500. Shared by the
 * user avatar/cover routes and the generic /uploads/single route.
 */
export function singleImage(req: Request, res: Response, next: NextFunction) {
  imageUpload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large (max 5MB)'
          : err.message;
      return next(ApiError.badRequest(msg));
    }
    if (err instanceof Error) return next(ApiError.badRequest(err.message));
    next(ApiError.badRequest('Upload failed'));
  });
}
