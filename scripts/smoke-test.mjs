#!/usr/bin/env node
/**
 * 构建产物冒烟测试：拉起 dist/server/entry.mjs，用临时 SQLite 跑一遍关键接口。
 *
 * 覆盖：
 * - 五个栏目 + admin + RSS + sitemap 可访问
 * - 公开留言 / 悄悄话入库与可见性
 * - 每 IP 60 秒限流
 * - 管理端鉴权（401）、cookie 登录、列表、审核、回复、404
 * - 内容 / 照片 CRUD、图片上传、媒体访问与路径穿越
 * - 季刊订阅幂等 + CSV/JSON 导出
 * - 酷狗歌单只读接口
 *
 * 用法：npm run smoke（需先 npm run build）
 * 退出码 0 表示全部通过；失败时会打印失败项与服务端日志。
 */
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { createServer } from 'node:net';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENTRY = join(ROOT, 'dist/server/entry.mjs');
const ADMIN_TOKEN = 'smoke-test-token';
const ADMIN_USER = 'smoke-admin';
const ADMIN_PASSWORD = 'smoke-password';
const ADMIN_SALT = randomBytes(16);
const ADMIN_PASSWORD_HASH = `scrypt:${ADMIN_SALT.toString('hex')}:${scryptSync(ADMIN_PASSWORD, ADMIN_SALT, 64).toString('hex')}`;
const DB_PATH = join(tmpdir(), `fengyu-smoke-${process.pid}-${Date.now()}.sqlite`);
const CONTENT_DB = join(tmpdir(), `fengyu-smoke-content-${process.pid}-${Date.now()}.sqlite`);
const CONTENT_UPLOADS = join(tmpdir(), `fengyu-smoke-uploads-${process.pid}-${Date.now()}`);

