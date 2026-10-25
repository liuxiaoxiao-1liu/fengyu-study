import { createRequire } from 'node:module';
import { join } from 'node:path';
import { findCuratedTrack } from './content-db';
import { readKugouConfig, readKugouSettings, type KugouConfig } from './kugou-session';

// 从 Folia 内置的 KuGouMusicApi 里抽出的最小运行时（MIT，见 vendor/kugou/LICENSE）。
// 只做两件事：/register/dev 换 dfid，/song/url 用账号 token 换音频直链。
const require = createRequire(import.meta.url);
const vendorPath = process.env.KUGOU_VENDOR ?? join(process.cwd(), 'vendor/kugou/index.js');
const { registerDev, songUrl, userPlaylist, playlistTracks, playlistTracksAdd, playlistTracksDel } = require(
  vendorPath,
) as {
  registerDev: (params: Record<string, unknown>) => Promise<KugouResponse>;
  songUrl: (params: Record<string, unknown>) => Promise<KugouResponse>;
  userPlaylist: (params: Record<string, unknown>) => Promise<PlaylistResponse>;
  playlistTracks: (params: Record<string, unknown>) => Promise<PlaylistResponse>;
  playlistTracksAdd: (params: Record<string, unknown>) => Promise<PlaylistResponse>;
  playlistTracksDel: (params: Record<string, unknown>) => Promise<PlaylistResponse>;
};

type RawPlaylistInfo = {
  name?: string;
  count?: number;
  global_collection_id?: string;
  listid?: number;
};

type RawPlaylistSong = {
  hash?: string;
  name?: string;
  filename?: string;
  remark?: string;
  album_id?: number | string;
  add_mixsongid?: number | string;
  mixsongid?: number | string;
  fileid?: number | string;
  timelen?: number;
  singerinfo?: Array<{ name?: string }>;
  singername?: string;
};

type PlaylistResponse = {
  status?: number;
  body?: {
    status?: number;
    error_code?: number;
    data?: { info?: RawPlaylistInfo[]; songs?: RawPlaylistSong[] };
  };
};

type KugouResponse = {
  status?: number;
  body?: {
    status?: number;
    error_code?: number;
    url?: string | string[];
    backupUrl?: string[];
    data?: { dfid?: string };
  };
};

const URL_TTL_MS = 4 * 60 * 1000;
const DFID_TTL_MS = 30 * 60 * 1000;

let dfidCache: { value: string; at: number } | null = null;
const urlCache = new Map<string, { url: string; at: number }>();

function readConfig() {
  return readKugouConfig();
}

export function isKugouEnabled(): boolean {
  return readConfig() !== null;
}

function baseCookie(config: KugouConfig, dfid: string): Record<string, string> {
  const guid = config.guid || config.mid;
  return {
    userid: config.userid,
    token: config.token,
    vip_token: config.vipToken,
    vip_type: config.vipType,
    KUGOU_API_MID: config.mid,
    dfid,
    KUGOU_API_GUID: guid,
    KUGOU_API_WEBGL: '',
    KUGOU_API_MAC: '02:00:00:00:00:00',
    KUGOU_API_DEV: guid.slice(0, 10).toUpperCase() || 'KUGOUDEV01',
  };
}

/** 酷狗要求先 /register/dev 拿一个和账号绑定的 dfid，否则 /song/url 返回 20018。 */
async function ensureDfid(config: KugouConfig): Promise<string> {
  if (dfidCache && Date.now() - dfidCache.at < DFID_TTL_MS) return dfidCache.value;

  try {
    const response = await registerDev({
      cookie: baseCookie(config, ''),
      userid: config.userid,
      token: config.token,
    });
    if (response?.body?.status !== 1) {
      throw new Error(`register_dev_failed:${response?.body?.error_code ?? 'unknown'}`);
    }
    const dfid = response.body?.data?.dfid ?? '';
    if (!dfid) throw new Error('register_dev_failed:missing_dfid');
    dfidCache = { value: dfid, at: Date.now() };
    return dfid;
  } catch (error) {
    // 注册失败时退回 .env 里的旧 dfid，至少让已知可用的会话继续跑
    if (config.dfid) {
      dfidCache = { value: config.dfid, at: Date.now() };
      return config.dfid;
    }
    throw error;
  }
}

