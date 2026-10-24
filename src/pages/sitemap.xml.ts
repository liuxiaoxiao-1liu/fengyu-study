import type { APIRoute } from 'astro';
import { listEssays } from '../lib/content-db';
import { SITE } from '../lib/site';
import { escapeXml } from '../lib/xml';

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const essays = listEssays();
  const base = site ?? new URL(SITE.url);
  const sorted = [...essays].sort((a, b) => b.date.localeCompare(a.date));

  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: new URL('/', base).href, priority: '1.0' },
    { loc: new URL('/reading/', base).href, priority: '0.8' },
    { loc: new URL('/photos/', base).href, priority: '0.8' },
    { loc: new URL('/essays/', base).href, priority: '0.8' },
    { loc: new URL('/guestbook/', base).href, priority: '0.6' },
    ...sorted.map((essay) => ({
      loc: new URL(`/essays/${essay.slug}/`, base).href,
      lastmod: essay.date,
      priority: '0.7',
    })),
  ];

  const body = urls
    .map(
      ({ loc, lastmod, priority }) => `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <priority>${priority}</priority>
  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
