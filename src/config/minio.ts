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

/** Create the bucket once at boot and make it public-read. */
export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
  }
  await minioClient.setBucketPolicy(BUCKET, publicReadPolicy(BUCKET));
}
