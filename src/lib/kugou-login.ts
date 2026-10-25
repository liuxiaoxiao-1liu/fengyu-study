import { createHash, randomBytes } from 'node:crypto';
import {
  readKugouConfig,
  saveKugouSession,
  disableKugouSession,
  getKugouSession,
  readKugouSettings,
} from './kugou-session';
import { resetKugouRuntime } from './kugou';

const WEB_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const APPID = '1001';
const SRCAPPID = '2919';
const CLIENTVER = '8131';
const H5_URL = 'https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=1001&';

type SignedParams = Record<string, string>;

export type QrLoginState = {
  key: string;
  mid: string;
  dfid: string;
  createdAt: number;
};

const qrStates = new Map<string, QrLoginState>();
const QR_TTL_MS = 5 * 60 * 1000;

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function webSignature(params: SignedParams): string {
  const raw = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('');
  return createHash('md5').update(`${WEB_SALT}${raw}${WEB_SALT}`).digest('hex').toUpperCase();
}

async function signedGet(path: string, params: SignedParams): Promise<any> {
  const signed: SignedParams = { ...params, srcappid: SRCAPPID };
  signed.signature = webSignature(signed);
  const url = `https://login-user.kugou.com${path}?${new URLSearchParams(signed).toString()}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`kugou_http_${response.status}`);
  return response.json();
}

function baseParams(mid: string, dfid: string): SignedParams {
  return {
    appid: APPID,
    srcappid: SRCAPPID,
    clientver: CLIENTVER,
    clienttime: String(Math.floor(Date.now() / 1000)),
    mid,
    uuid: mid,
    dfid,
    plat: '3',
  };
}

/** 生成酷狗扫码登录二维码；二维码图片由酷狗直接返回 base64，不经过第三方。 */
export async function createQrLogin(): Promise<{
  key: string;
  qrcode: string;
  image: string;
  url: string;
  expiresAt: number;
}> {
  const mid = randomHex(16);
  const dfid = randomHex(12);
  const body = await signedGet('/v2/qrcode', {
    ...baseParams(mid, dfid),
    type: '1',
    qrcode_txt: H5_URL,
  });
  const data = body?.data;
  if (body?.status !== 1 || !data?.qrcode || !data?.qrcode_img) {
    throw new Error(`kugou_qr_failed:${body?.error_code ?? 'unknown'}`);
  }
  const key = String(data.qrcode);
  qrStates.set(key, { key, mid, dfid, createdAt: Date.now() });
  // 清掉过期的临时状态
  for (const [id, state] of qrStates) {
    if (Date.now() - state.createdAt > QR_TTL_MS) qrStates.delete(id);
  }
  return {
    key,
    qrcode: data.qrcode,
    image: data.qrcode_img,
    url: `${H5_URL}qrcode=${key}`,
    expiresAt: Date.now() + QR_TTL_MS,
  };
}

export type QrCheckResult =
  | { status: 'waiting' | 'scanned' | 'expired'; message: string }
  | { status: 'success'; message: string; user: { userid: string; masked: string } };

export async function checkQrLogin(key: string): Promise<QrCheckResult> {
  const state = qrStates.get(key);
  if (!state) return { status: 'expired', message: '二维码状态已过期，请重新生成' };
  const body = await signedGet('/v2/get_userinfo_qrcode', {
    ...baseParams(state.mid, state.dfid),
    qrcode: key,
  });
  const data = body?.data ?? {};
  if (body?.status !== 1) throw new Error(`kugou_qr_check_failed:${body?.error_code ?? 'unknown'}`);
  const status = Number(data.status);
  if (status === 4 && data.token && data.userid) {
    const previous = getKugouSession();
    saveKugouSession({
      userid: String(data.userid),
      token: String(data.token),
      vipToken: previous?.vipToken || process.env.KUGOU_VIP_TOKEN || '',
      vipType: previous?.vipType || process.env.KUGOU_VIP_TYPE || '0',
      mid: state.mid,
      guid: state.mid,
      dfid: state.dfid,
    });
    qrStates.delete(key);
    resetKugouRuntime();
    const userid = String(data.userid);
    return {
      status: 'success',
      message: '登录成功',
      user: { userid, masked: maskUserid(userid) },
    };
  }
  if (status === 2) return { status: 'scanned', message: '已扫码，请在手机上确认登录' };
  if (status === 0) {
    qrStates.delete(key);
    return { status: 'expired', message: '二维码已过期，请重新生成' };
  }
  return { status: 'waiting', message: '等待扫码' };
}

export function maskUserid(userid: string): string {
  if (userid.length <= 6) return `${userid.slice(0, 2)}***`;
  return `${userid.slice(0, 3)}***${userid.slice(-3)}`;
}

export function kugouLoginStatus(): {
  configured: boolean;
  source: 'file' | 'env' | null;
  userid: string | null;
  playlistName: string;
  sessionFile: boolean;
} {
  const config = readKugouConfig();
  const playlistName = (readKugouSettings().playlistName || process.env.KUGOU_PLAYLIST_NAME || 'maotouying').trim();
  if (!config) {
    return { configured: false, source: null, userid: null, playlistName, sessionFile: Boolean(getKugouSession()) };
  }
  return {
    configured: true,
    source: config.source,
    userid: maskUserid(config.userid),
    playlistName,
    sessionFile: Boolean(getKugouSession()),
  };
}

export function kugouLogout(): void {
  disableKugouSession();
  resetKugouRuntime();
}
