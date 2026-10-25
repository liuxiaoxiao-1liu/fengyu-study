import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/admin-auth';
import {
  deleteContentRecord,
  getContentRecord,
  updateContentRecord,
  type RecordType,
} from '../../../../../lib/content-db';
import { getAdminSchema, parseContentInput } from '../../../../../lib/content-schema';
import { json } from '../../../../../lib/http';

export const prerender = false;

function recordType(value: string | undefined): RecordType | null {
  if (!value) return null;
  const schema = getAdminSchema(value);
  return schema ? (schema.type as RecordType) : null;
}

export const PATCH: APIRoute = async ({ request, params }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const type = recordType(params.type);
  if (!type) return json({ ok: false, error: 'unknown_type' }, 404);
  const id = params.id;
  if (!id || !getContentRecord(type, id)) return json({ ok: false, error: 'not_found' }, 404);

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
    const record = updateContentRecord(type, id, parsed.value);
    return record ? json({ ok: true, record }) : json({ ok: false, error: 'not_found' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE/i.test(message)) return json({ ok: false, error: 'duplicate_slug', message: 'slug 已存在' }, 409);
    console.error('[admin/content] update failed', message);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const type = recordType(params.type);
  if (!type) return json({ ok: false, error: 'unknown_type' }, 404);
  const id = params.id;
  if (!id) return json({ ok: false, error: 'not_found' }, 404);
  return deleteContentRecord(type, id) ? json({ ok: true }) : json({ ok: false, error: 'not_found' }, 404);
};
