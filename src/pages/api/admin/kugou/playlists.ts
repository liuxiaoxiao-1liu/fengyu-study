import type { APIRoute } from 'astro';
import { requireContentAdmin } from '../../../../lib/admin-auth';
import { listKugouPlaylists } from '../../../../lib/kugou';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const denied = requireContentAdmin(request);
  if (denied) return denied;
  try {
    const playlists = await listKugouPlaylists();
    return new Response(JSON.stringify({ ok: true, playlists }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (cause) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'kugou_failed',
        message: cause instanceof Error ? cause.message : String(cause),
      }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }
};
