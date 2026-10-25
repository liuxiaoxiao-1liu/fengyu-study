type HeaderState = {
  currentHeader: HTMLElement | null;
  cleanup: (() => void) | null;
};

const STATE_KEY = '__fengyuHeaderState';

function getState(): HeaderState {
  const global = window as unknown as Record<string, unknown>;
  const existing = global[STATE_KEY] as HeaderState | undefined;
  if (existing) return existing;
  const state: HeaderState = { currentHeader: null, cleanup: null };
  global[STATE_KEY] = state;
  return state;
}

/**
 * Header 在 ClientRouter 换页后会被替换，但模块脚本不会重新执行。
 * 监听 astro:page-load，按 header 元素去重后重新绑定搜索与移动菜单。
 */
export function initHeader(): void {
  const state = getState();
  const header = document.querySelector<HTMLElement>('header');
  if (!header || header === state.currentHeader) return;

  state.cleanup?.();
  state.currentHeader = header;

  const menuToggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const mobileNav = document.getElementById('mobile-nav');
  menuToggle?.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    mobileNav?.classList.toggle('hidden', open);
  });
  mobileNav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle?.setAttribute('aria-expanded', 'false');
      mobileNav?.classList.add('hidden');
    });
  });

  const dialog = document.getElementById('search-dialog') as HTMLDialogElement | null;
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  const resultsContainer = document.querySelector<HTMLElement>('[data-search-results]');
  let results = [...document.querySelectorAll<HTMLElement>('[data-result]')];
  const empty = document.querySelector<HTMLElement>('[data-search-empty]');
  const countLabel = document.querySelector<HTMLElement>('[data-search-count]');
  let searchIndexLoaded = false;
  let searchIndexLoading = false;

  function filterResults(query: string): void {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const item of results) {
      const haystack = (item.dataset.search ?? '').toLowerCase();
      const match = !q || haystack.includes(q);
      item.classList.toggle('hidden', !match);
      if (match) shown += 1;
    }
    empty?.classList.toggle('hidden', shown !== 0);
  }

  async function loadSearchIndex(): Promise<void> {
    if (searchIndexLoaded || searchIndexLoading || !resultsContainer) return;
    searchIndexLoading = true;
    try {
      const response = await fetch('/api/content/search', { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = (await response.json()) as {
        entries?: Array<{ title: string; href: string; kind: string; summary: string }>;
      };
      if (!Array.isArray(data.entries)) return;
      for (const old of results) old.remove();
      for (const entry of data.entries) {
        const link = document.createElement('a');
        link.href = entry.href;
        link.dataset.result = '';
        link.dataset.search = [entry.title, entry.summary, entry.kind].join(' ');
        link.className = 'block px-space-md py-space-sm rounded-lg hover:bg-surface-container-low transition-colors';
        if (/^https?:/i.test(entry.href)) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer external';
        }
        const head = document.createElement('span');
        head.className = 'flex items-baseline gap-space-sm';
        const kind = document.createElement('span');
        kind.className = 'font-label-sm text-label-sm text-secondary uppercase tracking-wider shrink-0';
        kind.textContent = entry.kind;
        const title = document.createElement('span');
        title.className = 'font-body-md text-body-md text-primary';
        title.textContent = entry.title;
        head.append(kind, title);
        const summary = document.createElement('span');
        summary.className = 'block font-body-sm text-body-sm text-on-surface-variant truncate';
        summary.textContent = entry.summary;
        link.append(head, summary);
        resultsContainer.insertBefore(link, empty);
      }
      results = [...resultsContainer.querySelectorAll<HTMLElement>('[data-result]')];
      if (countLabel) countLabel.textContent = `共 ${data.entries.length} 条索引`;
      searchIndexLoaded = true;
      if (input) filterResults(input.value);
    } catch {
      // 网络失败时保留构建期索引，不打断搜索
    } finally {
      searchIndexLoading = false;
    }
  }

  function openSearch(): void {
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    void loadSearchIndex();
    if (input) {
      input.value = '';
      filterResults('');
      window.setTimeout(() => input.focus(), 30);
    }
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && dialog?.open) dialog.close();
  };

  document.querySelectorAll('[data-search-open]').forEach((button) => {
    button.addEventListener('click', openSearch);
  });
  document.querySelector('[data-search-close]')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  input?.addEventListener('input', () => filterResults(input.value));
  document.addEventListener('keydown', onKeydown);

  state.cleanup = () => document.removeEventListener('keydown', onKeydown);
}

initHeader();
document.addEventListener('astro:page-load', initHeader);
