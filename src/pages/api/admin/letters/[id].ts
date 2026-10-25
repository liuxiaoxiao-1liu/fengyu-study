import type { APIRoute } from 'astro';
import { adminGuard, cleanText, json, readJsonObject } from '../_utils';
import {
  deleteAdminLetter,
  isLetterStatus,
  updateAdminLetter,
  type LetterStatus,
  type UpdateLetterPatch,
} from '../../../../lib/guestbook-db';

export const prerender = false;

const MAX_REPLY_LENGTH = 2000;

export const PATCH: APIRoute = async ({ request, params }) => {
  const denied = adminGuard(request);
  if (denied) return denied;

  const id = params.id;
  if (!id) {
    return json({ ok: false, error: 'missing_id' }, 400);
  }

  const body = await readJsonObject(request);
  if (!body) {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const patch: UpdateLetterPatch = {};

  if ('status' in body) {
    if (!isLetterStatus(body.status)) {
      return json({ ok: false, error: 'invalid_status' }, 400);
    }
    patch.status = body.status as LetterStatus;
  }

  if ('reply' in body) {
    if (typeof body.reply !== 'string') {
      return json({ ok: false, error: 'invalid_reply' }, 400);
    }
    patch.reply = cleanText(body.reply, MAX_REPLY_LENGTH);
  }

  if (patch.status === undefined && patch.reply === undefined) {
    return json({ ok: false, error: 'no_fields' }, 400);
  }

  try {
    const letter = updateAdminLetter(id, patch);
    if (!letter) {
      return json({ ok: false, error: 'not_found' }, 404);
    }
    return json({ ok: true, letter });
  } catch (error) {
    console.error('[admin/letters/:id] PATCH failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const denied = adminGuard(request);
  if (denied) return denied;

  const id = params.id;
  if (!id) return json({ ok: false, error: 'missing_id' }, 400);

  try {
    return deleteAdminLetter(id) ? json({ ok: true }) : json({ ok: false, error: 'not_found' }, 404);
  } catch (error) {
    console.error('[admin/letters/:id] DELETE failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
