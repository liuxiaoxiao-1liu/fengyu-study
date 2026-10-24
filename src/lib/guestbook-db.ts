import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * 留言数据库：单文件 SQLite，默认落在项目内 .data/，
 * 容器里通过 GUESTBOOK_DB=/data/guestbook.sqlite 指到挂载卷。
 */
const DB_PATH = resolve(process.env.GUESTBOOK_DB ?? './.data/guestbook.sqlite');

let instance: DatabaseSync | null = null;

export type LetterStatus = 'pending' | 'approved' | 'hidden';

/** 公开列表返回的字段：不含 ip_hash、is_private 等后台信息。 */
export type PublicLetter = {
  id: string;
  name: string;
  station: string;
  message: string;
  tag: string;
  reply: string;
  replied_at: string | null;
  created_at: string;
};

/** 管理端列表返回的字段：含私密标记与审核状态，但同样不含 ip_hash。 */
export type AdminLetter = PublicLetter & {
  is_private: number;
  status: LetterStatus;
};

export type LetterCounts = {
  total: number;
  approved: number;
  pending: number;
  hidden: number;
  replied: number;
  /** 公开可见（approved 且非私密）的留言数，前台「累计收到」用它 */
  publicTotal: number;
  /** 公开可见且已有房主回复的条数，回复率用它 */
  publicReplied: number;
};

export type UpdateLetterPatch = {
  status?: LetterStatus;
  reply?: string;
};

const LETTER_STATUSES: readonly LetterStatus[] = ['pending', 'approved', 'hidden'];

export function isLetterStatus(value: unknown): value is LetterStatus {
  return typeof value === 'string' && (LETTER_STATUSES as readonly string[]).includes(value);
}

function tableColumns(db: DatabaseSync, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

/**
 * 幂等迁移：老库的 letters 表没有 reply / replied_at，先看 PRAGMA 再加列。
 * 新库在 CREATE TABLE 里已经带上了这两列，这里会直接跳过。
 */
function migrateLettersTable(db: DatabaseSync): void {
  const columns = tableColumns(db, 'letters');

  if (!columns.has('reply')) {
    db.exec("ALTER TABLE letters ADD COLUMN reply TEXT NOT NULL DEFAULT ''");
  }

  if (!columns.has('replied_at')) {
    db.exec('ALTER TABLE letters ADD COLUMN replied_at TEXT');
  }
}

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
      created_at TEXT NOT NULL,
      reply TEXT NOT NULL DEFAULT '',
      replied_at TEXT
    );

    CREATE INDEX IF NOT EXISTS letters_public_idx
      ON letters (created_at DESC)
      WHERE status = 'approved' AND is_private = 0;

    CREATE INDEX IF NOT EXISTS letters_status_idx
      ON letters (status, created_at DESC);

    CREATE TABLE IF NOT EXISTS rate_limits (
      ip_hash TEXT PRIMARY KEY,
      last_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'quarterly',
      confirmed INTEGER NOT NULL DEFAULT 0
    );
  `);

  migrateLettersTable(db);

  instance = db;
  return instance;
}

export function listPublicLetters(limit = 60): { messages: PublicLetter[]; total: number } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, station, message, tag, reply, replied_at, created_at
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

export function getLetterCounts(): LetterCounts {
  const db = getDb();
  const rows = db
    .prepare('SELECT status, COUNT(*) AS count FROM letters GROUP BY status')
    .all() as unknown as { status: string; count: number }[];

  const counts: LetterCounts = {
    total: 0,
    approved: 0,
    pending: 0,
    hidden: 0,
    replied: 0,
    publicTotal: 0,
    publicReplied: 0,
  };

  for (const row of rows) {
    counts.total += row.count;
    if (row.status === 'approved') counts.approved = row.count;
    else if (row.status === 'pending') counts.pending = row.count;
    else if (row.status === 'hidden') counts.hidden = row.count;
  }

  const replied = db
    .prepare("SELECT COUNT(*) AS count FROM letters WHERE reply <> ''")
    .get() as { count: number } | undefined;
  counts.replied = replied?.count ?? 0;

  const publicStats = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN reply <> '' THEN 1 ELSE 0 END), 0) AS replied
         FROM letters
        WHERE status = 'approved' AND is_private = 0`,
    )
    .get() as { total: number; replied: number } | undefined;
  counts.publicTotal = publicStats?.total ?? 0;
  counts.publicReplied = publicStats?.replied ?? 0;

  return counts;
}

export function listAdminLetters(
  status: LetterStatus | 'all' = 'all',
  limit = 200,
): { letters: AdminLetter[]; counts: LetterCounts } {
  const db = getDb();
  const where = status === 'all' ? '' : 'WHERE status = ?';
  const params: (string | number)[] = status === 'all' ? [limit] : [status, limit];

  const letters = db
    .prepare(
      `SELECT id, name, station, message, tag, is_private, status,
              reply, replied_at, created_at
         FROM letters
         ${where}
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .all(...params) as unknown as AdminLetter[];

  return { letters, counts: getLetterCounts() };
}

export function getAdminLetter(id: string): AdminLetter | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, station, message, tag, is_private, status,
              reply, replied_at, created_at
         FROM letters
        WHERE id = ?`,
    )
    .get(id) as unknown as AdminLetter | undefined;

  return row ?? null;
}

export function listLettersForExport(): AdminLetter[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, name, station, message, tag, is_private, status,
              reply, replied_at, created_at
         FROM letters
        ORDER BY created_at ASC`,
    )
    .all() as unknown as AdminLetter[];
}

/**
 * 更新审核状态 / 房主回复。
 * 写回复时同步写 replied_at；把回复清空则把 replied_at 置空。
 */
export function updateAdminLetter(id: string, patch: UpdateLetterPatch): AdminLetter | null {
  const db = getDb();
  if (!getAdminLetter(id)) return null;

  const assignments: string[] = [];
  const values: (string | null)[] = [];

  if (patch.status !== undefined) {
    assignments.push('status = ?');
    values.push(patch.status);
  }

  if (patch.reply !== undefined) {
    assignments.push('reply = ?');
    values.push(patch.reply);
    assignments.push('replied_at = ?');
    values.push(patch.reply === '' ? null : new Date().toISOString());
  }

  if (assignments.length === 0) return getAdminLetter(id);

  db.prepare(`UPDATE letters SET ${assignments.join(', ')} WHERE id = ?`).run(...values, id);
  return getAdminLetter(id);
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
