import type { APIRoute } from 'astro';
import { requireContentAdmin } from '../../../../lib/admin-auth';
import { kugouLoginStatus } from '../../../../lib/kugou-login';
import { getAccountPlaylist, listKugouPlaylists } from '../../../../lib/kugou';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const denied = requireContentAdmin(request);
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
