import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin-auth';
import { deletePhoto, getPhotoRecord, updatePhoto } from '../../../../lib/content-db';
import { parsePhotoInput } from '../../../../lib/content-input';
import { json } from '../../../../lib/http';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const id = params.id;
  if (!id || !getPhotoRecord(id)) return json({ ok: false, error: 'not_found' }, 404);

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
    const photo = updatePhoto(id, parsed.value);
    if (!photo) return json({ ok: false, error: 'not_found' }, 404);
    return json({ ok: true, photo });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE/i.test(message)) return json({ ok: false, error: 'duplicate_slug', message: 'slug 已存在' }, 409);
    console.error('[admin/photos/:id] update failed', message);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const id = params.id;
  if (!id) return json({ ok: false, error: 'not_found' }, 404);
  const deleted = deletePhoto(id);
  return deleted ? json({ ok: true }) : json({ ok: false, error: 'not_found' }, 404);
};
