import { fetchStats } from './api';

export function initStats() {
  async function loadStats() {
    const data = await fetchStats();
    if (!data || !data.ok || !data.letters) return;
    const values: Record<string, string | number | undefined> = {
      total: data.letters.publicTotal,
      approved: data.letters.approved,
      replied: data.letters.publicReplied,
      'reply-rate': typeof data.replyRate === 'number' ? `${data.replyRate}%` : undefined,
    };
    for (const node of document.querySelectorAll<HTMLElement>('[data-stat]')) {
      const key = node.dataset.stat ?? '';
      const value = values[key];
      if (value !== undefined && value !== null) node.textContent = String(value);
    }
  }

  return { refresh: loadStats };
}
