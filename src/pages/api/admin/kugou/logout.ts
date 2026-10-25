import type { APIRoute } from 'astro';
import { requireContentAdmin } from '../../../../lib/admin-auth';
import { kugouLogout } from '../../../../lib/kugou-login';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireContentAdmin(request);
  if (denied) return denied;
  kugouLogout();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
