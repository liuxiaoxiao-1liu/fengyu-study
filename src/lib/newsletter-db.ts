// 季刊订阅数据层：subscribers 表在 guestbook-db 的幂等迁移里创建，
// 这里只负责订阅相关的读写，避免两处各自 CREATE TABLE。
import { getDb } from './guestbook-db';

export type SubscriberRow = {
  email: string;
  created_at: string;
  source: string;
  confirmed: number;
};

/**
 * 幂等入库：同一个邮箱（COLLATE NOCASE）重复提交不会新增行。
 * 返回 created=false 表示这次是重复订阅。
 */
export function addSubscriber(email: string, source = 'quarterly'): { created: boolean } {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO subscribers (email, created_at, source, confirmed)
       VALUES (?, ?, ?, 0)
       ON CONFLICT DO NOTHING`,
    )
    .run(email, new Date().toISOString(), source);

  return { created: Number(result.changes) > 0 };
}

export function listSubscribers(): SubscriberRow[] {
  const db = getDb();
  return db
    .prepare('SELECT email, created_at, source, confirmed FROM subscribers ORDER BY created_at ASC')
    .all() as unknown as SubscriberRow[];
}

export function countSubscribers(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS count FROM subscribers').get() as { count: number } | undefined;
  return row?.count ?? 0;
}
