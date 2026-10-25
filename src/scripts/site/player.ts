const player = document.querySelector<HTMLElement>('[data-player]');
const playerWindow = window as typeof window & { __fengyuPlayerBooted?: boolean };

// View Transitions 会把播放器节点持久化；脚本可能重跑，只初始化一次，避免重复绑定。
if (player && !playerWindow.__fengyuPlayerBooted) {
  playerWindow.__fengyuPlayerBooted = true;
  const audio = player.querySelector<HTMLAudioElement>('[data-player-audio]');
  const toggle = player.querySelector<HTMLButtonElement>('[data-player-toggle]');
  const closeButton = player.querySelector<HTMLButtonElement>('[data-player-close]');
  const playIcon = player.querySelector<HTMLElement>('[data-player-icon-play]');
  const pauseIcon = player.querySelector<HTMLElement>('[data-player-icon-pause]');
  const title = player.querySelector<HTMLElement>('[data-player-title]');
  const artist = player.querySelector<HTMLElement>('[data-player-artist]');
  const state = player.querySelector<HTMLElement>('[data-player-state]');
  const current = player.querySelector<HTMLElement>('[data-player-current]');
  const duration = player.querySelector<HTMLElement>('[data-player-duration]');
  const seek = player.querySelector<HTMLInputElement>('[data-player-seek]');
  const external = player.querySelector<HTMLAnchorElement>('[data-player-external]');

  type TrackCommand = {
    hash?: string;
    audio?: string;
    title: string;
    artist: string;
    external: string;
  };

  let currentTrack: TrackCommand | null = null;
  let retried = false;
  let pendingResume = 0;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const total = Math.floor(seconds);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const showPlayer = () => {
    player.hidden = false;
    document.body.classList.add('has-player');
  };

  const hidePlayer = () => {
    player.hidden = true;
    document.body.classList.remove('has-player');
  };

  const setPlaying = (playing: boolean) => {
    playIcon?.classList.toggle('hidden', playing);
    pauseIcon?.classList.toggle('hidden', !playing);
    if (state) state.textContent = playing ? '· 正在播放' : '· 已暂停';
  };

  const updateDuration = () => {
    if (!audio) return;
    const known = Number.isFinite(audio.duration) && audio.duration > 0;
    if (duration) duration.textContent = known ? formatTime(audio.duration) : '--:--';
    if (seek) {
      seek.max = String(known ? audio.duration : 0);
      seek.disabled = !known;
    }
  };

  const readCommand = (button: HTMLButtonElement): TrackCommand => ({
    hash: button.dataset.hash || undefined,
    audio: button.dataset.audio || undefined,
    title: button.dataset.title || '未命名曲目',
    artist: button.dataset.artist || '',
    external: button.dataset.external || 'https://www.kugou.com/',
  });

  const setTrackMeta = (track: TrackCommand) => {
    if (title) title.textContent = track.title;
    if (artist) artist.textContent = track.artist;
    if (external) {
      external.href = track.external;
      external.classList.remove('hidden');
      external.classList.add('inline-flex');
    }
    if (current) current.textContent = '00:00';
    if (seek) seek.value = '0';
    if (toggle) toggle.disabled = false;
    if (seek) seek.disabled = false;
  };

  function describeError(data: { error?: string } | null, status: number) {
    if (data?.error === 'rate_limited' || status === 429) return '· 播放太频繁，稍后再试';
    if (data?.error === 'kugou_disabled' || status === 503) return '· 音源未配置，可去酷狗收听';
    return '· 解析失败，可去酷狗收听';
  }

  async function fetchPlayUrl(hash: string) {
    let lastStatus = 0;
    let lastData: { ok?: boolean; url?: string; error?: string } | null = null;

    // 网络抖错误一次；限流、未配置、白名单外不重试，避免放大请求。
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`/api/kugou/url?hash=${encodeURIComponent(hash)}`, {
        headers: { accept: 'application/json' },
      });
      lastStatus = response.status;
      lastData = (await response.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        error?: string;
      } | null;
      if (response.ok && lastData?.ok === true && typeof lastData.url === 'string') {
        return lastData.url;
      }
      if (response.status === 429 || response.status === 503 || response.status === 404) break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
    }

    throw new Error(describeError(lastData, lastStatus));
  }

  async function playKugou(hash: string, resumeAt = 0) {
    if (!audio) return;
    if (state) state.textContent = '· 正在解析音源…';
    const url = await fetchPlayUrl(hash);
    if (state) state.textContent = '· 正在加载音源…';
    pendingResume = resumeAt > 0 ? resumeAt : 0;
    audio.src = url;
    audio.load();
    try {
      await audio.play();
    } catch {
      if (state) state.textContent = '· 已就绪，点播放继续';
    }
  }

  async function handlePlay(button: HTMLButtonElement) {
    if (!audio) return;
    const track = readCommand(button);
    currentTrack = track;
    retried = false;
    showPlayer();
    setTrackMeta(track);
    if (state) state.textContent = '· 正在加载…';

    if (track.audio) {
      pendingResume = 0;
      audio.src = new URL(track.audio, window.location.href).href;
      audio.load();
      try {
        await audio.play();
      } catch {
        if (state) state.textContent = '· 已就绪，点播放继续';
      }
      return;
    }

    if (!track.hash) {
      if (state) state.textContent = '· 这首没有可播放的音源';
      return;
    }

    try {
      await playKugou(track.hash);
    } catch (error) {
      if (state) state.textContent = error instanceof Error ? error.message : '· 解析失败，可去酷狗收听';
      if (toggle) toggle.disabled = true;
    }
  }

  // 曲目按钮由服务端渲染或列表动态插入，统一用事件委托绑定播放。
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-play]') : null;
    if (!target || target.disabled) return;
    void handlePlay(target);
  });

  toggle?.addEventListener('click', () => {
    if (!audio || !audio.src) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  });

  closeButton?.addEventListener('click', () => {
    if (audio) audio.pause();
    hidePlayer();
  });

  audio?.addEventListener('play', () => setPlaying(true));
  audio?.addEventListener('pause', () => setPlaying(false));
  audio?.addEventListener('ended', () => setPlaying(false));
  audio?.addEventListener('loadedmetadata', () => {
    if (!audio) return;
    updateDuration();
    if (pendingResume > 0 && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.min(pendingResume, Math.max(0, audio.duration - 0.5));
    }
    pendingResume = 0;
  });
  audio?.addEventListener('durationchange', updateDuration);
  audio?.addEventListener('timeupdate', () => {
    if (!audio) return;
    if (current) current.textContent = formatTime(audio.currentTime);
    if (seek && Number.isFinite(audio.duration) && audio.duration > 0) {
      seek.value = String(audio.currentTime);
    }
  });

  // 酷狗直链有 TTL：过期/断流时重新取一次地址，并尽量从原位置续播。
  audio?.addEventListener('error', () => {
    if (!audio) return;
    if (currentTrack?.hash && !retried) {
      retried = true;
      const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      if (state) state.textContent = '· 音源过期，正在重试…';
      void playKugou(currentTrack.hash, resumeAt).catch((error) => {
        if (state) state.textContent = error instanceof Error ? error.message : '· 加载失败，可去酷狗收听';
        if (toggle) toggle.disabled = true;
      });
      return;
    }
    if (state) state.textContent = '· 加载失败，可去酷狗收听';
    if (toggle) toggle.disabled = true;
  });

  seek?.addEventListener('input', () => {
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Number(seek.value);
    // 知识库的播放管线约定：暂停中拖动进度条，语义是“继续听”。
    if (audio.paused) void audio.play().catch(() => {});
  });

  // 客户端路由换页后 body 是新的，播放器节点被 persist 保留下来，补回底部留白。
  document.addEventListener('astro:after-swap', () => {
    const persisted = document.querySelector<HTMLElement>('[data-player]');
    if (persisted && !persisted.hidden) document.body.classList.add('has-player');
  });
}
