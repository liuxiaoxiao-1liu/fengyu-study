import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireAdmin } from '../../../lib/admin-auth';
import { ensureUploadDir } from '../../../lib/uploads';
import { json } from '../../../lib/http';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'invalid_form' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json({ ok: false, error: 'missing_file', message: '请选择图片文件' }, 422);
  }
  if (file.size > MAX_BYTES) {
    return json({ ok: false, error: 'file_too_large', message: '图片不能超过 8 MB' }, 413);
  }
  const ext = IMAGE_TYPES[file.type];
  if (!ext) {
    return json({ ok: false, error: 'unsupported_type', message: '只支持 JPG / PNG / WebP / GIF / AVIF' }, 415);
  }

  const dir = ensureUploadDir('photos');
  const name = `${Date.now()}-${randomUUID()}.${ext}`;
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));

  return json({ ok: true, url: `/api/media/photos/${name}`, filename: name }, 201);
};
