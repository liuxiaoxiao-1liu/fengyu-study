import { onPageLoad } from './page-init';

onPageLoad('home', () => {
  const homeForm = document.getElementById('home-letter-form') as HTMLFormElement | null;
  const homeToast = document.getElementById('letter-toast');
  const showHomeToast = (message: string) => {
    if (!homeToast) return;
    const label = homeToast.querySelector('span:last-child');
    if (label) label.textContent = message;
    homeToast.classList.remove('hidden');
    window.setTimeout(() => homeToast.classList.add('hidden'), 3500);
  };
  homeForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = (document.getElementById('home-name') as HTMLInputElement | null)?.value.trim() || '';
    const station = (document.getElementById('home-station') as HTMLInputElement | null)?.value.trim() || '';
    const message = (document.getElementById('home-message') as HTMLTextAreaElement | null)?.value.trim() || '';
    const isPrivate = (document.getElementById('home-private') as HTMLInputElement | null)?.checked || false;
    if (!name || !message) {
      showHomeToast('昵称和正文都要写一点，才好投递。');
      return;
    }
    const params = new URLSearchParams({ name, station, message, private: isPrivate ? '1' : '0' });
    window.location.href = `/guestbook/?${params.toString()}#guestbook-form`;
  });

  // 留言统计与最新来信都来自运行时 API；接口未就绪时显示占位，不写死假数。
  const setText = (selector: string, value: string) => {
    const node = document.querySelector<HTMLElement>(selector);
    if (node) node.textContent = value;
  };

  type StatsPayload = {
    ok?: boolean;
    replyRate?: number | string;
    letters?: { total?: number; publicTotal?: number };
  };

  type LetterPayload = {
    ok?: boolean;
    messages?: Array<{
      name?: unknown;
      station?: unknown;
      message?: unknown;
      created_at?: unknown;
    }>;
  };

  function formatRate(value: number | string | undefined): string | null {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return null;
    // /api/stats 的 replyRate 已经是 0–100 的百分数。
    return `${Math.max(0, Math.min(100, Math.round(rate)))}%`;
  }

  function formatLetterTime(value: unknown): string {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return '最近来信';
    const date = new Date(text.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '最近来信';
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function loadLetterStats() {
    try {
      const response = await fetch('/api/stats', { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as StatsPayload;
      if (!data.ok || !data.letters) throw new Error('bad payload');
      const rate = formatRate(data.replyRate);
      setText('[data-stat-reply]', rate ? `回复率 ${rate}` : '回复率暂不可用');
      const total = data.letters.publicTotal ?? data.letters.total;
      const label = typeof data.letters.publicTotal === 'number' ? '公开来信' : '已收来信';
      setText('[data-stat-total]', typeof total === 'number' ? `${label} ${total} 封` : '来信统计暂不可用');
    } catch {
      setText('[data-stat-reply]', '回复率暂不可用');
      setText('[data-stat-total]', '来信统计暂不可用');
    }
  }

  async function loadLatestLetter() {
    try {
      const response = await fetch('/api/guestbook', { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as LetterPayload;
      const letter = data.ok ? data.messages?.[0] : undefined;
      if (!letter) {
        setText('[data-preview-badge]', '暂无公开来信');
        setText('[data-preview-name]', '还没有公开来信');
        setText('[data-preview-time]', '—');
        setText('[data-preview-message]', '欢迎投递第一封字句，等它在夜里被拆封。');
        return;
      }
      const name = typeof letter.name === 'string' ? letter.name.trim() : '';
      const station = typeof letter.station === 'string' ? letter.station.trim() : '';
      setText('[data-preview-badge]', '最新来信');
      setText('[data-preview-name]', [name || '匿名读者', station].filter(Boolean).join(' · '));
      setText('[data-preview-time]', formatLetterTime(letter.created_at));
      setText(
        '[data-preview-message]',
        typeof letter.message === 'string' && letter.message.trim() ? letter.message.trim() : '（这封来信没有正文）',
      );
    } catch {
      // 接口失败时保留上方明确标注的「示例留言」。
      setText('[data-preview-badge]', '示例留言');
      setText('[data-preview-time]', '接口暂不可用');
    }
  }

  void loadLetterStats();
  void loadLatestLetter();
});
