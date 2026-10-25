import type { APIRoute } from 'astro';
import {
  createSessionCookie,
  isAdminAuthConfigured,
  verifyAdminPassword,
  verifyAdminUsername,
} from '../../../lib/admin-auth';
import { json } from '../../../lib/http';
import { clientIp, createRateLimiter } from '../../../lib/rate-limit';

export const prerender = false;

const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10, hashKey: false });

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthConfigured()) {
    return json({ ok: false, error: 'admin_disabled' }, 503);
  }

  if (limiter.hit(clientIp(request))) {
    return json({ ok: false, error: 'rate_limited', message: '尝试次数太多，过十分钟再试。' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) {
    return json({ ok: false, error: 'missing_credentials' }, 422);
  }

  if (!verifyAdminUsername(username) || !verifyAdminPassword(password)) {
    return json({ ok: false, error: 'invalid_credentials', message: '用户名或密码不正确。' }, 401);
  }

  return json({ ok: true, user: username }, 200, { 'Set-Cookie': createSessionCookie(username) });
};
