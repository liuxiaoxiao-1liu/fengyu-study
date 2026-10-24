#!/usr/bin/env node
/**
 * 备份 SQLite 留言库。
 * 用法：
 *   node scripts/backup-guestbook.mjs [guestbook.sqlite] [backup.sqlite]
 * 利用 VACUUM INTO 生成一致性快照，不依赖 sqlite3 命令行。
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve(
  process.argv[2] ?? process.env.GUESTBOOK_DB ?? './.data/guestbook.sqlite',
);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = resolve(process.argv[3] ?? `${dbPath}.${stamp}.bak`);

if (!existsSync(dbPath)) {
  console.error(`找不到数据库：${dbPath}`);
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 5000');
const escaped = outPath.replace(/'/g, "''");
db.exec(`VACUUM INTO '${escaped}'`);

console.log(`备份完成：${outPath}`);
