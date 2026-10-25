import type { APIRoute } from 'astro';
import { SERIES_LABELS } from '../../../data/photos';
import {
  listAlbums,
  listBooks,
  listEssays,
  listLinks,
  listPhotos,
  listQuotes,
  listTracks,
} from '../../../lib/content-db';
import { json } from '../../../lib/http';

export const prerender = false;

type SearchEntry = {
  title: string;
  href: string;
  kind: string;
  summary: string;
};

export const GET: APIRoute = async () => {
  const entries: SearchEntry[] = [
    { title: '首页', href: '/', kind: '页面', summary: '欢迎光临我的数字秘密基地。' },
    { title: '读听', href: '/reading/', kind: '页面', summary: '追更书架、年度网文与酷狗音乐档案。' },
    { title: '影集', href: '/photos/', kind: '页面', summary: '动漫、摄影与虚拟 CG 的视觉灵感档案。' },
    { title: '随记', href: '/essays/', kind: '页面', summary: '慢慢写下的随笔、书评与歌单笔记。' },
    { title: '留言 & 时光信箱', href: '/guestbook/', kind: '页面', summary: '投递一枚字句，等它在夜里被拆封。' },
  ];

  for (const essay of listEssays()) {
    entries.push({
      title: essay.title,
      href: `/essays/${essay.slug}/`,
      kind: '随记',
      summary: essay.summary,
    });
  }
  for (const book of listBooks()) {
    entries.push({
      title: book.title,
      href: '/reading/#shelf',
      kind: '网文',
      summary: `${book.author} · ${book.genre} · ${book.blurb}`,
    });
  }
  for (const album of listAlbums()) {
    entries.push({
      title: album.title,
      href: '/reading/#music',
      kind: '唱片',
      summary: `${album.artist} · ${album.tag}`,
    });
  }
  for (const track of listTracks()) {
    entries.push({
      title: track.title,
      href: '/reading/#music',
      kind: '酷狗',
      summary: `${track.artist} · ${track.album}${track.note ? ` · ${track.note}` : ''}`,
    });
  }
  for (const photo of listPhotos()) {
    entries.push({
      title: photo.title,
      href: '/photos/#gallery',
      kind: '影集',
      summary: `${SERIES_LABELS[photo.series]} · ${photo.note}`,
    });
  }
  for (const quote of listQuotes()) {
    entries.push({
      title: quote.text,
      href: '/essays/#excerpt',
      kind: '台词',
      summary: [quote.source, quote.work].filter(Boolean).join(' · '),
    });
  }
  for (const link of listLinks()) {
    entries.push({
      title: link.title,
      href: link.url || '/guestbook/#friends',
      kind: '友链',
      summary: [link.note, link.tag].filter(Boolean).join(' · '),
    });
  }

  return json({ ok: true, entries, total: entries.length });
};
