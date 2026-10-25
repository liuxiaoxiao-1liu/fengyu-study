import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin-auth';
import { listKugouPlaylists, resetKugouRuntime } from '../../../../lib/kugou';
import { saveKugouSettings } from '../../../../lib/kugou-session';
import { json } from '../../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: { playlistName?: unknown };
  try {
    body = (await request.json()) as { playlistName?: unknown };
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const name = typeof body.playlistName === 'string' ? body.playlistName.trim() : '';
  if (!name) return json({ ok: false, error: 'missing_playlist_name' }, 400);

  try {
    const playlists = await listKugouPlaylists();
    if (!playlists.some((playlist) => playlist.name.trim().toLowerCase() === name.toLowerCase())) {
      return json({ ok: false, error: 'playlist_not_found' }, 404);
    }
    saveKugouSettings({ playlistName: name });
    resetKugouRuntime();
    return json({ ok: true, playlistName: name });
  } catch (cause) {
    return json(
      { ok: false, error: 'kugou_failed', message: cause instanceof Error ? cause.message : String(cause) },
      502,
    );
  }
};
