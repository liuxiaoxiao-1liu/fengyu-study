import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-auth';
import { ADMIN_SCHEMAS } from '../../../lib/content-schema';
import { json } from '../../../lib/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return json({ ok: true, schemas: ADMIN_SCHEMAS });
};
