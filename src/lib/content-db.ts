import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { photos as seedPhotos, type Photo, type PhotoExif, type PhotoSeries } from '../data/photos';

const DB_PATH = resolve(process.env.CONTENT_DB ?? './.data/content.sqlite');

let instance: DatabaseSync | null = null;

export type PhotoRecord = Photo & {
  id: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PhotoInput = {
  slug: string;
  title: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  series: PhotoSeries;
  takenAt: string;
  note: string;
  badge: string;
  exif?: PhotoExif;
  sortOrder?: number;
};

function db(): DatabaseSync {
  if (instance) return instance;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  instance = new DatabaseSync(DB_PATH);
  instance.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      src TEXT NOT NULL,
      alt TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 1200,
      height INTEGER NOT NULL DEFAULT 800,
      series TEXT NOT NULL,
      taken_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      badge TEXT NOT NULL DEFAULT '',
      exif TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  seedOnce(instance);
  return instance;
}

function seedOnce(database: DatabaseSync): void {
  const seeded = database.prepare("SELECT value FROM settings WHERE key = 'photos_seeded'").get() as
    { value: string } | undefined;
  if (seeded) return;

  const now = new Date().toISOString();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO photos
      (id, slug, title, src, alt, width, height, series, taken_at, note, badge, exif, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  seedPhotos.forEach((photo, index) => {
    insert.run(
      randomUUID(),
      photo.slug,
      photo.title,
      photo.src,
      photo.alt,
      photo.width,
      photo.height,
      photo.series,
      photo.takenAt,
      photo.note,
      photo.badge,
      JSON.stringify(photo.exif ?? {}),
      index,
      now,
      now,
    );
  });
  database.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('photos_seeded', ?)").run(now);
}

function parseExif(value: string): PhotoExif | undefined {
  try {
    const parsed = JSON.parse(value) as PhotoExif;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function toRecord(row: Record<string, unknown>): PhotoRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    src: String(row.src),
    alt: String(row.alt),
    width: Number(row.width),
    height: Number(row.height),
    series: String(row.series) as PhotoSeries,
    takenAt: String(row.taken_at),
    note: String(row.note ?? ''),
    badge: String(row.badge ?? ''),
    exif: parseExif(String(row.exif ?? '{}')),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listPhotoRecords(): PhotoRecord[] {
  const rows = db()
    .prepare('SELECT * FROM photos ORDER BY sort_order ASC, taken_at DESC, created_at ASC')
    .all() as unknown as Record<string, unknown>[];
  return rows.map(toRecord);
}

export function listPhotos(): Photo[] {
  return listPhotoRecords().map(({ id, sortOrder, createdAt, updatedAt, ...photo }) => photo);
}

export function getPhotoRecord(id: string): PhotoRecord | null {
  const row = db().prepare('SELECT * FROM photos WHERE id = ?').get(id) as unknown as
    Record<string, unknown> | undefined;
  return row ? toRecord(row) : null;
}

export function getPhotoBySlug(slug: string): PhotoRecord | null {
  const row = db().prepare('SELECT * FROM photos WHERE slug = ?').get(slug) as unknown as
    Record<string, unknown> | undefined;
  return row ? toRecord(row) : null;
}

export function createPhoto(input: PhotoInput): PhotoRecord {
  const now = new Date().toISOString();
  const id = randomUUID();
  const sortOrder =
    typeof input.sortOrder === 'number'
      ? input.sortOrder
      : (
          db().prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM photos').get() as {
            next: number;
          }
        ).next;

  db()
    .prepare(
      `INSERT INTO photos
        (id, slug, title, src, alt, width, height, series, taken_at, note, badge, exif, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.slug,
      input.title,
      input.src,
      input.alt,
      input.width,
      input.height,
      input.series,
      input.takenAt,
      input.note,
      input.badge,
      JSON.stringify(input.exif ?? {}),
      sortOrder,
      now,
      now,
    );

  return getPhotoRecord(id)!;
}

export function updatePhoto(id: string, input: PhotoInput): PhotoRecord | null {
  const existing = getPhotoRecord(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  db()
    .prepare(
      `UPDATE photos SET
        slug = ?, title = ?, src = ?, alt = ?, width = ?, height = ?, series = ?,
        taken_at = ?, note = ?, badge = ?, exif = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      input.slug,
      input.title,
      input.src,
      input.alt,
      input.width,
      input.height,
      input.series,
      input.takenAt,
      input.note,
      input.badge,
      JSON.stringify(input.exif ?? {}),
      input.sortOrder ?? existing.sortOrder,
      now,
      id,
    );
  return getPhotoRecord(id);
}

export function deletePhoto(id: string): boolean {
  const result = db().prepare('DELETE FROM photos WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}
