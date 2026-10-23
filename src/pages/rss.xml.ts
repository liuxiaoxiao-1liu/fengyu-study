import type { APIRoute } from 'astro';
import { essays, formatEssayDate } from '../data/essays';
import { SITE } from '../lib/site';
import { escapeXml } from '../lib/xml';

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL(SITE.url);
  const sorted = [...essays].sort((a, b) => b.date.localeCompare(a.date));
  const lastBuild = sorted[0] ? new Date(`${sorted[0].date}T00:00:00Z`) : new Date();

  const items = sorted
    .map((essay) => {
      const url = new URL(`/essays/${essay.slug}/`, base).href;
      return [
        '    <item>',
        `      <title>${escapeXml(essay.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${new Date(`${essay.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(essay.summary)}</description>`,
        ...essay.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.name)} / ${escapeXml(SITE.latin)}</title>
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

export const prerender = true;
