import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

export function createApp() {
  const app = express();

  // crossOriginResourcePolicy: the FE (different origin/port) loads uploaded
  // media via <img src>. helmet's same-origin default would block it.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  if (!env.isProd) app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'ok', uptime: process.uptime() });
  });

  // Post media now lives in MinIO and is served directly from there, so there
  // is no /uploads static mount anymore (see config/minio.ts).

  app.use('/api/v1', apiRoutes);

  // Error handling — must be registered last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
