import type { APIRoute } from 'astro';
import { collectTags, getPosts, postPath, tagPath, formatISO } from '../lib/posts';
import { SITE } from '../lib/site';
import { escapeXml } from '../lib/xml';

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL(SITE.url);
  const posts = await getPosts();
  const tags = collectTags(posts);

  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: new URL('/', base).href, lastmod: formatISO(posts[0]?.data.date ?? new Date()), priority: '1.0' },
    { loc: new URL('/archive/', base).href, priority: '0.7' },
    { loc: new URL('/about/', base).href, priority: '0.5' },
    ...posts.map((post) => ({
      loc: new URL(postPath(post), base).href,
      lastmod: formatISO(post.data.date),
      priority: '0.8',
    })),
    ...tags.map((tag) => ({
      loc: new URL(tagPath(tag.name), base).href,
      priority: '0.4',
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

export const prerender = true;
