import type { PhotoExif, PhotoSeries } from '../data/photos';
import type { PhotoInput } from './content-db';
import { integer, slugify, text } from './validate';

const SERIES: PhotoSeries[] = ['anime', 'reality', 'virtual'];

function exifFrom(value: unknown): PhotoExif | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const exif: PhotoExif = {};
  for (const key of ['camera', 'lens', 'aperture', 'shutter', 'iso', 'location'] as const) {
    const item = text(source[key], 120);
    if (item) exif[key] = item;
  }
  return Object.keys(exif).length > 0 ? exif : undefined;
}

export function parsePhotoInput(
  body: Record<string, unknown>,
): { ok: true; value: PhotoInput } | { ok: false; error: string } {
  const title = text(body.title, 120);
  const src = text(body.src, 500);
  const alt = text(body.alt, 300);
  if (!title) return { ok: false, error: '缺少标题' };
  if (!src) return { ok: false, error: '缺少图片地址' };
  if (!alt) return { ok: false, error: '缺少图片描述' };

  const seriesValue = text(body.series, 20) as PhotoSeries;
  if (!SERIES.includes(seriesValue)) return { ok: false, error: '系列只能是 anime / reality / virtual' };

  const takenAt = /^\d{4}-\d{2}-\d{2}$/.test(text(body.takenAt, 10))
    ? text(body.takenAt, 10)
    : new Date().toISOString().slice(0, 10);

  const value: PhotoInput = {
    slug: slugify(text(body.slug, 80), `photo-${Date.now().toString(36)}`, 80),
    title,
    src,
    alt,
    width: integer(body.width, 1200, 1, 20000),
    height: integer(body.height, 800, 1, 20000),
    series: seriesValue,
    takenAt,
    note: text(body.note, 400),
    badge: text(body.badge, 80),
    exif: exifFrom(body.exif),
    sortOrder: integer(body.sortOrder, 0, 0, 100000),
  };

  return { ok: true, value };
}
