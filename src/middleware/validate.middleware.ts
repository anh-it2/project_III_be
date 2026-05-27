import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/api-error.js';

/**
 * Validates and replaces `req.body` with the parsed result.
 * Reusable across every feature module.
 */
export const validateBody =
  (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      return next(ApiError.badRequest(message));
    }
    req.body = result.data;
    next();
  };

export const validateQuery =
  (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join('.') || 'query'}: ${i.message}`)
        .join('; ');
      return next(ApiError.badRequest(message));
    }
    // Express 5 query is read-only; stash parsed values on a side channel
    // controllers reach for instead of mutating req.query.
    (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    next();
  };
