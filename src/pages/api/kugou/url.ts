import type { APIRoute } from 'astro';
import { json } from '../../../lib/http';
import { findAccountTrack, isKugouEnabled, resolveKugouUrl } from '../../../lib/kugou';
import { clientIp, createRateLimiter } from '../../../lib/rate-limit';

export const prerender = false;

const limiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  hashKey: true,
  hashLength: 16,
});

/**
 * 只解析「编辑精选 + 账号歌单」里出现过的 hash，不做通用酷狗代理。
 * 返回的是 CDN 直链，由浏览器 <audio> 直接播放；服务端不代理音频字节。
 */
export const GET: APIRoute = async ({ request, url, clientAddress }) => {
  if (!isKugouEnabled()) {
    return json({ ok: false, error: 'kugou_disabled' }, 503);
  }

  const hash = (url.searchParams.get('hash') ?? '').toLowerCase();
  if (!hash) {
    return json({ ok: false, error: 'not_in_playlist' }, 404);
  }

  if (limiter.hit(clientIp(request, clientAddress))) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  let track;
  try {
    track = await findAccountTrack(hash);
  } catch (error) {
    console.error('[kugou] playlist sync failed', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'playlist_sync_failed' }, 502);
  }

  if (!track) {
    return json({ ok: false, error: 'not_in_playlist' }, 404);
  }

  try {
    const playUrl = await resolveKugouUrl(track);
    return json({
      ok: true,
      url: playUrl,
      track: { hash: track.hash, title: track.title, artist: track.artist },
    });
  } catch (error) {
    console.error('[kugou] resolve failed', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'resolve_failed' }, 502);
  }
};
