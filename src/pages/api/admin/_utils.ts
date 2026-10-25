import { createHash, timingSafeEqual } from 'node:crypto';
import { isAdminAuthConfigured, readAdminSession } from '../../../lib/admin-auth';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

/**
 * 管理端鉴权：
 * - 优先接受 /admin/ 登录后的 cookie 会话；
 * - 旧 Bearer ADMIN_TOKEN 继续兼容 /admin/letters/；
 * - 两种凭据都没配置 → 503 admin_disabled；
 * - 配了但缺失/错误 → 401 unauthorized。
 */
export function adminGuard(request: Request): Response | null {
  if (readAdminSession(request)) return null;

  const expected = process.env.ADMIN_TOKEN ?? '';
  if (expected === '') {
    if (isAdminAuthConfigured()) return json({ ok: false, error: 'unauthorized' }, 401);
    return json({ ok: false, error: 'admin_disabled' }, 503);
  }

  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const provided = match?.[1] ?? '';

  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  const tokenMatches = timingSafeEqual(providedHash, expectedHash);

  if (provided === '' || !tokenMatches) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  return null;
}

/** 去掉控制字符、首尾空白，并截断到 max 长度；非字符串一律当空串。 */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
