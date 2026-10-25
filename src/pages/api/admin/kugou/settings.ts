import type { APIRoute } from 'astro';
import { requireContentAdmin } from '../../../../lib/admin-auth';
import { listKugouPlaylists, resetKugouRuntime } from '../../../../lib/kugou';
import { saveKugouSettings } from '../../../../lib/kugou-session';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireContentAdmin(request);
  if (denied) return denied;

  let body: { playlistName?: unknown };
  try {
    body = (await request.json()) as { playlistName?: unknown };
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const name = typeof body.playlistName === 'string' ? body.playlistName.trim() : '';
  if (!name) return Response.json({ ok: false, error: 'missing_playlist_name' }, { status: 400 });

  try {
    const playlists = await listKugouPlaylists();
    if (!playlists.some((playlist) => playlist.name.trim().toLowerCase() === name.toLowerCase())) {
      return Response.json({ ok: false, error: 'playlist_not_found' }, { status: 404 });
    }
    saveKugouSettings({ playlistName: name });
    resetKugouRuntime();
    return Response.json({ ok: true, playlistName: name });
  } catch (cause) {
    return Response.json(
      { ok: false, error: 'kugou_failed', message: cause instanceof Error ? cause.message : String(cause) },
      { status: 502 },
    );
  }
};
