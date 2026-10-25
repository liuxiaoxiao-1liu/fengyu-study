import type { APIRoute } from 'astro';
import { readAdminSession } from '../../../lib/admin-auth';
import { json } from '../../../lib/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const session = readAdminSession(request);
  if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
  return json({ ok: true, user: session.user });
};
