import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';
import type { Role } from '@prisma/client';

export interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** Rejects the request unless a valid Bearer token is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing Bearer token'));
  }
  try {
    const token = header.slice('Bearer '.length);
    req.user = jwt.verify(token, env.jwtSecret) as AuthPayload;
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}
