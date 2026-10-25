import { createHash } from 'node:crypto';

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  /** 最多保留多少个 key；超过后清理已过期 key，避免 Map 无限增长。 */
  maxEntries?: number;
  /** 是否把调用方传入的 key 再做一次哈希（IP 等敏感值建议开启）。 */
  hashKey?: boolean;
  hashLength?: number;
};

export type RateLimiter = {
  hit: (key: string) => boolean;
  reset: () => void;
  size: () => number;
};

/**
 * 单进程内存限流。容器重启后清零；多实例部署时每个实例各自计数。
 * nginx 限流仍是第一道防线，这里只做应用层兜底。
 */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { windowMs, max, maxEntries = 2000, hashKey = false, hashLength = 16 } = options;
  const buckets = new Map<string, number[]>();

  function normalize(key: string): string {
    if (!hashKey) return key;
    return createHash('sha256').update(key).digest('hex').slice(0, hashLength);
  }

  function hit(key: string): boolean {
    const now = Date.now();
    const normalized = normalize(key);
    const recent = (buckets.get(normalized) ?? []).filter((at) => now - at < windowMs);

    if (recent.length >= max) {
      buckets.set(normalized, recent);
      return true;
    }

    recent.push(now);
    buckets.set(normalized, recent);

    if (buckets.size > maxEntries) {
      for (const [bucketKey, times] of buckets) {
        if (!times.some((at) => now - at < windowMs)) buckets.delete(bucketKey);
      }
    }

    return false;
  }

  return {
    hit,
    reset: () => buckets.clear(),
    size: () => buckets.size,
  };
}

/** 只在 Node 只监听本地/容器内网、且 nginx 反代时信任这些头。 */
export function clientIp(request: Request, clientAddress?: string): string {
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return clientAddress || 'unknown';
}

export function hashIp(ip: string, length = 12): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, length);
}
