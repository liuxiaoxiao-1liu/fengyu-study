import type { APIRoute } from 'astro';
import { requireContentAdmin } from '../../../../lib/admin-auth';
import { checkQrLogin, createQrLogin } from '../../../../lib/kugou-login';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const denied = requireContentAdmin(request);
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
  const denied = requireContentAdmin(request);
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
