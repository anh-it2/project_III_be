import { randomUUID } from 'crypto';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { UPLOAD_DIR } from '../../config/uploads.js';
import { ApiError } from '../../utils/api-error.js';

// Images up to ~5MB and videos up to ~50MB in the FE composer; cap at 50MB.
const MAX_BYTES = 50 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  // Random name + original extension. Never trust the client filename for
  // the on-disk name (path traversal / collisions).
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    if (ok) return cb(null, true);
    cb(new Error('Only image or video files allowed'));
  },
});

/**
 * `upload.single('file')` wrapped so multer's own errors (too large, wrong
 * type) become a 400 ApiError instead of a generic 500 from the catch-all.
 */
export function singleMedia(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 50MB)' : err.message;
      return next(ApiError.badRequest(msg));
    }
    if (err instanceof Error) return next(ApiError.badRequest(err.message));
    next(ApiError.badRequest('Upload failed'));
  });
}
