/**
 * 站内搜索兜底索引：首屏/断网时使用；正常搜索由 GET /api/content/search 从内容库动态生成。
 * 不要在这里手写具体条目；日常内容改 /admin/，src/data/ 只在首启播种时使用。
 */
import { books } from './books';
import { essays } from './essays';
import { albums, tracks } from './music';
import { photos, SERIES_LABELS } from './photos';
import { quotes } from './quotes';
import { friendLinks } from './links';

export type SearchEntry = {
  title: string;
  href: string;
  kind: string;
  summary: string;
};

const pageEntries: SearchEntry[] = [
  { title: '首页', href: '/', kind: '页面', summary: '欢迎光临我的数字秘密基地。' },
  { title: '读听', href: '/reading/', kind: '页面', summary: '追更书架、年度网文与酷狗音乐档案。' },
  { title: '影集', href: '/photos/', kind: '页面', summary: '动漫、摄影与虚拟 CG 的视觉灵感档案。' },
  { title: '随记', href: '/essays/', kind: '页面', summary: '慢慢写下的随笔、书评与歌单笔记。' },
  { title: '留言 & 时光信箱', href: '/guestbook/', kind: '页面', summary: '投递一枚字句，等它在夜里被拆封。' },
];

export const searchIndex: SearchEntry[] = [
  ...pageEntries,

  ...essays.map((essay): SearchEntry => ({
    title: essay.title,
    href: `/essays/${essay.slug}/`,
    kind: '随记',
    summary: essay.summary,
  })),

  ...books.map((book): SearchEntry => ({
    title: book.title,
    href: '/reading/#shelf',
    kind: '网文',
    summary: `${book.author} · ${book.genre} · ${book.blurb}`,
  })),

  ...albums.map((album): SearchEntry => ({
    title: album.title,
    href: '/reading/#music',
    kind: '唱片',
    summary: `${album.artist} · ${album.tag}`,
  })),

  ...tracks.map((track): SearchEntry => ({
    title: track.title,
    href: '/reading/#music',
    kind: '酷狗',
    summary: `${track.artist} · ${track.album}${track.note ? ` · ${track.note}` : ''}`,
  })),

  ...photos.map((photo): SearchEntry => ({
    title: photo.title,
    href: '/photos/#gallery',
    kind: '影集',
    summary: `${SERIES_LABELS[photo.series]} · ${photo.note}`,
  })),

  ...quotes.map((quote): SearchEntry => ({
    title: quote.text,
    href: '/essays/#excerpt',
    kind: '台词',
    summary: [quote.source, quote.work].filter(Boolean).join(' · '),
  })),

  ...friendLinks.map((link): SearchEntry => ({
    title: link.title,
    href: link.url || '/guestbook/#friends',
    kind: '友链',
    summary: [link.note, link.tag].filter(Boolean).join(' · '),
  })),
];
