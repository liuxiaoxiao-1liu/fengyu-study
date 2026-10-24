import type { APIRoute } from 'astro';
import { requireContentAdmin } from '../../../../lib/admin-auth';
import { createContentRecord, listContentRecords, type RecordType } from '../../../../lib/content-db';
import { getAdminSchema, parseContentInput } from '../../../../lib/content-schema';

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

function recordType(value: string | undefined): RecordType | null {
  if (!value) return null;
  const schema = getAdminSchema(value);
  return schema ? (schema.type as RecordType) : null;
}

export const GET: APIRoute = async ({ request, params }) => {
  const denied = requireContentAdmin(request);
  if (denied) return denied;
  const type = recordType(params.type);
  if (!type) return json({ ok: false, error: 'unknown_type' }, 404);
  return json({ ok: true, records: listContentRecords(type) });
};

export const POST: APIRoute = async ({ request, params }) => {
  const denied = requireContentAdmin(request);
  if (denied) return denied;
  const type = recordType(params.type);
  if (!type) return json({ ok: false, error: 'unknown_type' }, 404);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return json({ ok: false, error: 'invalid_json' }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const parsed = parseContentInput(type, body);
  if (!parsed.ok) return json({ ok: false, error: 'invalid_record', message: parsed.error }, 422);

  try {
    const record = createContentRecord(type, parsed.value);
    return json({ ok: true, record }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE/i.test(message)) return json({ ok: false, error: 'duplicate_slug', message: 'slug 已存在' }, 409);
    console.error('[admin/content] create failed', message);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
