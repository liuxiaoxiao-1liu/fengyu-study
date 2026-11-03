import { onPageLoad } from './page-init';

type ReadingSize = 'sm' | 'md' | 'lg';

const STORAGE_KEY = 'fengyu:reading-size';

function applySize(size: ReadingSize): void {
  document.documentElement.dataset.readingSize = size;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-font-size]')) {
    button.setAttribute('aria-pressed', String(button.dataset.fontSize === size));
  }
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // 隐私模式下写不进去也不影响阅读
  }
}

onPageLoad('essay-detail', () => {
  let stored: ReadingSize = 'md';
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'sm' || value === 'md' || value === 'lg') stored = value;
  } catch {
    // ignore
  }
  applySize(stored);

  document.querySelectorAll<HTMLButtonElement>('[data-font-size]').forEach((button) => {
    button.addEventListener('click', () => {
      const size = button.dataset.fontSize;
      if (size === 'sm' || size === 'md' || size === 'lg') applySize(size);
    });
  });

  document.querySelector<HTMLButtonElement>('[data-print]')?.addEventListener('click', () => window.print());

  const status = document.querySelector<HTMLElement>('[data-copy-status]');
  document.querySelector<HTMLButtonElement>('[data-copy-link]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      if (status) status.textContent = '链接已复制';
    } catch {
      if (status) status.textContent = '复制失败，请手动复制地址栏';
    }
    window.setTimeout(() => {
      if (status) status.textContent = '';
    }, 2400);
  });
});
