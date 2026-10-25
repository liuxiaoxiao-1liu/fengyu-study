import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin-auth';
import { addKugouTrack, removeKugouTrack } from '../../../../lib/kugou';
import { json } from '../../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let body: { hash?: unknown; name?: unknown; albumId?: unknown; albumAudioId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  try {
    await addKugouTrack({
      hash: String(body.hash ?? ''),
      name: typeof body.name === 'string' ? body.name : '',
      albumId: String(body.albumId ?? '0'),
      albumAudioId: Number(body.albumAudioId ?? 0),
    });
    return json({ ok: true });
  } catch (cause) {
    return json(
      { ok: false, error: 'kugou_add_failed', message: cause instanceof Error ? cause.message : String(cause) },
      502,
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let body: { fileid?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  try {
    await removeKugouTrack(Number(body.fileid ?? 0));
    return json({ ok: true });
  } catch (cause) {
    return json(
      { ok: false, error: 'kugou_del_failed', message: cause instanceof Error ? cause.message : String(cause) },
      502,
    );
  }
};
