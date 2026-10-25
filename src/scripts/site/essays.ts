import { onPageLoad } from './page-init';

onPageLoad('essays', () => {
  const tabs = [...document.querySelectorAll<HTMLElement>('.filter-tab')];
  const cards = [...document.querySelectorAll<HTMLElement>('article[data-target]')];
  const empty = document.getElementById('essays-empty');
  const excerptSection = document.querySelector<HTMLElement>('[data-excerpt-section]');

  function apply(target: string) {
    let shown = 0;
    for (const card of cards) {
      const match = target === 'all' || card.dataset.target === target;
      card.classList.toggle('hidden', !match);
      if (match) shown += 1;
    }
    // 「台词摘录」是独立卡片区，切到随笔筛选时整块收起。
    excerptSection?.classList.toggle('hidden', target !== 'all' && target !== 'excerpt');
    empty?.classList.toggle('hidden', shown !== 0);
  }

  // 标签检索：列表卡片和侧栏主题标签都可用，点击后只显示包含该标签的随笔。
  for (const button of document.querySelectorAll<HTMLElement>('[data-tag]')) {
    button.addEventListener('click', () => {
      const tag = button.dataset.tag ?? '';
      let shown = 0;
      for (const card of cards) {
        const match = (card.dataset.tags ?? '').split('|').includes(tag);
        card.classList.toggle('hidden', !match);
        if (match) shown += 1;
      }
      excerptSection?.classList.add('hidden');
      empty?.classList.toggle('hidden', shown !== 0);
    });
  }

  const newsletter = document.getElementById('newsletter-form') as HTMLFormElement | null;
  const emailInput = document.getElementById('newsletter-email') as HTMLInputElement | null;
  const newsletterNote = document.getElementById('newsletter-note');
  const newsletterSubmit = newsletter?.querySelector<HTMLButtonElement>('button[type="submit"]');

  const setNote = (message: string) => {
    if (newsletterNote) newsletterNote.textContent = message;
  };

  newsletter?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput?.value.trim() ?? '';
    if (!email || !emailInput?.checkValidity()) {
      setNote('邮箱格式好像不太对，再检查一下。');
      emailInput?.focus();
      return;
    }
    newsletterSubmit?.setAttribute('disabled', '');
    setNote('正在投递…');
    try {
      const honeypot = newsletter?.querySelector<HTMLInputElement>('[name="website"]')?.value ?? '';
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ email, website: honeypot }),
      });
      const data = (await response.json().catch(() => ({ ok: false }))) as { ok?: boolean };
      if (response.ok && data.ok !== false) {
        setNote('已加入季刊名单，寄出前会先给你写信。');
        newsletter?.reset();
      } else if (response.status === 429) {
        setNote('投递太频繁了，请稍后再试。');
      } else if (response.status === 400) {
        setNote('邮箱格式好像不太对，再检查一下。');
      } else {
        setNote('订阅暂不可用，稍后再试，或先用 RSS 订阅。');
      }
    } catch {
      setNote('网络好像断了，稍后再试，或先用 RSS 订阅。');
    } finally {
      newsletterSubmit?.removeAttribute('disabled');
    }
  });

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const t of tabs) {
        t.classList.remove('bg-primary-container', 'text-on-primary', 'shadow-sm');
        t.classList.add('text-on-surface-variant');
      }
      tab.classList.remove('text-on-surface-variant');
      tab.classList.add('bg-primary-container', 'text-on-primary', 'shadow-sm');
      apply(tab.dataset.target || 'all');
    });
  }
});
