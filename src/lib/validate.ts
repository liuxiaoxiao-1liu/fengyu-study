/** 去掉控制字符、首尾空白，并截断到 max 长度；非字符串一律当空串。 */
export function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export function integer(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export function slugify(value: string, fallback: string, max = 90): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  return slug || fallback;
}

/** 逗号/顿号分隔的标签，去空、去重、截断。 */
export function tags(value: unknown, max = 40): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/[,，、]/);
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = text(item, max);
    if (tag && !seen.has(tag)) seen.add(tag);
  }
  return [...seen];
}
