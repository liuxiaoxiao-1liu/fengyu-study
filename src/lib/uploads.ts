import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const UPLOAD_ROOT = resolve(process.env.CONTENT_UPLOADS ?? './.data/uploads');

export function ensureUploadDir(subdir = 'photos'): string {
  const dir = resolve(UPLOAD_ROOT, subdir);
  mkdirSync(dir, { recursive: true });
  return dir;
}
