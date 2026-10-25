import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientIp, createRateLimiter, hashIp } from '../src/lib/rate-limit';

describe('clientIp', () => {
  it('prefers x-real-ip, then the first x-forwarded-for hop, then clientAddress', () => {
    const request = (headers: Record<string, string>) => new Request('http://localhost/', { headers });
    expect(clientIp(request({ 'x-real-ip': ' 1.2.3.4 ' }))).toBe('1.2.3.4');
    expect(clientIp(request({ 'x-forwarded-for': '5.6.7.8, 9.9.9.9' }))).toBe('5.6.7.8');
    expect(clientIp(request({}), '10.0.0.1')).toBe('10.0.0.1');
    expect(clientIp(request({}))).toBe('unknown');
  });
});

describe('hashIp', () => {
  it('is stable and respects the requested length', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
    expect(hashIp('1.2.3.4')).toHaveLength(12);
    expect(hashIp('1.2.3.4', 16)).toHaveLength(16);
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('4.3.2.1'));
  });
});

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to max hits inside the window, then blocks', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    expect(limiter.hit('a')).toBe(false);
    expect(limiter.hit('a')).toBe(false);
    expect(limiter.hit('a')).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(limiter.hit('a')).toBe(false);
  });

  it('hashes keys when requested and can be reset', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, hashKey: true, hashLength: 8 });
    expect(limiter.hit('1.2.3.4')).toBe(false);
    expect(limiter.hit('1.2.3.4')).toBe(true);
    limiter.reset();
    expect(limiter.size()).toBe(0);
    expect(limiter.hit('1.2.3.4')).toBe(false);
  });

  it('keeps different keys independent', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.hit('a')).toBe(false);
    expect(limiter.hit('b')).toBe(false);
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('b')).toBe(true);
  });
});
