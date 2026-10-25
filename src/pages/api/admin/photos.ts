import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-auth';
import { createPhoto, listPhotoRecords } from '../../../lib/content-db';
import { parsePhotoInput } from '../../../lib/content-input';
import { json } from '../../../lib/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return json({ ok: true, photos: listPhotoRecords() });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return json({ ok: false, error: 'invalid_json' }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const parsed = parsePhotoInput(body);
  if (!parsed.ok) return json({ ok: false, error: 'invalid_photo', message: parsed.error }, 422);

  try {
    const photo = createPhoto(parsed.value);
    return json({ ok: true, photo }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE/i.test(message)) return json({ ok: false, error: 'duplicate_slug', message: 'slug 已存在' }, 409);
    console.error('[admin/photos] create failed', message);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
