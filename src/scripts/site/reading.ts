import { onPageLoad } from './page-init';

onPageLoad('reading', () => {
  const tabs = [...document.querySelectorAll<HTMLElement>('.filter-btn')];
  const shelf = document.getElementById('shelf');
  const music = document.getElementById('music');
  const bookCards = shelf ? [...shelf.querySelectorAll<HTMLElement>('[data-card="book"]')] : [];

  function setActive(active: HTMLElement) {
    for (const tab of tabs) {
      const on = tab === active;
      tab.classList.toggle('bg-primary', on);
      tab.classList.toggle('text-on-primary', on);
      tab.classList.toggle('shadow-sm', on);
      tab.classList.toggle('text-on-surface-variant', !on);
    }
  }

  function applyFilter(filter: string) {
    const isBook = filter === 'webnovel' || filter === 'suspense';
    const isMusic = filter === 'kugou' || filter === 'repeat';
    const matches = (card: HTMLElement) => {
      if (filter === 'all') return true;
      return (card.dataset.category || '').split(/\s+/).includes(filter);
    };
    if (shelf) shelf.classList.toggle('hidden', isMusic);
    if (music) music.classList.toggle('hidden', isBook);
    for (const card of bookCards) {
      card.style.display = !isMusic && matches(card) ? '' : 'none';
    }
    for (const card of music ? [...music.querySelectorAll<HTMLElement>('[data-card="track"]')] : []) {
      card.style.display = !isBook && matches(card) ? '' : 'none';
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      setActive(tab);
      applyFilter(tab.dataset.filter || 'all');
    });
  }

  const playlistList = document.getElementById('playlist-tracks');
  const pager = document.getElementById('playlist-pager');
  const pagePrev = pager?.querySelector<HTMLButtonElement>('[data-page-prev]') ?? null;
  const pageNext = pager?.querySelector<HTMLButtonElement>('[data-page-next]') ?? null;
  const pageInfo = pager?.querySelector<HTMLElement>('[data-page-info]') ?? null;
  const PAGE_SIZE = 30;

  let activeSlug = 'maotouying';
  let activePage = 1;
  let totalPages = 1;

  const make = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text?: string,
  ): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const searchUrl = (title: string, artist: string) =>
    `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${encodeURIComponent(`${title} ${artist}`.trim())}`;

  function buildRow(track: { hash: string; title: string; artist: string; duration: string }): HTMLElement {
    const row = make(
      'div',
      'group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg hover:bg-surface-container transition-colors',
    );
    row.dataset.card = 'track';
    row.dataset.category = 'kugou';

    const left = make('div', 'flex items-center gap-3 min-w-0');
    const button = make(
      'button',
      'w-8 h-8 rounded-full bg-surface-container-high group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center text-on-surface-variant transition-colors flex-shrink-0',
    );
    button.type = 'button';
    button.setAttribute('data-play', '');
    button.dataset.hash = track.hash;
    button.dataset.title = track.title;
    button.dataset.artist = track.artist;
    button.dataset.external = searchUrl(track.title, track.artist);
    button.setAttribute('aria-label', `播放 ${track.title}`);
    button.append(make('span', 'material-symbols-outlined text-sm', 'play_arrow'));

    const meta = make('div', 'flex flex-col min-w-0');
    meta.append(
      make(
        'span',
        'font-headline-sm text-base text-primary truncate group-hover:text-on-tertiary-container transition-colors',
        track.title,
      ),
      make('span', 'font-label-sm text-label-sm text-on-surface-variant truncate', track.artist),
    );
    left.append(button, meta);

    const right = make('div', 'flex items-center gap-3 flex-shrink-0 pl-11 sm:pl-0');
    right.append(
      make(
        'span',
        'px-2 py-0.5 rounded font-label-sm text-xs bg-secondary-container text-on-secondary-container hidden sm:inline-block',
        '站内播放',
      ),
      make('span', 'font-label-sm text-label-sm text-on-surface-variant tabular-nums', track.duration),
    );
    row.append(left, right);
    return row;
  }

  function render(data: {
    page: number;
    totalPages: number;
    playlist: { slug: string; name: string; total: number };
    tracks: Array<{ hash: string; title: string; artist: string; duration: string }>;
  }) {
    if (!playlistList) return;
    if (data.tracks.length === 0) {
      playlistList.replaceChildren(
        make(
          'p',
          'rounded-lg border border-dashed border-outline-variant p-6 text-center font-body-sm text-body-sm text-on-surface-variant',
          '这个歌单还没有歌曲。在酷狗里添加后，这里会在约 1 分钟内同步。',
        ),
      );
    } else {
      playlistList.replaceChildren(...data.tracks.map(buildRow));
    }
    for (const node of document.querySelectorAll<HTMLElement>('[data-playlist-count]')) {
      node.textContent = String(data.playlist.total ?? 0);
    }
    for (const node of document.querySelectorAll<HTMLElement>('[data-playlist-title]')) {
      node.textContent = `${data.playlist.name ?? 'maotouying'} · 我的歌单`;
    }
    activeSlug = data.playlist.slug;
    activePage = data.page;
    totalPages = data.totalPages;
    if (pageInfo) pageInfo.textContent = `第 ${data.page} / ${data.totalPages} 页`;
    if (pagePrev) pagePrev.disabled = data.page <= 1;
    if (pageNext) pageNext.disabled = data.page >= data.totalPages;
  }

  async function loadPlaylist(slug: string, page: number) {
    if (!playlistList) return;
    playlistList.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(
        `/api/kugou/playlist?slug=${encodeURIComponent(slug)}&page=${page}&pageSize=${PAGE_SIZE}`,
        { headers: { accept: 'application/json' } },
      );
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'load_failed');
      render(data);
    } catch {
      playlistList.replaceChildren(
        make(
          'p',
          'rounded-lg border border-dashed border-outline-variant p-6 text-center font-body-sm text-body-sm text-on-surface-variant',
          '歌单同步失败，稍后再试。',
        ),
      );
      if (pageInfo) pageInfo.textContent = '同步失败';
    } finally {
      playlistList.removeAttribute('aria-busy');
    }
  }

  pagePrev?.addEventListener('click', () => void loadPlaylist(activeSlug, Math.max(1, activePage - 1)));
  pageNext?.addEventListener('click', () => void loadPlaylist(activeSlug, Math.min(totalPages, activePage + 1)));
  void loadPlaylist(activeSlug, 1);
});
