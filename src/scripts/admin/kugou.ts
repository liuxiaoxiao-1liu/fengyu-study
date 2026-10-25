// 后台「酷狗」面板：登录状态、扫码登录轮询、歌单切换与曲目增删。
import { $, request } from './dom';

const kugouStatus = $('kugou-status');
const kugouPlaylists = $('kugou-playlists');
const kugouTracks = $('kugou-tracks');
const kugouPlaylistName = $('kugou-playlist-name');
const kugouTrackCount = $('kugou-track-count');
const kugouTrackStatus = $('kugou-track-status');
const kugouQrPanel = $('kugou-qr-panel');
const kugouQrImage = $<HTMLImageElement>('kugou-qr-image');
const kugouQrMessage = $('kugou-qr-message');
const kugouQrLink = $<HTMLAnchorElement>('kugou-qr-link');
const kugouQrStart = $<HTMLButtonElement>('kugou-qr-start');
const kugouAddForm = $<HTMLFormElement>('kugou-add-form');

let kugouQrTimer: number | null = null;
let kugouQrKey = '';

export function stopKugouQr() {
  if (kugouQrTimer !== null) {
    window.clearTimeout(kugouQrTimer);
    kugouQrTimer = null;
  }
  kugouQrKey = '';
}

function renderKugou(data: any) {
  const status = data.status ?? {};
  if (kugouStatus) {
    kugouStatus.textContent = status.configured
      ? `已登录 ${status.userid} · ${status.source === 'file' ? '后台扫码会话' : '服务器 .env'} · 站内歌单 ${status.playlistName}`
      : '未登录：生成二维码扫码，或继续使用服务器 .env 里的酷狗会话。';
  }
  if (kugouPlaylistName) kugouPlaylistName.textContent = data.playlist?.name ? `· ${data.playlist.name}` : '';
  if (kugouTrackCount) kugouTrackCount.textContent = data.playlist ? `${data.playlist.total} 首` : '';

  if (kugouPlaylists) {
    kugouPlaylists.replaceChildren();
    if (!status.configured) {
      const note = document.createElement('p');
      note.className = 'font-body-sm text-body-sm text-on-surface-variant';
      note.textContent = '登录后这里会列出账号里的全部歌单。';
      kugouPlaylists.append(note);
    } else if (!data.playlists?.length) {
      const note = document.createElement('p');
      note.className = 'font-body-sm text-body-sm text-on-surface-variant';
      note.textContent = data.error || '没有读到歌单。';
      kugouPlaylists.append(note);
    } else {
      for (const playlist of data.playlists) {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-2 rounded-lg bg-surface-container px-3 py-2';
        const meta = document.createElement('div');
        meta.className = 'min-w-0';
        const name = document.createElement('strong');
        name.className = 'block truncate text-sm text-primary';
        name.textContent = playlist.name;
        const count = document.createElement('span');
        count.className = 'block font-label-sm text-[0.625rem] text-on-surface-variant';
        count.textContent = `${playlist.count} 首 · ${playlist.globalCollectionId}`;
        meta.append(name, count);
        const actions = document.createElement('div');
        actions.className = 'flex shrink-0 items-center gap-2';
        if (playlist.name === data.playlist?.name || playlist.name === status.playlistName) {
          const active = document.createElement('span');
          active.className = 'font-label-sm text-[0.625rem] text-secondary';
          active.textContent = '站内使用中';
          actions.append(active);
        } else {
          const use = document.createElement('button');
          use.type = 'button';
          use.className = 'text-xs text-secondary hover:text-primary';
          use.textContent = '设为站内歌单';
          use.addEventListener('click', async () => {
            use.disabled = true;
            try {
              await request('/api/admin/kugou/settings', {
                method: 'POST',
                body: JSON.stringify({ playlistName: playlist.name }),
              });
              await loadKugou();
            } catch (error) {
              if (kugouTrackStatus) kugouTrackStatus.textContent = error instanceof Error ? error.message : '切换失败';
            } finally {
              use.disabled = false;
            }
          });
          actions.append(use);
        }
        row.append(meta, actions);
        kugouPlaylists.append(row);
      }
    }
  }

  if (kugouTracks) {
    kugouTracks.replaceChildren();
    const tracks = data.playlist?.tracks ?? [];
    if (!tracks.length) {
      const note = document.createElement('p');
      note.className = 'py-4 text-center font-body-sm text-body-sm text-on-surface-variant';
      note.textContent = status.configured ? '当前歌单没有曲目。' : '登录后显示当前歌单曲目。';
      kugouTracks.append(note);
    } else {
      for (const track of tracks) {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container';
        const meta = document.createElement('div');
        meta.className = 'min-w-0';
        const title = document.createElement('span');
        title.className = 'block truncate text-sm text-primary';
        title.textContent = `${track.title} · ${track.artist}`;
        const detail = document.createElement('span');
        detail.className = 'block truncate font-label-sm text-[0.625rem] text-on-surface-variant';
        detail.textContent = `${track.duration} · ${track.hash}${track.fileid ? ` · fileid ${track.fileid}` : ''}`;
        meta.append(title, detail);
        const actions = document.createElement('div');
        actions.className = 'flex shrink-0 items-center gap-2';
        if (track.kugou?.hash || track.hash) {
          const open = document.createElement('a');
          open.className = 'text-xs text-secondary hover:text-primary';
          open.href = `https://www.kugou.com/song/#hash=${encodeURIComponent(track.hash)}`;
          open.target = '_blank';
          open.rel = 'noopener noreferrer';
          open.textContent = '打开';
          actions.append(open);
        }
        if (track.fileid) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'text-xs text-error hover:underline';
          remove.textContent = '删除';
          remove.addEventListener('click', async () => {
            if (!window.confirm(`从酷狗歌单删除《${track.title}》？`)) return;
            remove.disabled = true;
            try {
              await request('/api/admin/kugou/tracks', {
                method: 'DELETE',
                body: JSON.stringify({ fileid: track.fileid }),
              });
              await loadKugou();
            } catch (error) {
              if (kugouTrackStatus) kugouTrackStatus.textContent = error instanceof Error ? error.message : '删除失败';
            } finally {
              remove.disabled = false;
            }
          });
          actions.append(remove);
        }
        row.append(meta, actions);
        kugouTracks.append(row);
      }
    }
  }
}

