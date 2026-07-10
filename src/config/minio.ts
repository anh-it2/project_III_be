import { randomUUID } from 'crypto';
import path from 'path';
import { Client } from 'minio';
import { env } from './env.js';

/**
 * Single MinIO client for post media. Objects are stored in one bucket and
 * served directly by MinIO (public-read policy), NOT by Express — so the
 * public URL is built from env.minio.publicUrl, not the API host.
 */
export const minioClient = new Client({
  endPoint: env.minio.endPoint,
  port: env.minio.port,
  useSSL: env.minio.useSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

export const BUCKET = env.minio.bucket;

// Public-read policy → objects loadable directly via <img src> (no presign,
// URLs never expire so they're safe to persist on a post).
const publicReadPolicy = (bucket: string) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });

/** The minimal slice of a multer file this store needs to persist an object. */
export interface StorableFile {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}

/**
 * Stream a buffered upload into the bucket and return its public URL. The
 * object name is a random UUID + the original extension — never the client
 * filename (path traversal / collisions). URL is built from the public MinIO
 * host, so it's safe to persist and load directly via <img src>.
 */
export async function storeObject(file: StorableFile): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
  const name = `${randomUUID()}${ext}`;
  await minioClient.putObject(BUCKET, name, file.buffer, file.size, {
    'Content-Type': file.mimetype,
  });
  return `${env.minio.publicUrl}/${BUCKET}/${name}`;
}

/** Create the bucket once at boot and make it public-read. */
export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
  }
  await minioClient.setBucketPolicy(BUCKET, publicReadPolicy(BUCKET));
}
