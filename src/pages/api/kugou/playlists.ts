import type { APIRoute } from 'astro';
import { json } from '../../../lib/http';
import { getAccountPlaylist } from '../../../lib/kugou';

export const prerender = false;

/** 兼容旧调用：现在只有一个账号歌单 maotouying。 */
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
    const status = message === 'kugou_disabled' ? 503 : 502;
    return json({ ok: false, error: status === 503 ? 'kugou_disabled' : 'playlist_sync_failed' }, status);
  }
};
