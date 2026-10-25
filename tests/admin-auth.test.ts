import { scryptSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSessionCookie,
  isAdminAuthConfigured,
  requireAdmin,
  verifyAdminPassword,
  verifyAdminUsername,
} from '../src/lib/admin-auth';

const USER = 'owner';
const PASSWORD = 'correct horse battery staple';
const SECRET = 'test-session-secret';
const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const hash = scryptSync(PASSWORD, salt, 64);
const HASH = `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/admin/session', { headers });
}

function cookieToken(): string {
  const cookie = createSessionCookie(USER);
  return cookie.split(';')[0]!;
}

beforeEach(() => {
  process.env.ADMIN_USER = USER;
  process.env.ADMIN_PASSWORD_HASH = HASH;
  process.env.ADMIN_SESSION_SECRET = SECRET;
  delete process.env.ADMIN_TOKEN;
});

afterEach(() => {
  delete process.env.ADMIN_USER;
  delete process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_TOKEN;
});

describe('admin credentials', () => {
  it('verifies the configured username and password', () => {
    expect(isAdminAuthConfigured()).toBe(true);
    expect(verifyAdminUsername(USER)).toBe(true);
    expect(verifyAdminUsername('someone')).toBe(false);
    expect(verifyAdminPassword(PASSWORD)).toBe(true);
    expect(verifyAdminPassword('wrong')).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('accepts a signed session cookie', () => {
    expect(requireAdmin(request({ cookie: cookieToken() }))).toBeNull();
  });

  it('rejects a missing or tampered cookie with 401', () => {
    expect(requireAdmin(request())?.status).toBe(401);
    expect(requireAdmin(request({ cookie: 'fengyu_admin=tampered.sig' }))?.status).toBe(401);
  });

  it('accepts a legacy Bearer token when configured', () => {
    process.env.ADMIN_TOKEN = 'legacy-token';
    expect(requireAdmin(request({ authorization: 'Bearer legacy-token' }))).toBeNull();
    expect(requireAdmin(request({ authorization: 'Bearer wrong' }))?.status).toBe(401);
  });

  it('returns 503 when neither cookie auth nor a legacy token is configured', () => {
    delete process.env.ADMIN_USER;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_SESSION_SECRET;
    expect(requireAdmin(request())?.status).toBe(503);
  });
});

describe('session cookie', () => {
  it('is HttpOnly and SameSite=Lax', () => {
    const cookie = createSessionCookie(USER);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });
});
