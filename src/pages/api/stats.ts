import type { APIRoute } from 'astro';
import { getLetterCounts } from '../../lib/guestbook-db';
import { json } from '../../lib/http';

export const prerender = false;

/**
 * 公开统计：只返回聚合数字，不含任何留言内容。
 * replyRate 只统计公开可见的留言（approved 且非私密），避免把悄悄话算进回复率分母。
 */
export const GET: APIRoute = async () => {
  try {
    const letters = getLetterCounts();
    const replyRate = letters.publicTotal > 0 ? Math.round((letters.publicReplied / letters.publicTotal) * 100) : 0;
    return json({ ok: true, letters, replyRate });
  } catch (error) {
    console.error('[stats] GET failed', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
};
