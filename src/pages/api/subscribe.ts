import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
import { addSubscriber } from '../../lib/newsletter-db';
import { clientIp, createRateLimiter } from '../../lib/rate-limit';

export const prerender = false;

const MAX_BODY_BYTES = 4 * 1024;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const limiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  hashKey: true,
  hashLength: 12,
});

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
      return json({ ok: false, error: 'invalid_email', message: '请填写一个有效的邮箱地址。' }, 422);
    }

    const email = input.email.trim().toLowerCase();
    if (email === '' || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      return json({ ok: false, error: 'invalid_email', message: '邮箱格式看起来不太对，请检查一下。' }, 422);
    }

    if (limiter.hit(clientIp(request, clientAddress))) {
      return json({ ok: false, error: 'rate_limited', message: '提交得太频繁了，过十分钟再试。' }, 429);
    }

    const { created } = addSubscriber(email, 'quarterly');

    return json({
      ok: true,
      already: !created,
      message: created ? '订阅成功，下一期季刊会寄到这个邮箱。' : '这个邮箱已经在订阅名单里了，不会重复记录。',
    });
  } catch (error) {
    console.error('[subscribe] POST failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
