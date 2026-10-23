import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** 按日期倒序取出全部已发布文章。 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

const fullDateFormat = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const shortDateFormat = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'UTC',
  month: '2-digit',
  day: '2-digit',
});

/** 2026年10月8日 */
export function formatDate(date: Date): string {
  return fullDateFormat.format(date);
}

/** 10.08 */
export function formatShortDate(date: Date): string {
  return shortDateFormat.format(date).replace('/', '.');
}

/** 2026-10-08，用于 <time datetime> */
export function formatISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatYear(date: Date): string {
  return String(date.getUTCFullYear());
}

/** 中文数字年份，用于页眉装饰：二〇二六 */
export function chineseYear(date: Date): string {
  const digits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return String(date.getUTCFullYear())
    .split('')
    .map((n) => digits[Number(n)])
    .join('');
}

/** 粗略估算阅读时间：中文 300 字/分钟，英文 200 词/分钟。 */
export function readingTime(post: Post): number {
  const body = (post.body ?? '').replace(/<[^>]+>/g, ' ');
  const cjk = (body.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = (body.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 300 + words / 200));
}

export function postPath(post: Post): string {
  return `/posts/${post.id}/`;
}

export function tagPath(tag: string): string {
  return `/tags/${encodeURIComponent(tag)}/`;
}

/** 标签按出现次数排序。 */
export function collectTags(posts: Post[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

export function groupByYear(posts: Post[]): { year: string; posts: Post[] }[] {
  const groups = new Map<string, Post[]>();
  for (const post of posts) {
    const year = formatYear(post.data.date);
    const list = groups.get(year) ?? [];
    list.push(post);
    groups.set(year, list);
  }
  return [...groups.entries()].map(([year, list]) => ({ year, posts: list }));
}
