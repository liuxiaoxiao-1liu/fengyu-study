import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type KugouSession = {
  userid: string;
  token: string;
  vipToken: string;
  vipType: string;
  mid: string;
  guid: string;
  dfid: string;
  updatedAt: string;
  disabled?: boolean;
};

export type KugouConfig = {
  token: string;
  userid: string;
  vipToken: string;
  vipType: string;
  mid: string;
  guid: string;
  dfid: string;
  source: 'file' | 'env';
};

export type KugouSettings = {
  playlistName?: string;
};

const SESSION_FILE = resolve(process.env.KUGOU_SESSION_FILE ?? './.data/kugou-session.json');
const SETTINGS_FILE = resolve(process.env.KUGOU_SETTINGS_FILE ?? './.data/kugou-settings.json');

function readJson<T>(path: string): T | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
}

export function getKugouSession(): KugouSession | null {
  const session = readJson<KugouSession>(SESSION_FILE);
  if (!session || session.disabled) return null;
  return session;
}

export function saveKugouSession(input: Omit<KugouSession, 'updatedAt'>): void {
  writeJson(SESSION_FILE, { ...input, updatedAt: new Date().toISOString() });
}

/** 退出登录：保留文件但标记 disabled，避免回落到 .env 的旧 token。 */
export function disableKugouSession(): void {
  writeJson(SESSION_FILE, {
    userid: '',
    token: '',
    vipToken: '',
    vipType: '',
    mid: '',
    guid: '',
    dfid: '',
    disabled: true,
    updatedAt: new Date().toISOString(),
  });
}

export function clearKugouSession(): void {
  try {
    rmSync(SESSION_FILE, { force: true });
  } catch {
    // ignore
  }
}

export function readKugouSettings(): KugouSettings {
  return readJson<KugouSettings>(SETTINGS_FILE) ?? {};
}

export function saveKugouSettings(settings: KugouSettings): void {
  writeJson(SETTINGS_FILE, settings);
}

/**
 * 后台登录写入的 /data/kugou-session.json 优先；
 * 没有会话文件时回落 .env 的 KUGOU_*，保持旧部署可继续用。
 */
export function readKugouConfig(): KugouConfig | null {
  const session = readJson<KugouSession>(SESSION_FILE);
  if (session?.disabled) return null;

  const token = session?.token || process.env.KUGOU_TOKEN || '';
  const userid = session?.userid || process.env.KUGOU_USERID || '';
  if (!token || !userid) return null;

  return {
    token,
    userid,
    vipToken: session?.vipToken || process.env.KUGOU_VIP_TOKEN || '',
    vipType: session?.vipType || process.env.KUGOU_VIP_TYPE || '0',
    mid: session?.mid || process.env.KUGOU_MID || '',
    guid: session?.guid || process.env.KUGOU_GUID || '',
    dfid: session?.dfid || process.env.KUGOU_DFID || '',
    source: session?.token ? 'file' : 'env',
  };
}

export function kugouSessionPath(): string {
  return SESSION_FILE;
}