export type KugouTrackRef = {
  hash: string;
  albumId: string;
  albumAudioId: number;
};

/** 换一条可直接塞进 <audio src> 的酷狗 CDN 直链；失败抛错，由 API 转成 502。 */
export async function resolveKugouUrl(track: KugouTrackRef): Promise<string> {
  const config = readConfig();
  if (!config) throw new Error('kugou_disabled');

  const key = `${track.hash}:${track.albumAudioId}`;
  const hit = urlCache.get(key);
  if (hit && Date.now() - hit.at < URL_TTL_MS) return hit.url;

  const dfid = await ensureDfid(config);
  const cookie = baseCookie(config, dfid);
  const pickUrl = (body: KugouResponse['body']): string => {
    if (!body) return '';
    return Array.isArray(body.url) ? (body.url[0] ?? '') : (body.url ?? body.backupUrl?.[0] ?? '');
  };

  // 优先带 album_audio_id；部分曲目（尤其免费/翻唱）带它反而返回版权拦截，退回 0 再试。
  let response = await songUrl({
    hash: track.hash,
    album_id: track.albumId,
    album_audio_id: track.albumAudioId,
    quality: 128,
    cookie,
  });
  let url = pickUrl(response?.body);

  if (!url) {
    response = await songUrl({
      hash: track.hash,
      album_id: track.albumId,
      album_audio_id: 0,
      quality: 128,
      cookie,
    });
    url = pickUrl(response?.body);
  }

  if (!url) {
    const body = response?.body ?? {};
    throw new Error(`song_url_failed:${body.error_code ?? 'unknown'}`);
  }

  urlCache.set(key, { url, at: Date.now() });
  // 简单清理，避免 Map 无限增长
  if (urlCache.size > 200) {
    for (const [cacheKey, value] of urlCache) {
      if (Date.now() - value.at >= URL_TTL_MS) urlCache.delete(cacheKey);
    }
  }
  return url;
}

/** 账号里用于站内展示的唯一歌单；后台设置优先，其次 KUGOU_PLAYLIST_NAME。 */
const PLAYLIST_SLUG = 'maotouying';

function playlistName(): string {
  return (readKugouSettings().playlistName || process.env.KUGOU_PLAYLIST_NAME || 'maotouying').trim();
}
const PLAYLIST_CACHE_MS = 60 * 1000;
const PLAYLIST_PAGE_SIZE = 100;

export type AccountPlaylistTrack = KugouTrackRef & {
  title: string;
  artist: string;
  duration: string;
  fileid: number;
};

export type AccountPlaylist = {
  slug: string;
  name: string;
  total: number;
  tracks: AccountPlaylistTrack[];
  fetchedAt: number;
};

let playlistCache: AccountPlaylist | null = null;
let playlistInflight: Promise<AccountPlaylist> | null = null;

