import { createHash, timingSafeEqual } from 'node:crypto';

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
 * - ADMIN_TOKEN 未设置 → 503 admin_disabled（后台整体关闭）；
 * - 缺失 / 错误 Bearer → 401 unauthorized；
 * - 比较走 sha256 + timingSafeEqual，长度不同也不会有提前返回的时间差。
 */
export function adminGuard(request: Request): Response | null {
  const expected = process.env.ADMIN_TOKEN ?? '';
  if (expected === '') {
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
