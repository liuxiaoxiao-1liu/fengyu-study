import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/admin-auth';
import { json } from '../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async () => {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
};
