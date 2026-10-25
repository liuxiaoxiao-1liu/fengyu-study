import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin-auth';
import { json } from '../../../../lib/http';
import { listKugouPlaylists } from '../../../../lib/kugou';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const playlists = await listKugouPlaylists();
    return json({ ok: true, playlists });
  } catch (cause) {
    return json(
      { ok: false, error: 'kugou_failed', message: cause instanceof Error ? cause.message : String(cause) },
      502,
    );
  }
};
