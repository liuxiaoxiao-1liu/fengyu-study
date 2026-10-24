import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'fengyu_admin';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type AdminSession = { user: string; exp: number };

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? '';
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD_HASH && secret());
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqualText(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

/** 校验密码；哈希格式 scrypt:<saltHex>:<hashHex>，由 scripts/set-admin-password.mjs 生成。 */
export function verifyAdminPassword(password: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH ?? '';
  const [scheme, saltHex, hashHex] = stored.split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function verifyAdminUsername(username: string): boolean {
  const expected = process.env.ADMIN_USER ?? '';
  return expected !== '' && safeEqualText(username, expected);
}

export function createSessionCookie(user: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64url(JSON.stringify({ user, exp }));
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(request: Request, name: string): string {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key === name) return part.slice(index + 1).trim();
  }
  return '';
}

export function readAdminSession(request: Request): AdminSession | null {
  if (!secret()) return null;
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AdminSession>;
    if (typeof data.user !== 'string' || typeof data.exp !== 'number') return null;
    if (data.exp * 1000 < Date.now()) return null;
    return { user: data.user, exp: data.exp };
  } catch {
    return null;
  }
}

/** 内容 API 鉴权：优先 cookie 会话，也兼容旧的 Bearer ADMIN_TOKEN。 */
export function requireContentAdmin(request: Request): Response | null {
  if (readAdminSession(request)) return null;

  const expected = process.env.ADMIN_TOKEN ?? '';
  if (expected) {
    const header = request.headers.get('authorization') ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    const provided = match?.[1] ?? '';
    if (provided && safeEqualText(provided, expected)) return null;
  }

  return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
