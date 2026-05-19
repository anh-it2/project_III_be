import 'dotenv/config';

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

const PORT = Number(process.env.PORT ?? 8080);

export const env = {
  port: PORT,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: required('JWT_SECRET', 'change-me-in-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  // Absolute base the browser uses to load uploaded media (<img src>).
  // The FE renders these directly, so it must be reachable from the client,
  // not an internal hostname. Override per env with PUBLIC_BASE_URL.
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`,
  get isProd() {
    return this.nodeEnv === 'production';
  },
};
