import { createRequire } from 'node:module';
import { join } from 'node:path';

// 从 Folia 内置的 KuGouMusicApi 里抽出的最小运行时（MIT，见 vendor/kugou/LICENSE）。
// 只做两件事：/register/dev 换 dfid，/song/url 用账号 token 换音频直链。
const require = createRequire(import.meta.url);
const vendorPath = process.env.KUGOU_VENDOR ?? join(process.cwd(), 'vendor/kugou/index.js');
const { registerDev, songUrl, userPlaylist, playlistTracks } = require(vendorPath) as {
  registerDev: (params: Record<string, unknown>) => Promise<KugouResponse>;
  songUrl: (params: Record<string, unknown>) => Promise<KugouResponse>;
  userPlaylist: (params: Record<string, unknown>) => Promise<PlaylistResponse>;
  playlistTracks: (params: Record<string, unknown>) => Promise<PlaylistResponse>;
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

type KugouConfig = {
  token: string;
  userid: string;
  vipToken: string;
  vipType: string;
  mid: string;
  guid: string;
  dfid: string;
};

const URL_TTL_MS = 4 * 60 * 1000;
const DFID_TTL_MS = 30 * 60 * 1000;

let dfidCache: { value: string; at: number } | null = null;
const urlCache = new Map<string, { url: string; at: number }>();

function readConfig(): KugouConfig | null {
  const token = process.env.KUGOU_TOKEN ?? '';
  const userid = process.env.KUGOU_USERID ?? '';
  if (!token || !userid) return null;
  return {
    token,
    userid,
    vipToken: process.env.KUGOU_VIP_TOKEN ?? '',
    vipType: process.env.KUGOU_VIP_TYPE ?? '0',
    mid: process.env.KUGOU_MID ?? '',
    guid: process.env.KUGOU_GUID ?? '',
    dfid: process.env.KUGOU_DFID ?? '',
  };
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

/** 账号里用于站内展示的唯一歌单；可用 KUGOU_PLAYLIST_NAME 覆盖（测试/改名时）。 */
const PLAYLIST_SLUG = 'maotouying';
const PLAYLIST_NAME = process.env.KUGOU_PLAYLIST_NAME || 'maotouying';
const PLAYLIST_CACHE_MS = 60 * 1000;
const PLAYLIST_PAGE_SIZE = 100;

export type AccountPlaylistTrack = KugouTrackRef & {
  title: string;
  artist: string;
  duration: string;
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

  const wanted = PLAYLIST_NAME.trim().toLowerCase();
  const info = (meta.body.data?.info ?? []).find(
    (item) =>
      String(item.name ?? '')
        .trim()
        .toLowerCase() === wanted,
  );
  if (!info) throw new Error(`playlist_not_found:${PLAYLIST_NAME}`);

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
    name: String(info.name ?? PLAYLIST_NAME),
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
  if (!force && playlistCache && Date.now() - playlistCache.fetchedAt < PLAYLIST_CACHE_MS) {
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
  let playlist = await getAccountPlaylist();
  let track = playlist.tracks.find((item) => item.hash === normalized) ?? null;

  if (!track && Date.now() - playlist.fetchedAt > 10_000) {
    playlist = await getAccountPlaylist(true);
    track = playlist.tracks.find((item) => item.hash === normalized) ?? null;
  }

  return track;
}
