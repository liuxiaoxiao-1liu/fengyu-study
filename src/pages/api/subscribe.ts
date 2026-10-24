import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { addSubscriber } from '../../lib/newsletter-db';

export const prerender = false;

const MAX_BODY_BYTES = 4 * 1024;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// 内存限流：单实例够用；容器重启后清零，作为 nginx 限流之外的兜底。
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
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
  // 只在 Node 只监听本地/容器内网、且 nginx 反代时信任这些头。
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return clientAddress || 'unknown';
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 12);
}

function isRateLimited(ipHash: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(ipHash) ?? []).filter((at) => now - at < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    buckets.set(ipHash, recent);
    return true;
  }

  recent.push(now);
  buckets.set(ipHash, recent);

  // 简单清理，避免 Map 无限增长。
  if (buckets.size > 2000) {
    for (const [key, times] of buckets) {
      if (!times.some((at) => now - at < WINDOW_MS)) buckets.delete(key);
    }
  }

  return false;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: 'payload_too_large' }, 413);
    }

    let input: Record<string, unknown>;
    try {
      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json({ ok: false, error: 'invalid_json' }, 400);
      }
      input = body as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    // 蜜罐：正常访客不会填这个隐藏字段，命中就静默返回成功，不写库。
    if (typeof input.website === 'string' && input.website.trim() !== '') {
      return json({ ok: true });
    }

    if (typeof input.email !== 'string') {
      return json(
        { ok: false, error: 'invalid_email', message: '请填写一个有效的邮箱地址。' },
        422,
      );
    }

    const email = input.email.trim().toLowerCase();
    if (email === '' || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      return json(
        { ok: false, error: 'invalid_email', message: '邮箱格式看起来不太对，请检查一下。' },
        422,
      );
    }

    const ipHash = hashIp(clientIp(request, clientAddress));
    if (isRateLimited(ipHash)) {
      return json(
        { ok: false, error: 'rate_limited', message: '提交得太频繁了，过十分钟再试。' },
        429,
      );
    }

    const { created } = addSubscriber(email, 'quarterly');

    return json({
      ok: true,
      already: !created,
      message: created
        ? '订阅成功，下一期季刊会寄到这个邮箱。'
        : '这个邮箱已经在订阅名单里了，不会重复记录。',
    });
  } catch (error) {
    console.error('[subscribe] POST failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
