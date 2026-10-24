import type { APIRoute } from 'astro';
import { playlistBySlug } from '../../../data/playlists';

export const prerender = false;

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug') ?? 'featured';
  const playlist = playlistBySlug(slug);
  if (!playlist) return json({ ok: false, error: 'playlist_not_found' }, 404);

  const requestedPage = Number(url.searchParams.get('page') ?? 1);
  const requestedSize = Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE);
  const pageSize = Number.isFinite(requestedSize)
    ? Math.min(Math.max(Math.trunc(requestedSize), 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(playlist.tracks.length / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(Math.trunc(requestedPage), 1), totalPages)
    : 1;
  const start = (page - 1) * pageSize;

  return json({
    ok: true,
    playlist: { slug: playlist.slug, name: playlist.name, total: playlist.tracks.length },
    page,
    pageSize,
    totalPages,
    tracks: playlist.tracks.slice(start, start + pageSize),
  });
};
