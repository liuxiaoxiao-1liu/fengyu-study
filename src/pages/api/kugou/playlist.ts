import type { APIRoute } from 'astro';
import { getAccountPlaylist } from '../../../lib/kugou';
import { json } from '../../../lib/http';

export const prerender = false;

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;
const SLUG = 'maotouying';

/**
 * 只提供账号里的 maotouying 歌单，运行时从酷狗拉取，服务端缓存 60 秒。
 * 不再有静态歌单快照；酷狗上增删歌曲会在缓存过期后同步。
 */
export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug') ?? SLUG;
  if (slug !== SLUG) return json({ ok: false, error: 'playlist_not_found' }, 404);

  const requestedPage = Number(url.searchParams.get('page') ?? 1);
  const requestedSize = Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE);
  const pageSize = Number.isFinite(requestedSize)
    ? Math.min(Math.max(Math.trunc(requestedSize), 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  try {
    const playlist = await getAccountPlaylist();
    const totalPages = Math.max(1, Math.ceil(playlist.total / pageSize));
    const page = Number.isFinite(requestedPage) ? Math.min(Math.max(Math.trunc(requestedPage), 1), totalPages) : 1;
    const start = (page - 1) * pageSize;

    return json({
      ok: true,
      playlist: { slug: playlist.slug, name: playlist.name, total: playlist.total },
      page,
      pageSize,
      totalPages,
      tracks: playlist.tracks.slice(start, start + pageSize),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'playlist_sync_failed';
    if (message === 'kugou_disabled') return json({ ok: false, error: 'kugou_disabled' }, 503);
    console.error('[kugou/playlist] sync failed', message);
    return json({ ok: false, error: 'playlist_sync_failed' }, 502);
  }
};
