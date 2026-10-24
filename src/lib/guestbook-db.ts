import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * 留言数据库：单文件 SQLite，默认落在项目内 .data/，
 * 容器里通过 GUESTBOOK_DB=/data/guestbook.sqlite 指到挂载卷。
 */
const DB_PATH = resolve(process.env.GUESTBOOK_DB ?? './.data/guestbook.sqlite');

let instance: DatabaseSync | null = null;

export type LetterRow = {
  id: string;
  name: string;
  station: string;
  message: string;
  tag: string;
  is_private: number;
  status: string;
  created_at: string;
};

export type PublicLetter = {
  id: string;
  name: string;
  station: string;
  message: string;
  tag: string;
  created_at: string;
};

export function getDb(): DatabaseSync {
  if (instance) return instance;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      station TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '网文同好',
      is_private INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'approved'
        CHECK (status IN ('pending', 'approved', 'hidden')),
      ip_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS letters_public_idx
      ON letters (created_at DESC)
      WHERE status = 'approved' AND is_private = 0;

    CREATE TABLE IF NOT EXISTS rate_limits (
      ip_hash TEXT PRIMARY KEY,
      last_at INTEGER NOT NULL
    );
  `);

  instance = db;
  return instance;
}

export function listPublicLetters(limit = 60): { messages: PublicLetter[]; total: number } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, station, message, tag, created_at
         FROM letters
        WHERE status = 'approved' AND is_private = 0
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .all(limit) as unknown as PublicLetter[];

  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
         FROM letters
        WHERE status = 'approved' AND is_private = 0`,
    )
    .get() as { total: number } | undefined;

  return { messages: rows, total: row?.total ?? 0 };
}

export function secondsSinceLastPost(ipHash: string): number | null {
  const db = getDb();
  const row = db
    .prepare('SELECT last_at FROM rate_limits WHERE ip_hash = ?')
    .get(ipHash) as { last_at: number } | undefined;
  if (!row) return null;
  return Math.floor(Date.now() / 1000) - row.last_at;
}

export function insertLetter(input: {
  id: string;
  name: string;
  station: string;
  message: string;
  tag: string;
  isPrivate: boolean;
  ipHash: string;
  createdAt: string;
}): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO rate_limits (ip_hash, last_at)
       VALUES (?, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET last_at = excluded.last_at`,
    ).run(input.ipHash, now);

    // 顺手清理一天前的限流记录，避免表无限增长
    db.prepare('DELETE FROM rate_limits WHERE last_at < ?').run(now - 86400);

    db.prepare(
      `INSERT INTO letters
        (id, name, station, message, tag, is_private, status, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.id,
      input.name,
      input.station,
      input.message,
      input.tag,
      input.isPrivate ? 1 : 0,
      input.isPrivate ? 'pending' : 'approved',
      input.ipHash,
      input.createdAt,
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
