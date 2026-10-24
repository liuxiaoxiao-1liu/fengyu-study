import { createRequire } from 'node:module';
import { join } from 'node:path';

// 从 Folia 内置的 KuGouMusicApi 里抽出的最小运行时（MIT，见 vendor/kugou/LICENSE）。
// 只做两件事：/register/dev 换 dfid，/song/url 用账号 token 换音频直链。
const require = createRequire(import.meta.url);
const vendorPath = process.env.KUGOU_VENDOR ?? join(process.cwd(), 'vendor/kugou/index.js');
const { registerDev, songUrl } = require(vendorPath) as {
  registerDev: (params: Record<string, unknown>) => Promise<KugouResponse>;
  songUrl: (params: Record<string, unknown>) => Promise<KugouResponse>;
};

type KugouResponse = {
  status?: number;
  body?: {
    status?: number;
    error_code?: number;
    url?: string | string[];
    backupUrl?: string[];
    data?: { dfid?: string };
  };
};

type KugouConfig = {
  token: string;
  userid: string;
  vipToken: string;
  vipType: string;
  mid: string;
  guid: string;
  dfid: string;
};

const URL_TTL_MS = 4 * 60 * 1000;
const DFID_TTL_MS = 30 * 60 * 1000;

let dfidCache: { value: string; at: number } | null = null;
const urlCache = new Map<string, { url: string; at: number }>();

function readConfig(): KugouConfig | null {
  const token = process.env.KUGOU_TOKEN ?? '';
  const userid = process.env.KUGOU_USERID ?? '';
  if (!token || !userid) return null;
  return {
    token,
    userid,
    vipToken: process.env.KUGOU_VIP_TOKEN ?? '',
    vipType: process.env.KUGOU_VIP_TYPE ?? '0',
    mid: process.env.KUGOU_MID ?? '',
    guid: process.env.KUGOU_GUID ?? '',
    dfid: process.env.KUGOU_DFID ?? '',
  };
}

export function isKugouEnabled(): boolean {
  return readConfig() !== null;
}

function baseCookie(config: KugouConfig, dfid: string): Record<string, string> {
  const guid = config.guid || config.mid;
  return {
    userid: config.userid,
    token: config.token,
    vip_token: config.vipToken,
    vip_type: config.vipType,
    KUGOU_API_MID: config.mid,
    dfid,
    KUGOU_API_GUID: guid,
    KUGOU_API_WEBGL: '',
    KUGOU_API_MAC: '02:00:00:00:00:00',
    KUGOU_API_DEV: guid.slice(0, 10).toUpperCase() || 'KUGOUDEV01',
  };
}

/** 酷狗要求先 /register/dev 拿一个和账号绑定的 dfid，否则 /song/url 返回 20018。 */
async function ensureDfid(config: KugouConfig): Promise<string> {
  if (dfidCache && Date.now() - dfidCache.at < DFID_TTL_MS) return dfidCache.value;

  try {
    const response = await registerDev({
      cookie: baseCookie(config, ''),
      userid: config.userid,
      token: config.token,
    });
    if (response?.body?.status !== 1) {
      throw new Error(`register_dev_failed:${response?.body?.error_code ?? 'unknown'}`);
    }
    const dfid = response.body?.data?.dfid ?? '';
    if (!dfid) throw new Error('register_dev_failed:missing_dfid');
    dfidCache = { value: dfid, at: Date.now() };
    return dfid;
  } catch (error) {
    // 注册失败时退回 .env 里的旧 dfid，至少让已知可用的会话继续跑
    if (config.dfid) {
      dfidCache = { value: config.dfid, at: Date.now() };
      return config.dfid;
    }
    throw error;
  }
}

export type KugouTrackRef = {
  hash: string;
  albumId: string;
  albumAudioId: number;
};

/** 换一条可直接塞进 <audio src> 的酷狗 CDN 直链；失败抛错，由 API 转成 502。 */
export async function resolveKugouUrl(track: KugouTrackRef): Promise<string> {
  const config = readConfig();
  if (!config) throw new Error('kugou_disabled');

  const key = `${track.hash}:${track.albumAudioId}`;
  const hit = urlCache.get(key);
  if (hit && Date.now() - hit.at < URL_TTL_MS) return hit.url;

  const dfid = await ensureDfid(config);
  const cookie = baseCookie(config, dfid);
  const pickUrl = (body: KugouResponse['body']): string => {
    if (!body) return '';
    return Array.isArray(body.url) ? body.url[0] ?? '' : body.url ?? body.backupUrl?.[0] ?? '';
  };

  // 优先带 album_audio_id；部分曲目（尤其免费/翻唱）带它反而返回版权拦截，退回 0 再试。
  let response = await songUrl({
    hash: track.hash,
    album_id: track.albumId,
    album_audio_id: track.albumAudioId,
    quality: 128,
    cookie,
  });
  let url = pickUrl(response?.body);

  if (!url) {
    response = await songUrl({
      hash: track.hash,
      album_id: track.albumId,
      album_audio_id: 0,
      quality: 128,
      cookie,
    });
    url = pickUrl(response?.body);
  }

  if (!url) {
    const body = response?.body ?? {};
    throw new Error(`song_url_failed:${body.error_code ?? 'unknown'}`);
  }

  urlCache.set(key, { url, at: Date.now() });
  // 简单清理，避免 Map 无限增长
  if (urlCache.size > 200) {
    for (const [cacheKey, value] of urlCache) {
      if (Date.now() - value.at >= URL_TTL_MS) urlCache.delete(cacheKey);
    }
  }
  return url;
}
