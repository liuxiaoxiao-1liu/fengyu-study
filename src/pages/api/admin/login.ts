import type { APIRoute } from 'astro';
import {
  createSessionCookie,
  isAdminAuthConfigured,
  verifyAdminPassword,
  verifyAdminUsername,
} from '../../../lib/admin-auth';

export const prerender = false;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, number[]>();

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

function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return 'unknown';
}

function hitRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  attempts.set(ip, recent);
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthConfigured()) {
    return json({ ok: false, error: 'admin_disabled' }, 503);
  }

  if (hitRateLimit(clientIp(request))) {
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

  return new Response(JSON.stringify({ ok: true, user: username }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': createSessionCookie(username),
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
