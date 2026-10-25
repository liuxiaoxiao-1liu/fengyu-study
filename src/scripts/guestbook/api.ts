import type { LetterDraft, PublicLetter, StatsPayload } from './types';

/** 只取聚合数字；失败时返回 null，由调用方保留占位符。 */
export async function fetchStats(): Promise<StatsPayload | null> {
  try {
    const response = await fetch('/api/stats', { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as StatsPayload;
  } catch {
    // 静态预览没有 API，保留 — 占位即可。
    return null;
  }
}

export async function fetchPublicLetters(): Promise<PublicLetter[]> {
  const response = await fetch('/api/guestbook', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`http_${response.status}`);
  const data = (await response.json()) as { messages?: PublicLetter[] };
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function postLetter(payload: LetterDraft): Promise<{ message?: string }> {
  const response = await fetch('/api/guestbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
  if (!response.ok || !data.ok) {
    const friendly = response.status === 422 || response.status === 429;
    throw new Error(friendly ? data.message || '这封信暂时投递不了。' : 'offline');
  }
  return data;
}
