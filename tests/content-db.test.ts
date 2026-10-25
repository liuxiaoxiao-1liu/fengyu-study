import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dir: string;
let dbPath: string;
let contentDb: typeof import('../src/lib/content-db');

const essayData = {
  slug: 'test-entry',
  title: '测试条目',
  date: '2025-10-01',
  category: '测试',
  kind: 'essay',
  readMinutes: 1,
  tags: ['测试'],
  quote: '',
  summary: '摘要',
  body: '<p>正文</p>',
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'fengyu-content-'));
  dbPath = join(dir, 'content.sqlite');
  process.env.CONTENT_DB = dbPath;
  vi.resetModules();
  contentDb = await import('../src/lib/content-db');
});

afterEach(() => {
  contentDb.closeContentDb();
  delete process.env.CONTENT_DB;
  rmSync(dir, { recursive: true, force: true });
});

describe('content database', () => {
  it('seeds content records and photos once', () => {
    expect(contentDb.listEssays().length).toBeGreaterThan(0);
    expect(contentDb.listBooks().length).toBeGreaterThan(0);
    expect(contentDb.listPhotoRecords().length).toBeGreaterThan(0);
    const firstCount = contentDb.listEssays().length;
    expect(contentDb.listEssays()).toHaveLength(firstCount);
  });

  it('writes a versioned seed manifest instead of a timestamp', () => {
    contentDb.listEssays();
    contentDb.closeContentDb();
    const raw = new DatabaseSync(dbPath);
    const row = raw.prepare("SELECT value FROM settings WHERE key = 'records_seeded_essays'").get() as
      { value: string } | undefined;
    raw.close();
    expect(row).toBeDefined();
    const manifest = JSON.parse(row!.value) as { version: number; slugs: string[] };
    expect(manifest.version).toBe(1);
    expect(manifest.slugs).toContain('why-webnovels-and-old-songs');
  });

  it('supports create, update and delete', () => {
    const created = contentDb.createContentRecord('essays', {
      slug: 'test-entry',
      title: '测试条目',
      data: essayData,
      sortOrder: 10,
    });
    expect(created.slug).toBe('test-entry');
    expect(contentDb.getContentRecordBySlug('essays', 'test-entry')?.id).toBe(created.id);

    const updated = contentDb.updateContentRecord('essays', created.id, {
      slug: 'test-entry-2',
      title: '测试条目 2',
      data: { ...essayData, title: '测试条目 2', slug: 'test-entry-2' },
      sortOrder: 11,
    });
    expect(updated?.slug).toBe('test-entry-2');
    expect(updated?.sortOrder).toBe(11);

    expect(contentDb.deleteContentRecord('essays', created.id)).toBe(true);
    expect(contentDb.getContentRecord('essays', created.id)).toBeNull();
  });
});
