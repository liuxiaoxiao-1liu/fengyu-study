import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-auth';
import { isLetterStatus, listAdminLetters, type LetterStatus } from '../../../lib/guestbook-db';
import { json } from '../../../lib/http';

export const prerender = false;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export const GET: APIRoute = async ({ request, url }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const statusParam = url.searchParams.get('status') ?? 'all';
  if (statusParam !== 'all' && !isLetterStatus(statusParam)) {
    return json({ ok: false, error: 'invalid_status' }, 400);
  }

  const requestedLimit = Number(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const status: LetterStatus | 'all' = statusParam === 'all' || isLetterStatus(statusParam) ? statusParam : 'all';

  try {
    const { letters, counts } = listAdminLetters(status, limit);
    return json({ ok: true, status, letters, counts });
  } catch (error) {
    console.error('[admin/letters] GET failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
