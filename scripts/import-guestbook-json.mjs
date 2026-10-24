#!/usr/bin/env node
/**
 * 把旧版 PHP 的 guestbook.json 导入 SQLite。
 * 用法：
 *   node scripts/import-guestbook-json.mjs [guestbook.json] [guestbook.sqlite]
 * 默认读取 /var/lib/xiaoquanzi/guestbook.json，写入 ./.data/guestbook.sqlite。
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const jsonPath = resolve(process.argv[2] ?? '/var/lib/xiaoquanzi/guestbook.json');
const dbPath = resolve(process.argv[3] ?? process.env.GUESTBOOK_DB ?? './.data/guestbook.sqlite');

if (!existsSync(jsonPath)) {
  console.error(`找不到 JSON 文件：${jsonPath}`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
if (!Array.isArray(raw)) {
  console.error('JSON 顶层不是数组，中止。');
  process.exit(1);
}

mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
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
`);

const insert = db.prepare(`
  INSERT OR IGNORE INTO letters
    (id, name, station, message, tag, is_private, status, ip_hash, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
let skipped = 0;

db.exec('BEGIN');
try {
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      skipped += 1;
      continue;
    }

    const id = String(item.id ?? '').trim();
    const name = String(item.name ?? '')
      .trim()
      .slice(0, 40);
    const message = String(item.message ?? '')
      .trim()
      .slice(0, 800);
    if (!id || !name || !message) {
      skipped += 1;
      continue;
    }

    const isPrivate = Boolean(item.private);
    const result = insert.run(
      id,
      name,
      String(item.station ?? '')
        .trim()
        .slice(0, 100),
      message,
      String(item.tag ?? '网文同好')
        .trim()
        .slice(0, 20) || '网文同好',
      isPrivate ? 1 : 0,
      isPrivate ? 'pending' : item.approved ? 'approved' : 'pending',
      String(item.ip_hash ?? 'imported'),
      String(item.created_at ?? new Date().toISOString()),
    );

    if (result.changes > 0) inserted += 1;
    else skipped += 1;
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const total = db.prepare('SELECT COUNT(*) AS n FROM letters').get()?.n ?? 0;
console.log(`导入完成：新增 ${inserted} 条，跳过 ${skipped} 条，当前共 ${total} 条。`);
console.log(`数据库：${dbPath}`);
