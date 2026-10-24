import type { APIRoute } from 'astro';
import { readAdminSession } from '../../../lib/admin-auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const session = readAdminSession(request);
  if (!session) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(JSON.stringify({ ok: true, user: session.user }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
