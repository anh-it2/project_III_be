import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error.js';
import { env } from '../config/env.js';

/** 404 handler — runs when no route matched. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Central error handler — last middleware in the chain. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const apiError =
    err instanceof ApiError
      ? err
      : new ApiError(500, err instanceof Error ? err.message : 'Internal server error', false);

  if (!apiError.isOperational || apiError.statusCode >= 500) {
    console.error(err);
  }

  res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
    ...(env.isProd ? {} : { stack: apiError.stack }),
  });
}
