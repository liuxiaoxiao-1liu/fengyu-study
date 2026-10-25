import { describe, expect, it } from 'vitest';
import { integer, slugify, tags, text } from '../src/lib/validate';

describe('text', () => {
  it('trims, removes control characters and truncates', () => {
    expect(text('  hello\u0000world  ', 20)).toBe('helloworld');
    expect(text('  hello  ', 3)).toBe('hel');
    expect(text(42, 10)).toBe('');
  });
});

describe('integer', () => {
  it('truncates and clamps to the range', () => {
    expect(integer('12.9', 0, 0, 100)).toBe(12);
    expect(integer('-5', 0, 0, 100)).toBe(0);
    expect(integer('500', 0, 0, 100)).toBe(100);
    expect(integer('not-a-number', 7, 0, 100)).toBe(7);
  });
});

describe('slugify', () => {
  it('produces a stable ASCII slug and falls back when empty', () => {
    expect(slugify('Hello, 世界!', 'fallback')).toBe('hello');
    expect(slugify('  ---  ', 'fallback')).toBe('fallback');
    expect(slugify('a'.repeat(100), 'fallback', 10)).toHaveLength(10);
  });
});

describe('tags', () => {
  it('splits, trims and de-duplicates', () => {
    expect(tags('网文, 酷狗，网文、动漫')).toEqual(['网文', '酷狗', '动漫']);
    expect(tags(['a', ' a ', '', 'b'])).toEqual(['a', 'b']);
    expect(tags('x'.repeat(50), 4)).toEqual(['xxxx']);
  });
});
