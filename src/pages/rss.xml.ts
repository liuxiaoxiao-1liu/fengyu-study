import type { APIRoute } from 'astro';
import { getPosts, postPath } from '../lib/posts';
import { SITE } from '../lib/site';
import { escapeXml } from '../lib/xml';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts();
  const base = site ?? new URL(SITE.url);
  const lastBuild = posts[0]?.data.date ?? new Date();

  const items = posts
    .map((post) => {
      const url = new URL(postPath(post), base).href;
      return [
        '    <item>',
        `      <title>${escapeXml(post.data.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${post.data.date.toUTCString()}</pubDate>`,
        `      <description>${escapeXml(post.data.summary)}</description>`,
        ...post.data.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.title)}</title>
    <link>${escapeXml(base.href)}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(new URL('/rss.xml', base).href)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

// 让构建期明确生成静态文件
export const prerender = true;
