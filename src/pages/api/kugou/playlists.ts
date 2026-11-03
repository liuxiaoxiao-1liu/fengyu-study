import type { APIRoute } from 'astro';
import { json } from '../../../lib/http';
import { getAccountPlaylist } from '../../../lib/kugou';

export const prerender = false;

/** 兼容旧调用：现在只有一个账号歌单。 */
export const GET: APIRoute = async () => {
  try {
    const playlist = await getAccountPlaylist();
    return json(
      {
        ok: true,
        playlists: [{ slug: playlist.slug, name: playlist.name, count: playlist.total }],
      },
      200,
      { 'Cache-Control': 'public, max-age=30' },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'playlist_sync_failed';
    if (message === 'kugou_disabled' || message === 'playlist_not_configured') {
      return json({ ok: false, error: 'kugou_not_configured' }, 503);
    }
    return json({ ok: false, error: 'playlist_sync_failed' }, 502);
  }
};
