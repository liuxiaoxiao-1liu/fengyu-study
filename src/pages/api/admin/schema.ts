import type { APIRoute } from 'astro';
import { requireContentAdmin } from '../../../lib/admin-auth';
import { ADMIN_SCHEMAS } from '../../../lib/content-schema';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const denied = requireContentAdmin(request);
  if (denied) return denied;
  return new Response(JSON.stringify({ ok: true, schemas: ADMIN_SCHEMAS }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
