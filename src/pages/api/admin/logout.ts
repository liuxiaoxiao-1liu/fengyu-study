import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearSessionCookie(),
    },
  });
};
