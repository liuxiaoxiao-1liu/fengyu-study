#!/usr/bin/env node
/**
 * 把酷狗账号里的全部歌单同步成 src/data/kugou-playlists.ts。
 * 用法：node --env-file=.env scripts/sync-kugou-playlists.mjs
 * 需要 KUGOU_TOKEN / KUGOU_USERID / KUGOU_VIP_TOKEN / KUGOU_VIP_TYPE / KUGOU_MID / KUGOU_DFID。
 * 只读账号数据，不改酷狗侧任何东西；生成的 TS 不含 token。
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { userPlaylist, playlistTracks } = require('../vendor/kugou/index.js');

const token = process.env.KUGOU_TOKEN ?? '';
const userid = process.env.KUGOU_USERID ?? '';
if (!token || !userid) {
  console.error('缺少 KUGOU_TOKEN / KUGOU_USERID，先配置 .env');
  process.exit(1);
}

const cookie = {
  userid,
  token,
  vip_token: process.env.KUGOU_VIP_TOKEN ?? '',
  vip_type: process.env.KUGOU_VIP_TYPE ?? '0',
  KUGOU_API_MID: process.env.KUGOU_MID ?? '',
  dfid: process.env.KUGOU_DFID ?? '',
};

const PAGE_SIZE = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const formatDuration = (ms) => {
  const total = Math.floor((Number(ms) || 0) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function splitName(name, song) {
  const text = String(name || song?.filename || song?.remark || '').trim();
  const index = text.indexOf(' - ');
  if (index > 0) return { artist: text.slice(0, index).trim(), title: text.slice(index + 3).trim() };
  const artist = song?.singerinfo?.[0]?.name || song?.singername || '未知歌手';
  return { artist: String(artist).trim(), title: text || '未命名曲目' };
}

function normalizeSong(song) {
  const { artist, title } = splitName(song.name, song);
  return {
    hash: String(song.hash || '').toLowerCase(),
    albumId: String(song.album_id || '0'),
    albumAudioId: Number(song.add_mixsongid || song.mixsongid || 0),
    title,
    artist,
    duration: formatDuration(song.timelen),
  };
}

const meta = await userPlaylist({ cookie, userid, token, page: 1, pagesize: 100 });
if (meta?.body?.status !== 1) {
  console.error('获取歌单列表失败', JSON.stringify(meta?.body)?.slice(0, 300));
  process.exit(1);
}
const rawPlaylists = meta.body.data?.info ?? [];
console.log(`歌单数：${rawPlaylists.length}`);

const playlists = [];
for (let index = 0; index < rawPlaylists.length; index += 1) {
  const item = rawPlaylists[index];
  const slug = `p${index + 1}`;
  const total = Number(item.count || 0);
  const tracks = [];
  const seen = new Set();
  for (let page = 1; page <= Math.ceil(total / PAGE_SIZE) || page === 1; page += 1) {
    const res = await playlistTracks({
      id: item.global_collection_id,
      cookie,
      userid,
      token,
      page,
      pagesize: PAGE_SIZE,
    });
    if (res?.body?.status !== 1) {
      console.warn(`  ! ${item.name} 第 ${page} 页失败：${res?.body?.error_code ?? 'unknown'}`);
      break;
    }
    const songs = res.body.data?.songs ?? [];
    for (const song of songs) {
      if (song?.hash) {
        const track = normalizeSong(song);
        if (track.hash && !seen.has(track.hash)) {
          seen.add(track.hash);
          tracks.push(track);
        }
      }
    }
    if (songs.length < PAGE_SIZE) break;
    await sleep(120);
  }
  playlists.push({ slug, name: String(item.name || `歌单 ${index + 1}`), count: total, tracks });
  console.log(`${index + 1}/${rawPlaylists.length} ${item.name}：${tracks.length}/${total}`);
  await sleep(120);
}

const lines = [];
lines.push('// 由 scripts/sync-kugou-playlists.mjs 生成，勿手改。');
lines.push('// 数据来自账号自己的酷狗歌单，只含公开元数据，不含 token。');
lines.push('');
lines.push('export type KugouPlaylistTrack = {');
lines.push('  hash: string;');
lines.push('  albumId: string;');
lines.push('  albumAudioId: number;');
lines.push('  title: string;');
lines.push('  artist: string;');
lines.push('  duration: string;');
lines.push('};');
lines.push('');
lines.push('export type KugouPlaylist = {');
lines.push('  slug: string;');
lines.push('  name: string;');
lines.push('  count: number;');
lines.push('  tracks: KugouPlaylistTrack[];');
lines.push('};');
lines.push('');
lines.push('export const kugouPlaylists: KugouPlaylist[] = [');
for (const playlist of playlists) {
  lines.push('  {');
  lines.push(`    slug: ${JSON.stringify(playlist.slug)},`);
  lines.push(`    name: ${JSON.stringify(playlist.name)},`);
  lines.push(`    count: ${playlist.count},`);
  lines.push('    tracks: [');
  for (const track of playlist.tracks) {
    lines.push(`      ${JSON.stringify(track)},`);
  }
  lines.push('    ],');
  lines.push('  },');
}
lines.push('];');
lines.push('');
lines.push('const trackMap = new Map<string, { track: KugouPlaylistTrack; playlist: KugouPlaylist }>();');
lines.push('for (const playlist of kugouPlaylists) {');
lines.push('  for (const track of playlist.tracks) {');
lines.push('    if (!trackMap.has(track.hash)) trackMap.set(track.hash, { track, playlist });');
lines.push('  }');
lines.push('}');
lines.push('export const kugouTrackByHash = trackMap;');
lines.push('');

writeFileSync('src/data/kugou-playlists.ts', lines.join('\n'));
console.log(
  `写入 src/data/kugou-playlists.ts：${playlists.length} 个歌单，${playlists.reduce((n, p) => n + p.tracks.length, 0)} 首`,
);
