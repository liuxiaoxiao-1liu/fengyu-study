import type { APIRoute } from 'astro';
import { extname, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { UPLOAD_ROOT } from '../../../lib/uploads';

export const prerender = false;

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

export const GET: APIRoute = async ({ params }) => {
  const raw = params.path ?? '';
  const parts = raw.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0] !== 'photos' || parts.some((part) => part === '..' || part.includes('\\'))) {
    return new Response('not found', { status: 404 });
  }

  const filePath = resolve(UPLOAD_ROOT, ...parts);
  if (filePath !== UPLOAD_ROOT && !filePath.startsWith(UPLOAD_ROOT + sep)) {
    return new Response('not found', { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    const type = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
};