function formatDuration(ms: unknown): string {
  const total = Math.floor((Number(ms) || 0) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function splitSongName(rawName: unknown, song: RawPlaylistSong): { artist: string; title: string } {
  const text = String(rawName || song.filename || song.remark || '').trim();
  const index = text.indexOf(' - ');
  if (index > 0) {
    return { artist: text.slice(0, index).trim(), title: text.slice(index + 3).trim() };
  }
  const artist = song.singerinfo?.[0]?.name || song.singername || '未知歌手';
  return { artist: String(artist).trim(), title: text || '未命名曲目' };
}

function normalizeSong(song: RawPlaylistSong): AccountPlaylistTrack {
  const { artist, title } = splitSongName(song.name, song);
  return {
    hash: String(song.hash || '').toLowerCase(),
    albumId: String(song.album_id ?? '0'),
    albumAudioId: Number(song.add_mixsongid ?? song.mixsongid ?? 0),
    title,
    artist,
    duration: formatDuration(song.timelen),
    fileid: Number(song.fileid ?? 0),
  };
}

async function fetchAccountPlaylist(): Promise<AccountPlaylist> {
  const config = readConfig();
  if (!config) throw new Error('kugou_disabled');

  // 歌单接口和 /song/url 一样依赖账号 cookie；dfid 缺失时先注册一个。
  const dfid = config.dfid || (await ensureDfid(config));
  const cookie = baseCookie(config, dfid);
  const meta = await userPlaylist({
    cookie,
    userid: config.userid,
    token: config.token,
    page: 1,
    pagesize: 100,
  });

  if (meta?.body?.status !== 1) {
    throw new Error(`playlist_list_failed:${meta?.body?.error_code ?? 'unknown'}`);
  }

  const wanted = playlistName().toLowerCase();
  const info = (meta.body.data?.info ?? []).find(
    (item) =>
      String(item.name ?? '')
        .trim()
        .toLowerCase() === wanted,
  );
  if (!info) throw new Error(`playlist_not_found:${playlistName()}`);

  const total = Number(info.count) || 0;
  const tracks: AccountPlaylistTrack[] = [];
  const seen = new Set<string>();
  const totalPages = Math.max(1, Math.ceil(total / PLAYLIST_PAGE_SIZE));

  for (let page = 1; page <= totalPages; page += 1) {
    const response = await playlistTracks({
      id: info.global_collection_id,
      cookie,
      userid: config.userid,
      token: config.token,
      page,
      pagesize: PLAYLIST_PAGE_SIZE,
    });
    if (response?.body?.status !== 1) {
      if (page === 1) throw new Error(`playlist_tracks_failed:${response?.body?.error_code ?? 'unknown'}`);
      break;
    }
    const songs = response.body.data?.songs ?? [];
    for (const song of songs) {
      if (!song?.hash) continue;
      const track = normalizeSong(song);
      if (!track.hash || seen.has(track.hash)) continue;
      seen.add(track.hash);
      tracks.push(track);
    }
    if (songs.length < PLAYLIST_PAGE_SIZE) break;
    if (page < totalPages) await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return {
    slug: PLAYLIST_SLUG,
    name: String(info.name ?? playlistName()),
    total: tracks.length,
    tracks,
    fetchedAt: Date.now(),
  };
}

/**
 * 读取账号歌单（默认 maotouying）。缓存 60 秒，让酷狗上的增删在约 1 分钟内反映到站内。
 * 拉到一半失败时优先返回上一次成功结果，避免整页变空。
 */
export async function getAccountPlaylist(force = false): Promise<AccountPlaylist> {
  if (
    !force &&
    playlistCache &&
    playlistCache.name.toLowerCase() === playlistName().toLowerCase() &&
    Date.now() - playlistCache.fetchedAt < PLAYLIST_CACHE_MS
  ) {
    return playlistCache;
  }
  if (playlistInflight) return playlistInflight;

  playlistInflight = (async () => {
    try {
      const next = await fetchAccountPlaylist();
      playlistCache = next;
      return next;
    } catch (error) {
      if (playlistCache) return playlistCache;
      throw error;
    } finally {
      playlistInflight = null;
    }
  })();

  return playlistInflight;
}

/** 按 hash 在当前歌单里找曲目；找不到就强制刷新一次（有最小刷新间隔，避免被刷接口）。 */
export async function findAccountTrack(hash: string): Promise<AccountPlaylistTrack | null> {
  const normalized = hash.toLowerCase();
  const curated = findCuratedTrack(normalized);
  if (curated?.kugou) {
    return {
      hash: curated.kugou.hash.toLowerCase(),
      albumId: curated.kugou.albumId,
      albumAudioId: curated.kugou.albumAudioId,
      title: curated.title,
      artist: curated.artist,
      duration: curated.duration,
      fileid: 0,
    };
  }

  let playlist = await getAccountPlaylist();
  let track = playlist.tracks.find((item) => item.hash === normalized) ?? null;

  if (!track && Date.now() - playlist.fetchedAt > 10_000) {
    playlist = await getAccountPlaylist(true);
    track = playlist.tracks.find((item) => item.hash === normalized) ?? null;
  }

  return track;
}

export type KugouPlaylistInfo = {
  name: string;
  count: number;
  listid: number;
  globalCollectionId: string;
};

/** 后台用：列出账号里的全部歌单（不改变站内当前歌单）。 */
export async function listKugouPlaylists(): Promise<KugouPlaylistInfo[]> {
  const config = readConfig();
  if (!config) throw new Error('kugou_disabled');
  const dfid = config.dfid || (await ensureDfid(config));
  const response = await userPlaylist({
    cookie: baseCookie(config, dfid),
    userid: config.userid,
    token: config.token,
    page: 1,
    pagesize: 100,
  });
  if (response?.body?.status !== 1) {
    throw new Error(`playlist_list_failed:${response?.body?.error_code ?? 'unknown'}`);
  }
  return (response.body.data?.info ?? []).map((item) => ({
    name: String(item.name ?? ''),
    count: Number(item.count ?? 0),
    listid: Number(item.listid ?? 0),
    globalCollectionId: String(item.global_collection_id ?? ''),
  }));
}

/** 清除播放/歌单缓存；后台登录、切歌单或增删歌曲后调用。 */
export function resetKugouRuntime(): void {
  dfidCache = null;
  urlCache.clear();
  playlistCache = null;
  playlistInflight = null;
}

async function activePlaylistInfo(): Promise<{ name: string; listid: number; count: number }> {
  const config = readConfig();
  if (!config) throw new Error('kugou_disabled');
  const dfid = config.dfid || (await ensureDfid(config));
  const meta = await userPlaylist({
    cookie: baseCookie(config, dfid),
    userid: config.userid,
    token: config.token,
    page: 1,
    pagesize: 100,
  });
  if (meta?.body?.status !== 1) throw new Error(`playlist_list_failed:${meta?.body?.error_code ?? 'unknown'}`);
  const wanted = playlistName().toLowerCase();
  const info = (meta.body.data?.info ?? []).find(
    (item) =>
      String(item.name ?? '')
        .trim()
        .toLowerCase() === wanted,
  );
  if (!info) throw new Error(`playlist_not_found:${playlistName()}`);
  return {
    name: String(info.name ?? playlistName()),
    listid: Number(info.listid ?? 0),
    count: Number(info.count ?? 0),
  };
}

export type AddKugouTrackInput = {
  hash: string;
  name?: string;
  albumId?: string;
  albumAudioId?: number;
};

/** 后台：往当前站内歌单添加一首歌。 */
export async function addKugouTrack(input: AddKugouTrackInput): Promise<void> {
  const config = readConfig();
  if (!config) throw new Error('kugou_disabled');
  const hash = input.hash.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(hash)) throw new Error('invalid_hash');
  const info = await activePlaylistInfo();
  const dfid = config.dfid || (await ensureDfid(config));
  const data = `${input.name?.trim() || hash}|${hash}|${input.albumId || '0'}|${input.albumAudioId || 0}`;
  const response = await playlistTracksAdd({
    listid: info.listid,
    data,
    cookie: baseCookie(config, dfid),
    userid: config.userid,
    token: config.token,
  });
  if (response?.body?.status !== 1) {
    throw new Error(`playlist_add_failed:${response?.body?.error_code ?? 'unknown'}`);
  }
  resetKugouRuntime();
}

/** 后台：从当前站内歌单移除一首歌（fileid 来自歌单列表）。 */
export async function removeKugouTrack(fileid: number): Promise<void> {
  const config = readConfig();
  if (!config) throw new Error('kugou_disabled');
  if (!Number.isFinite(fileid) || fileid <= 0) throw new Error('invalid_fileid');
  const info = await activePlaylistInfo();
  const dfid = config.dfid || (await ensureDfid(config));
  const response = await playlistTracksDel({
    listid: info.listid,
    fileids: String(fileid),
    cookie: baseCookie(config, dfid),
    userid: config.userid,
    token: config.token,
  });
  if (response?.body?.status !== 1) {
    throw new Error(`playlist_del_failed:${response?.body?.error_code ?? 'unknown'}`);
  }
  resetKugouRuntime();
}
