import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { insertLetter, listPublicLetters, secondsSinceLastPost } from '../../lib/guestbook-db';
import { json } from '../../lib/http';
import { clientIp, hashIp } from '../../lib/rate-limit';
import { text as clean } from '../../lib/validate';

export const prerender = false;

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_SECONDS = 60;

export const GET: APIRoute = async () => {
  try {
    const { messages, total } = listPublicLetters(60);
    return json({ ok: true, messages, total });
  } catch (error) {
    console.error('[guestbook] GET failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: 'payload_too_large' }, 413);
    }

    let input: Record<string, unknown>;
    try {
      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json({ ok: false, error: 'invalid_json' }, 400);
      }
      input = body as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    // 蜜罐：正常用户不会填这个隐藏字段
    if (typeof input.website === 'string' && input.website.trim() !== '') {
      return json({ ok: true });
    }

    const name = clean(input.name, 40);
    const station = clean(input.station, 100);
    const message = clean(input.message, 800);
    const tag = clean(input.tag, 20) || '网文同好';
    const isPrivate = input.private === true || input.private === 1 || input.private === '1';

    if (!name || !message) {
      return json({ ok: false, error: 'missing_fields', message: '昵称和正文都要写一点。' }, 422);
    }

    const ip = clientIp(request, clientAddress);
    const ipHash = hashIp(ip);

    const since = secondsSinceLastPost(ipHash);
    if (since !== null && since < RATE_LIMIT_SECONDS) {
      return json({ ok: false, error: 'rate_limited', message: '投递得太快了，歇一会儿再写吧。' }, 429);
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();

    insertLetter({
      id,
      name,
      station,
      message,
      tag,
      isPrivate,
      ipHash,
      createdAt,
    });

    return json({
      ok: true,
      private: isPrivate,
      message: isPrivate ? '悄悄话已经收妥，只有房主会在夜里拆封。' : '信笺已上墙，谢谢你让这间书房多了一盏灯。',
    });
  } catch (error) {
    console.error('[guestbook] POST failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
