import type { APIRoute } from 'astro';
import { playlists } from '../../../data/playlists';

export const prerender = false;

export const GET: APIRoute = async () => {
  const meta = playlists.map((playlist) => ({
    slug: playlist.slug,
    name: playlist.name,
    count: playlist.tracks.length,
  }));

  return new Response(JSON.stringify({ ok: true, playlists: meta }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
