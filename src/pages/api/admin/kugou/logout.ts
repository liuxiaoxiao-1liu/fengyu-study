import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin-auth';
import { json } from '../../../../lib/http';
import { kugouLogout } from '../../../../lib/kugou-login';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  kugouLogout();
  return json({ ok: true });
};
