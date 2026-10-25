import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin-auth';
import { kugouLoginStatus } from '../../../../lib/kugou-login';
import { getAccountPlaylist, listKugouPlaylists } from '../../../../lib/kugou';
import { json } from '../../../../lib/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const status = kugouLoginStatus();
  let playlists: Awaited<ReturnType<typeof listKugouPlaylists>> = [];
  let playlist: Awaited<ReturnType<typeof getAccountPlaylist>> | null = null;
  let error = '';
  if (status.configured) {
    try {
      playlists = await listKugouPlaylists();
      playlist = await getAccountPlaylist(true);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  return json({ ok: true, status, playlists, playlist, error });
};
