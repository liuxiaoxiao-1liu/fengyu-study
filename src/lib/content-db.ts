import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { photos as seedPhotos, type Photo, type PhotoExif, type PhotoSeries } from '../data/photos';
import { essays as seedEssays, type Essay } from '../data/essays';
import { books as seedBooks, type Book } from '../data/books';
import { albums as seedAlbums, tracks as seedTracks, type Album, type Track } from '../data/music';
import { quotes as seedQuotes, type Quote } from '../data/quotes';

const DB_PATH = resolve(process.env.CONTENT_DB ?? './.data/content.sqlite');

let instance: DatabaseSync | null = null;

export type PhotoRecord = Photo & {
  id: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type RecordType = 'essays' | 'books' | 'albums' | 'tracks' | 'quotes';

export type ContentRecord = {
  id: string;
  type: RecordType;
  slug: string;
  title: string;
  data: Record<string, unknown>;
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
    CREATE TABLE IF NOT EXISTS content_records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (type, slug)
    );
    CREATE INDEX IF NOT EXISTS content_records_type_idx ON content_records (type, sort_order);
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
  seedRecords(instance);
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

type SeedEntry = { slug: string; title: string; data: Record<string, unknown> };

function seedRecords(database: DatabaseSync): void {
  const now = new Date().toISOString();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO content_records (id, type, slug, title, data, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const groups: Array<[RecordType, SeedEntry[]]> = [
    [
      'essays',
      seedEssays.map((essay) => ({
        slug: essay.slug,
        title: essay.title,
        data: essay as unknown as Record<string, unknown>,
      })),
    ],
    [
      'books',
      seedBooks.map((book) => ({
        slug: book.slug,
        title: book.title,
        data: book as unknown as Record<string, unknown>,
      })),
    ],
    [
      'albums',
      seedAlbums.map((album) => ({
        slug: album.slug,
        title: album.title,
        data: album as unknown as Record<string, unknown>,
      })),
    ],
    [
      'tracks',
      seedTracks.map((track) => ({
        slug: track.slug,
        title: track.title,
        data: track as unknown as Record<string, unknown>,
      })),
    ],
    [
      'quotes',
      seedQuotes.map((quote) => ({
        slug: quote.id,
        title: quote.text,
        data: quote as unknown as Record<string, unknown>,
      })),
    ],
  ];

  for (const [type, entries] of groups) {
    const flag = `records_seeded_${type}`;
    const seeded = database.prepare('SELECT value FROM settings WHERE key = ?').get(flag) as
      { value: string } | undefined;
    if (seeded) continue;
    entries.forEach((entry, index) => {
      insert.run(randomUUID(), type, entry.slug, entry.title, JSON.stringify(entry.data), index, now, now);
    });
    database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(flag, now);
  }
}

function rowToRecord(row: Record<string, unknown>): ContentRecord {
  let data: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(row.data ?? '{}')) as unknown;
    data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  return {
    id: String(row.id),
    type: String(row.type) as RecordType,
    slug: String(row.slug),
    title: String(row.title),
    data,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listContentRecords(type: RecordType): ContentRecord[] {
  const rows = db()
    .prepare('SELECT * FROM content_records WHERE type = ? ORDER BY sort_order ASC, created_at ASC')
    .all(type) as unknown as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

export function getContentRecord(type: RecordType, id: string): ContentRecord | null {
  const row = db().prepare('SELECT * FROM content_records WHERE type = ? AND id = ?').get(type, id) as unknown as
    Record<string, unknown> | undefined;
  return row ? rowToRecord(row) : null;
}

export function getContentRecordBySlug(type: RecordType, slug: string): ContentRecord | null {
  const row = db().prepare('SELECT * FROM content_records WHERE type = ? AND slug = ?').get(type, slug) as unknown as
    Record<string, unknown> | undefined;
  return row ? rowToRecord(row) : null;
}

export function createContentRecord(
  type: RecordType,
  entry: { slug: string; title: string; data: Record<string, unknown>; sortOrder?: number },
): ContentRecord {
  const now = new Date().toISOString();
  const id = randomUUID();
  const sortOrder =
    typeof entry.sortOrder === 'number'
      ? entry.sortOrder
      : (
          db()
            .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM content_records WHERE type = ?')
            .get(type) as { next: number }
        ).next;
  db()
    .prepare(
      `INSERT INTO content_records (id, type, slug, title, data, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, type, entry.slug, entry.title, JSON.stringify(entry.data), sortOrder, now, now);
  return getContentRecord(type, id)!;
}

export function updateContentRecord(
  type: RecordType,
  id: string,
  entry: { slug: string; title: string; data: Record<string, unknown>; sortOrder?: number },
): ContentRecord | null {
  const existing = getContentRecord(type, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  db()
    .prepare(
      `UPDATE content_records SET slug = ?, title = ?, data = ?, sort_order = ?, updated_at = ?
       WHERE type = ? AND id = ?`,
    )
    .run(entry.slug, entry.title, JSON.stringify(entry.data), entry.sortOrder ?? existing.sortOrder, now, type, id);
  return getContentRecord(type, id);
}

export function deleteContentRecord(type: RecordType, id: string): boolean {
  const result = db().prepare('DELETE FROM content_records WHERE type = ? AND id = ?').run(type, id);
  return Number(result.changes) > 0;
}

export function listEssays(): Essay[] {
  return listContentRecords('essays')
    .map((record) => record.data as unknown as Essay)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getEssayBySlug(slug: string): Essay | null {
  const record = getContentRecordBySlug('essays', slug);
  return record ? (record.data as unknown as Essay) : null;
}

export function listBooks(): Book[] {
  return listContentRecords('books').map((record) => record.data as unknown as Book);
}

export function listAlbums(): Album[] {
  return listContentRecords('albums').map((record) => record.data as unknown as Album);
}

export function listTracks(): Track[] {
  return listContentRecords('tracks').map((record) => record.data as unknown as Track);
}

export function listQuotes(): Quote[] {
  return listContentRecords('quotes').map((record) => record.data as unknown as Quote);
}

/** 首页/专辑精选曲目的白名单：来自后台的 tracks 表（含 kugou 元数据）。 */
export function findCuratedTrack(hash: string): Track | null {
  const normalized = hash.toLowerCase();
  for (const track of listTracks()) {
    if (track.kugou?.hash.toLowerCase() === normalized) return track;
  }
  return null;
}
