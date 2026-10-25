import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/admin-auth';
import { checkQrLogin, createQrLogin } from '../../../../lib/kugou-login';
import { json } from '../../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const qr = await createQrLogin();
    return json({ ok: true, qr: { key: qr.key, image: qr.image, url: qr.url, expiresAt: qr.expiresAt } });
  } catch (cause) {
    return json(
      { ok: false, error: 'qr_failed', message: cause instanceof Error ? cause.message : String(cause) },
      502,
    );
  }
};

export const GET: APIRoute = async ({ request, url }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const key = url.searchParams.get('key') ?? '';
  if (!key) return json({ ok: false, error: 'missing_key' }, 400);
  try {
    const result = await checkQrLogin(key);
    return json({ ok: true, ...result });
  } catch (cause) {
    return json(
      { ok: false, error: 'check_failed', message: cause instanceof Error ? cause.message : String(cause) },
      502,
    );
  }
};
