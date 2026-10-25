import { describe, expect, it } from 'vitest';
import { ADMIN_SCHEMAS, getAdminSchema, parseContentInput } from '../src/lib/content-schema';

const essay = {
  slug: 'hello-world',
  title: '你好，世界',
  date: '2025-10-01',
  category: '随笔',
  kind: 'essay',
  readMinutes: '4',
  tags: '网文, 音乐，网文',
  quote: '一句话',
  summary: '摘要',
  body: '<p>正文</p>',
  sortOrder: '3',
};

describe('content schema', () => {
  it('exposes all record types', () => {
    expect(ADMIN_SCHEMAS).toHaveLength(6);
    expect(getAdminSchema('essays')?.type).toBe('essays');
    expect(getAdminSchema('nope')).toBeNull();
  });

  it('parses a valid essay and normalizes fields', () => {
    const result = parseContentInput('essays', essay);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe('hello-world');
    expect(result.value.title).toBe('你好，世界');
    expect(result.value.sortOrder).toBe(3);
    expect(result.value.data.tags).toEqual(['网文', '音乐']);
    expect(result.value.data.readMinutes).toBe(4);
    expect(result.value.data.kind).toBe('essay');
  });

  it('rejects missing required fields and invalid select values', () => {
    expect(parseContentInput('essays', { ...essay, title: '' })).toEqual({
      ok: false,
      error: '缺少标题',
    });
    expect(parseContentInput('essays', { ...essay, kind: 'unknown' })).toEqual({
      ok: false,
      error: '类型缺少或取值不合法',
    });
  });

  it('converts track kugou fields into a nested object and removes flat keys', () => {
    const result = parseContentInput('tracks', {
      slug: 'track-1',
      title: '曲目',
      kugouHash: 'ABCDEF',
      kugouAlbumId: '42',
      kugouAlbumAudioId: '7',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.kugou).toEqual({ hash: 'abcdef', albumId: '42', albumAudioId: 7 });
    expect(result.value.data).not.toHaveProperty('kugouHash');
    expect(result.value.data).not.toHaveProperty('kugouAlbumId');
  });
});
