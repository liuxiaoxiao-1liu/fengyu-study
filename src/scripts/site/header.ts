type HeaderState = {
  currentHeader: HTMLElement | null;
  cleanup: (() => void) | null;
};

const STATE_KEY = '__fengyuHeaderState';

type NowPlayingDetail = {
  title?: string;
  artist?: string;
  playing?: boolean;
};

function getState(): HeaderState {
  const global = window as unknown as Record<string, unknown>;
  const existing = global[STATE_KEY] as HeaderState | undefined;
  if (existing) return existing;
  const state: HeaderState = { currentHeader: null, cleanup: null };
  global[STATE_KEY] = state;
  return state;
}

function setNowPlaying(detail: NowPlayingDetail): void {
  const chip = document.querySelector<HTMLElement>('[data-now]');
  if (!chip) return;
  const title = chip.querySelector<HTMLElement>('[data-now-title]');
  const sub = chip.querySelector<HTMLElement>('[data-now-sub]');
  const icon = chip.querySelector<HTMLElement>('[data-now-icon]');
  const playing = detail.playing === true;
  if (title) title.textContent = detail.title || (playing ? '正在播放' : '未在播放');
  if (sub) sub.textContent = detail.artist || (playing ? '打开播放器' : '打开酷狗歌单');
  if (icon) {
    icon.textContent = playing ? 'graphic_eq' : 'album';
    icon.classList.toggle('text-tertiary', playing);
    icon.classList.toggle('text-secondary', !playing);
  }
  chip.setAttribute(
    'aria-label',
    playing ? `正在播放 ${detail.title ?? ''}，查看酷狗歌单` : '查看酷狗歌单，当前未在播放',
  );
}

/**
 * Header 在 ClientRouter 换页后会被替换，但模块脚本不会重新执行。
 * 监听 astro:page-load，按 header 元素去重后重新绑定搜索、菜单、滚动与播放状态。
 */
export function initHeader(): void {
  const state = getState();
  const header = document.querySelector<HTMLElement>('header');
  if (!header || header === state.currentHeader) return;

  state.cleanup?.();
  state.currentHeader = header;

  // 顶栏在滚动后收窄，把首屏空间还给内容。
  const onScroll = (): void => {
    header.dataset.scrolled = window.scrollY > 8 ? 'true' : 'false';
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const menuToggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const mobileNav = document.getElementById('mobile-nav');
  const closeMenu = (): void => {
    menuToggle?.setAttribute('aria-expanded', 'false');
    mobileNav?.classList.add('hidden');
  };
  menuToggle?.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    mobileNav?.classList.toggle('hidden', open);
  });
  mobileNav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
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
        link.className = 'block rounded-lg px-3 py-2 hover:bg-surface-container-low transition-colors';
        if (/^https?:/i.test(entry.href)) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer external';
        }
        const head = document.createElement('span');
        head.className = 'flex items-baseline gap-2';
        const kind = document.createElement('span');
        kind.className = 'font-meta text-meta text-secondary uppercase tracking-[0.08em] shrink-0';
        kind.textContent = entry.kind;
        const title = document.createElement('span');
        title.className = 'font-body-md text-body-md text-primary';
        title.textContent = entry.title;
        head.append(kind, title);
        const summary = document.createElement('span');
        summary.className = 'block truncate font-body-sm text-body-sm text-muted';
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
    if (event.key === 'Escape') {
      if (dialog?.open) dialog.close();
      closeMenu();
      return;
    }
    // Cmd/Ctrl+K 与 "/" 都能唤起搜索，避免和浏览器快捷键冲突。
    const target = event.target as HTMLElement | null;
    const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
    if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === '/' && !typing) {
      event.preventDefault();
      openSearch();
    }
  };

  document.querySelectorAll('[data-search-open]').forEach((button) => {
    button.addEventListener('click', openSearch);
  });
  document.querySelector('[data-search-close]')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  input?.addEventListener('input', () => filterResults(input.value));

  // 搜索结果支持 ↑↓ 移动焦点，Enter 由原生链接处理。
  const moveResultFocus = (direction: 1 | -1): void => {
    const visible = results.filter((item) => !item.classList.contains('hidden'));
    if (!visible.length) return;
    const currentIndex = visible.indexOf(document.activeElement as HTMLElement);
    const nextIndex = currentIndex === -1 ? 0 : Math.min(visible.length - 1, Math.max(0, currentIndex + direction));
    visible[nextIndex]?.focus();
  };
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveResultFocus(event.key === 'ArrowDown' ? 1 : -1);
    }
  });
  resultsContainer?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveResultFocus(event.key === 'ArrowDown' ? 1 : -1);
    }
  });
  document.addEventListener('keydown', onKeydown);

  const onNowPlaying = (event: Event): void => {
    setNowPlaying((event as CustomEvent<NowPlayingDetail>).detail ?? {});
  };
  window.addEventListener('fengyu:track', onNowPlaying);

  state.cleanup = () => {
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('fengyu:track', onNowPlaying);
  };
}

initHeader();
document.addEventListener('astro:page-load', initHeader);
