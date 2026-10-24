import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { isKugouEnabled, resolveKugouUrl } from '../../../lib/kugou';
import { tracks } from '../../../data/music';

export const prerender = false;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const buckets = new Map<string, number[]>();

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

function clientIp(request: Request, clientAddress: string | undefined): string {
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return clientAddress || 'unknown';
}

function hitRateLimit(ip: string): boolean {
  const now = Date.now();
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
  const recent = (buckets.get(hash) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    buckets.set(hash, recent);
    return true;
  }
  recent.push(now);
  buckets.set(hash, recent);
  return false;
}

/**
 * 只解析 music.ts 里带 kugou 元数据的曲目，不做通用酷狗代理。
 * 返回的是 CDN 直链，由浏览器 <audio> 直接播放；服务端不代理音频字节。
 */
export const GET: APIRoute = async ({ request, url, clientAddress }) => {
  if (!isKugouEnabled()) {
    return json({ ok: false, error: 'kugou_disabled' }, 503);
  }

  const slug = url.searchParams.get('slug') ?? '';
  const track = tracks.find((item) => item.slug === slug && item.kugou);
  if (!track || !track.kugou) {
    return json({ ok: false, error: 'not_in_playlist' }, 404);
  }

  if (hitRateLimit(clientIp(request, clientAddress))) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  try {
    const playUrl = await resolveKugouUrl(track.kugou);
    return json({
      ok: true,
      url: playUrl,
      track: { slug: track.slug, title: track.title, artist: track.artist },
    });
  } catch (error) {
    console.error('[kugou] resolve failed', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'resolve_failed' }, 502);
  }
};
