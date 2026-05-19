import fs from 'fs';
import path from 'path';

/**
 * On-disk root for user-uploaded post media. One place so the multer
 * destination and the express.static mount can't drift apart. Resolved from
 * the process cwd (the BE repo root when run via `tsx`/`node`), NOT from a
 * compiled __dirname, so dev (src) and prod (dist) write the same folder.
 *
 * Served read-only at `/uploads/<file>`; the public URL is built from
 * env.publicBaseUrl so the browser can load it cross-origin.
 */
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/** Create the upload dir once at boot — multer does not auto-create it. */
export function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