if (!existsSync(ENTRY)) {
  console.error(`找不到 ${ENTRY}，请先运行 npm run build`);
  process.exit(1);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failures.push({ name, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(base, path, options = {}) {
  const { body, ...rest } = options;
  const response = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(rest.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // 非 JSON 响应（HTML / XML / CSV）保持 null
  }
  return { status: response.status, headers: response.headers, text, json };
}

function sessionCookie(response) {
  const setCookie = response.headers.get('set-cookie') ?? '';
  return /fengyu_admin=[^;]+/.exec(setCookie)?.[0] ?? '';
}

const baseHeaders = { 'x-real-ip': '198.51.100.1' };
const ipA = { ...baseHeaders, 'x-real-ip': '198.51.100.10' };
const ipB = { ...baseHeaders, 'x-real-ip': '198.51.100.11' };
const ipC = { ...baseHeaders, 'x-real-ip': '198.51.100.12' };

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const logs = [];
const child = spawn(process.execPath, [ENTRY], {
  cwd: ROOT,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    GUESTBOOK_DB: DB_PATH,
    CONTENT_DB,
    CONTENT_UPLOADS,
    ADMIN_TOKEN,
    ADMIN_USER,
    ADMIN_PASSWORD_HASH,
    ADMIN_SESSION_SECRET: 'smoke-session-secret',
    ASTRO_TELEMETRY_DISABLED: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
child.stderr.on('data', (chunk) => logs.push(chunk.toString()));

let exited = false;
child.on('exit', () => {
  exited = true;
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (exited) return false;
    try {
      const response = await fetch(`${base}/api/stats`);
      if (response.ok) return true;
    } catch {
      // 还没起来，继续等
    }
    await sleep(100);
  }
  return false;
}

function cleanup() {
  if (!exited) {
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 1500).unref();
  }
  for (const base of [DB_PATH, CONTENT_DB]) {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        rmSync(`${base}${suffix}`, { force: true });
      } catch {
        // 清理失败不影响主流程
      }
    }
  }
  try {
    rmSync(CONTENT_UPLOADS, { recursive: true, force: true });
  } catch {
    // 清理失败不影响主流程
  }
}

try {
  if (!(await waitForServer())) {
    console.error('服务没有在 10 秒内就绪，服务端输出：');
    console.error(logs.join(''));
    process.exitCode = 1;
  } else {
    console.log('\n[1/6] 页面与静态资源');
    for (const path of [
      '/',
      '/reading/',
      '/photos/',
      '/essays/',
      '/guestbook/',
      '/admin/',
      '/rss.xml',
      '/sitemap.xml',
    ]) {
      const response = await request(base, path);
      check(`GET ${path} → 200`, response.status === 200, `实际 ${response.status}`);
      check(`GET ${path} 有内容`, response.text.length > 500, `长度 ${response.text.length}`);
    }
    {
      const response = await request(base, '/does-not-exist');
      check('GET /does-not-exist → 404', response.status === 404, `实际 ${response.status}`);
    }

    {
      const response = await request(base, '/api/content/search');
      check('GET /api/content/search → 200', response.status === 200, `实际 ${response.status}`);
      const entries = Array.isArray(response.json?.entries) ? response.json.entries : [];
      check('搜索索引包含内容', entries.length > 10, `实际 ${entries.length}`);
      check(
        '搜索索引包含友链',
        entries.some((entry) => entry.kind === '友链'),
      );
      const guestbook = await request(base, '/guestbook/');
      check('留言页含友链卡片', guestbook.text.includes('赛博邻居') && guestbook.text.includes('友链自留地'));
    }

    console.log('\n[2/6] 留言：公开 / 悄悄话 / 限流');
    {
      const initial = await request(base, '/api/guestbook');
      check('初始留言为空', initial.json?.ok === true && initial.json.total === 0);

      const publicPost = await request(base, '/api/guestbook', {
        method: 'POST',
        headers: ipA,
        body: {
          name: '冒烟测试',
          station: 'CI / 测试单曲',
          tag: '网文同好',
          message: '这是一条公开的冒烟测试留言。',
          private: false,
        },
      });
      check('公开留言提交成功', publicPost.status === 200 && publicPost.json?.ok === true);
      check('公开留言立即上墙', publicPost.json?.private === false);

      const afterPublic = await request(base, '/api/guestbook');
      check('公开留言可在回廊看到', afterPublic.json?.total === 1);
      check('公开留言内容正确', afterPublic.json?.messages?.[0]?.message === '这是一条公开的冒烟测试留言。');

      const privatePost = await request(base, '/api/guestbook', {
        method: 'POST',
        headers: ipB,
        body: {
          name: '夜航船',
          station: '测试港',
          tag: '漂流寄语',
          message: '这是一条悄悄话，不应出现在公开页。',
          private: true,
        },
      });
      check('悄悄话提交成功', privatePost.status === 200 && privatePost.json?.ok === true);
      check('悄悄话标记为私密', privatePost.json?.private === true);

      const afterPrivate = await request(base, '/api/guestbook');
      check('悄悄话不出现在公开页', afterPrivate.json?.total === 1);

      const limited = await request(base, '/api/guestbook', {
        method: 'POST',
        headers: ipA,
        body: { name: '冒烟测试', message: '再来一条，应被限流。' },
      });
      check('同 IP 60 秒内再次提交被限流', limited.status === 429, `实际 ${limited.status}`);

      const missing = await request(base, '/api/guestbook', {
        method: 'POST',
        headers: ipC,
        body: { name: '', message: '' },
      });
      check('缺少昵称/正文返回 422', missing.status === 422, `实际 ${missing.status}`);
    }

    console.log('\n[3/6] 统计与管理端');
    {
      const stats = await request(base, '/api/stats');
      const letters = stats.json?.letters ?? {};
      check(
        '统计数字正确（总计 2 / 待审核 1 / 公开 1）',
        letters.total === 2 && letters.pending === 1 && letters.publicTotal === 1,
        JSON.stringify(letters),
      );

      const noToken = await request(base, '/api/admin/letters');
      check('无 Token 访问管理接口 → 401', noToken.status === 401, `实际 ${noToken.status}`);

      const kugouNoToken = await request(base, '/api/admin/kugou/status');
      check('酷狗后台无 Token → 401', kugouNoToken.status === 401, `实际 ${kugouNoToken.status}`);

      const wrongToken = await request(base, '/api/admin/letters', {
        headers: { authorization: 'Bearer wrong-token' },
      });
      check('错误 Token → 401', wrongToken.status === 401, `实际 ${wrongToken.status}`);

      const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };
      const adminList = await request(base, '/api/admin/letters?status=all', { headers: auth });
      check('管理端可读取全部留言', adminList.json?.letters?.length === 2);
      const privateLetter = adminList.json?.letters?.find((letter) => letter.is_private === 1);
      const publicLetter = adminList.json?.letters?.find((letter) => letter.is_private === 0);
      check('管理端能看到悄悄话', Boolean(privateLetter));
      check('列表不泄露 ip_hash', !('ip_hash' in (adminList.json?.letters?.[0] ?? {})));

      if (privateLetter) {
        const approved = await request(base, `/api/admin/letters/${privateLetter.id}`, {
          method: 'PATCH',
          headers: auth,
          body: { status: 'approved', reply: '谢谢你的悄悄话。' },
        });
        check('可审核悄悄话', approved.status === 200 && approved.json?.ok === true);
        const publicAfterApprove = await request(base, '/api/guestbook');
        check('悄悄话通过后仍不公开', publicAfterApprove.json?.total === 1, `实际 ${publicAfterApprove.json?.total}`);
      }

      if (publicLetter) {
        const replied = await request(base, `/api/admin/letters/${publicLetter.id}`, {
          method: 'PATCH',
          headers: auth,
          body: { reply: '收到，谢谢你点亮这间书房。' },
        });
        check('可回复公开留言', replied.status === 200 && replied.json?.letter?.reply?.length > 0);
        const publicAfterReply = await request(base, '/api/guestbook');
        check('公开留言显示房主回复', publicAfterReply.json?.messages?.[0]?.reply === '收到，谢谢你点亮这间书房。');
      }

      const invalidStatus = await request(base, `/api/admin/letters/${publicLetter?.id}`, {
        method: 'PATCH',
        headers: auth,
        body: { status: 'published' },
      });
      check('非法审核状态 → 400', invalidStatus.status === 400, `实际 ${invalidStatus.status}`);

      const notFound = await request(base, '/api/admin/letters/not-a-real-id', {
        method: 'PATCH',
        headers: auth,
        body: { status: 'approved' },
      });
      check('不存在的留言 → 404', notFound.status === 404, `实际 ${notFound.status}`);
    }

    console.log('\n[4/6] 登录 Cookie、内容 CRUD 与上传');
    {
      const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };

      const badLogin = await request(base, '/api/admin/login', {
        method: 'POST',
        body: { username: ADMIN_USER, password: 'wrong-password' },
      });
      check('错误密码登录 → 401', badLogin.status === 401, `实际 ${badLogin.status}`);

      const login = await request(base, '/api/admin/login', {
        method: 'POST',
        body: { username: ADMIN_USER, password: ADMIN_PASSWORD },
      });
      check('正确凭据登录成功', login.status === 200 && login.json?.ok === true);
      const cookie = sessionCookie(login);
      check('登录返回 HttpOnly 会话 cookie', cookie.startsWith('fengyu_admin='), cookie);

      const session = await request(base, '/api/admin/session', { headers: { cookie } });
      check('cookie 会话可读取当前用户', session.status === 200 && session.json?.user === ADMIN_USER);

      const created = await request(base, '/api/admin/content/essays', {
        method: 'POST',
        headers: { ...auth, cookie },
        body: {
          slug: 'smoke-essay',
          title: '冒烟随笔',
          date: '2025-10-01',
          category: '测试',
          kind: 'essay',
          readMinutes: '1',
          tags: '测试, 冒烟',
          quote: '',
          summary: '这是一条冒烟测试内容。',
          body: '<p>冒烟正文</p>',
          sortOrder: 0,
        },
      });
      check('内容创建 → 201', created.status === 201 && created.json?.ok === true, `实际 ${created.status}`);
      const recordId = created.json?.record?.id;
      check('内容创建返回 id', typeof recordId === 'string' && recordId.length > 0);

      const listed = await request(base, '/api/admin/content/essays', { headers: { ...auth, cookie } });
      check(
        '内容列表包含新建记录',
        listed.status === 200 && listed.json?.records?.some((record) => record.id === recordId),
      );

      const patched = await request(base, `/api/admin/content/essays/${recordId}`, {
        method: 'PATCH',
        headers: { ...auth, cookie },
        body: {
          slug: 'smoke-essay',
          title: '冒烟随笔（已更新）',
          date: '2025-10-01',
          category: '测试',
          kind: 'essay',
          readMinutes: '1',
          tags: '测试, 冒烟',
          quote: '',
          summary: '这是一条冒烟测试内容。',
          body: '<p>冒烟正文</p>',
          sortOrder: 0,
        },
      });
      check('内容更新成功', patched.status === 200 && patched.json?.record?.title === '冒烟随笔（已更新）');

      const search = await request(base, '/api/content/search');
      check(
        '公开搜索能读到新内容',
        search.json?.entries?.some((entry) => entry.title === '冒烟随笔（已更新）'),
      );

      const photo = await request(base, '/api/admin/photos', {
        method: 'POST',
        headers: { ...auth, cookie },
        body: {
          slug: 'smoke-photo',
          title: '冒烟照片',
          src: '/images/photos/smoke.jpg',
          alt: '冒烟测试图',
          width: 1,
          height: 1,
          series: 'reality',
          takenAt: '2025-10-01',
          note: '',
          badge: '',
          exif: {},
          sortOrder: 0,
        },
      });
      check('照片创建 → 201', photo.status === 201 && photo.json?.ok === true, `实际 ${photo.status}`);

      const tinyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
        'base64',
      );
      const form = new FormData();
      form.append('file', new Blob([tinyPng], { type: 'image/png' }), 'pixel.png');
      const uploadResponse = await fetch(`${base}/api/admin/upload`, {
        method: 'POST',
        headers: { ...auth, cookie },
        body: form,
      });
      const upload = await uploadResponse.json();
      check('图片上传 → 201', uploadResponse.status === 201 && upload.ok === true, `实际 ${uploadResponse.status}`);
      check('上传返回媒体 URL', typeof upload.url === 'string' && upload.url.startsWith('/api/media/photos/'));

      const media = await fetch(`${base}${upload.url}`);
      check('上传后的媒体可访问', media.status === 200, `实际 ${media.status}`);
      check('媒体 Content-Type 正确', media.headers.get('content-type') === 'image/png');

      const traversal = await request(base, '/api/media/photos/%2e%2e%2Fpackage.json');
      check('媒体路径穿越被拒绝', traversal.status === 404, `实际 ${traversal.status}`);

      const deletedPhoto = await request(base, `/api/admin/photos/${photo.json?.photo?.id}`, {
        method: 'DELETE',
        headers: { ...auth, cookie },
      });
      check('照片删除成功', deletedPhoto.status === 200 && deletedPhoto.json?.ok === true);

      const deleted = await request(base, `/api/admin/content/essays/${recordId}`, {
        method: 'DELETE',
        headers: { ...auth, cookie },
      });
      check('内容删除成功', deleted.status === 200 && deleted.json?.ok === true);

      const logout = await request(base, '/api/admin/logout', { method: 'POST', headers: { cookie } });
      check('退出登录清空 cookie', logout.status === 200 && /Max-Age=0/.test(logout.headers.get('set-cookie') ?? ''));
    }

    console.log('\n[5/6] 季刊订阅与导出');
    {
      const first = await request(base, '/api/subscribe', {
        method: 'POST',
        headers: ipC,
        body: { email: 'smoke@example.com' },
      });
      check('订阅成功', first.status === 200 && first.json?.ok === true && first.json?.already === false);

      const second = await request(base, '/api/subscribe', {
        method: 'POST',
        headers: ipC,
        body: { email: 'SMOKE@example.com' },
      });
      check('重复订阅幂等', second.json?.ok === true && second.json?.already === true);

      const invalid = await request(base, '/api/subscribe', {
        method: 'POST',
        headers: ipC,
        body: { email: 'not-an-email' },
      });
      check('非法邮箱 → 422', invalid.status === 422, `实际 ${invalid.status}`);

      const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };
      const subscribersCsv = await request(base, '/api/admin/export?kind=subscribers&format=csv', { headers: auth });
      check(
        '订阅 CSV 导出成功',
        subscribersCsv.status === 200 &&
          subscribersCsv.headers.get('content-disposition')?.includes('attachment') === true &&
          subscribersCsv.text.includes('smoke@example.com'),
      );

      const lettersJson = await request(base, '/api/admin/export?kind=letters&format=json', {
        headers: auth,
      });
      let exported = null;
      try {
        exported = JSON.parse(lettersJson.text);
      } catch {
        exported = null;
      }
      check('留言 JSON 导出成功且含 2 条', lettersJson.status === 200 && exported?.count === 2);

      const invalidKind = await request(base, '/api/admin/export?kind=nope', { headers: auth });
      check('非法导出类型 → 400', invalidKind.status === 400, `实际 ${invalidKind.status}`);
    }

    console.log('\n[6/6] 酷狗歌单接口');
    {
      const kugouEnabled = Boolean(process.env.KUGOU_TOKEN && process.env.KUGOU_USERID);
      const playlists = await request(base, '/api/kugou/playlists');

      if (kugouEnabled) {
        check(
          '登录态存在时只返回 maotouying 歌单',
          playlists.status === 200 &&
            playlists.json?.ok === true &&
            playlists.json.playlists.length === 1 &&
            playlists.json.playlists[0].slug === 'maotouying',
        );
        const detail = await request(base, '/api/kugou/playlist?slug=maotouying&page=1');
        check(
          '歌单详情可用（允许空歌单）',
          detail.status === 200 &&
            detail.json?.ok === true &&
            detail.json.playlist.slug === 'maotouying' &&
            Array.isArray(detail.json.tracks),
        );
      } else {
        check(
          '无登录态时歌单接口返回 503',
          playlists.status === 503 && playlists.json?.error === 'kugou_disabled',
          `实际 ${playlists.status} ${playlists.json?.error ?? ''}`,
        );
      }

      const wrongSlug = await request(base, '/api/kugou/playlist?slug=p1');
      check('旧歌单 slug 返回 404', wrongSlug.status === 404, `实际 ${wrongSlug.status}`);
    }
  }
} catch (error) {
  failures.push({
    name: '未捕获异常',
    detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  console.error(error);
} finally {
  cleanup();
}

console.log(`\n冒烟测试：${passed} 项通过，${failures.length} 项失败`);
if (failures.length > 0) {
  console.error('\n失败明细：');
  for (const failure of failures) console.error(` - ${failure.name}${failure.detail ? `：${failure.detail}` : ''}`);
  if (logs.length > 0) {
    console.error('\n服务端日志（末尾 40 行）：');
    console.error(logs.join('').split('\n').slice(-40).join('\n'));
  }
  process.exitCode = 1;
}