export async function loadKugou() {
  if (kugouStatus) kugouStatus.textContent = '读取酷狗账号…';
  try {
    const data = await request('/api/admin/kugou/status');
    renderKugou(data);
    if (data.error && kugouTrackStatus) kugouTrackStatus.textContent = data.error;
    if (!kugouQrKey) {
      kugouQrPanel?.setAttribute('style', 'display: none');
    }
  } catch (error) {
    if (kugouStatus) kugouStatus.textContent = error instanceof Error ? error.message : '读取失败';
  }
}

async function startKugouQr() {
  stopKugouQr();
  if (kugouQrStart) kugouQrStart.disabled = true;
  try {
    const data = await request('/api/admin/kugou/qr', { method: 'POST' });
    kugouQrKey = data.qr.key;
    if (kugouQrImage) kugouQrImage.src = data.qr.image;
    if (kugouQrLink) kugouQrLink.href = data.qr.url;
    if (kugouQrMessage) kugouQrMessage.textContent = '等待扫码…';
    if (kugouQrPanel) kugouQrPanel.setAttribute('style', 'display: flex');
    pollKugouQr(kugouQrKey);
  } catch (error) {
    if (kugouQrMessage) kugouQrMessage.textContent = error instanceof Error ? error.message : '二维码生成失败';
    if (kugouQrPanel) kugouQrPanel.setAttribute('style', 'display: flex');
  } finally {
    if (kugouQrStart) kugouQrStart.disabled = false;
  }
}

async function pollKugouQr(key: string) {
  if (!kugouQrKey) return;
  try {
    const data = await request(`/api/admin/kugou/qr?key=${encodeURIComponent(key)}`);
    if (kugouQrMessage) kugouQrMessage.textContent = data.message ?? '';
    if (data.status === 'success') {
      stopKugouQr();
      if (kugouQrMessage) kugouQrMessage.textContent = '登录成功，正在刷新歌单…';
      await loadKugou();
      return;
    }
    if (data.status === 'expired') {
      stopKugouQr();
      return;
    }
  } catch (error) {
    if (kugouQrMessage) kugouQrMessage.textContent = error instanceof Error ? error.message : '轮询失败';
  }
  kugouQrTimer = window.setTimeout(() => void pollKugouQr(key), 2500);
}

export function initKugou() {
  $('kugou-refresh')?.addEventListener('click', () => void loadKugou());
  $('kugou-qr-start')?.addEventListener('click', () => void startKugouQr());
  $('kugou-logout')?.addEventListener('click', async () => {
    if (!window.confirm('退出后站内会停止读取该酷狗账号，确定吗？')) return;
    try {
      await request('/api/admin/kugou/logout', { method: 'POST' });
      await loadKugou();
    } catch (error) {
      if (kugouStatus) kugouStatus.textContent = error instanceof Error ? error.message : '退出失败';
    }
  });

  kugouAddForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const hash = $<HTMLInputElement>('kugou-add-hash')?.value.trim() ?? '';
    const name = $<HTMLInputElement>('kugou-add-name')?.value.trim() ?? '';
    const albumId = $<HTMLInputElement>('kugou-add-album')?.value.trim() ?? '0';
    const albumAudioId = Number($<HTMLInputElement>('kugou-add-audio')?.value ?? 0);
    if (kugouTrackStatus) kugouTrackStatus.textContent = '添加中…';
    try {
      await request('/api/admin/kugou/tracks', {
        method: 'POST',
        body: JSON.stringify({ hash, name, albumId, albumAudioId }),
      });
      if (kugouTrackStatus) kugouTrackStatus.textContent = '已添加，正在刷新…';
      if (kugouAddForm) kugouAddForm.reset();
      await loadKugou();
      if (kugouTrackStatus) kugouTrackStatus.textContent = '已添加';
    } catch (error) {
      if (kugouTrackStatus) kugouTrackStatus.textContent = error instanceof Error ? error.message : '添加失败';
    }
  });
}
