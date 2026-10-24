#!/usr/bin/env node
/**
 * 构建产物冒烟测试：拉起 dist/server/entry.mjs，用临时 SQLite 跑一遍关键接口。
 *
 * 覆盖：
 * - 五个栏目 + admin + RSS + sitemap 可访问
 * - 公开留言 / 悄悄话入库与可见性
 * - 每 IP 60 秒限流
 * - 管理端鉴权（401）、列表、审核、回复、404
 * - 季刊订阅幂等 + CSV/JSON 导出
 * - 酷狗歌单只读接口
 *
 * 用法：npm run smoke（需先 npm run build）
 * 退出码 0 表示全部通过；失败时会打印失败项与服务端日志。
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENTRY = join(ROOT, 'dist/server/entry.mjs');
const ADMIN_TOKEN = 'smoke-test-token';
const DB_PATH = join(tmpdir(), `fengyu-smoke-${process.pid}-${Date.now()}.sqlite`);

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
    ADMIN_TOKEN,
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
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(`${DB_PATH}${suffix}`, { force: true });
    } catch {
      // 清理失败不影响主流程
    }
  }
}

try {
  if (!(await waitForServer())) {
    console.error('服务没有在 10 秒内就绪，服务端输出：');
    console.error(logs.join(''));
    process.exitCode = 1;
  } else {
    console.log('\n[1/5] 页面与静态资源');
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

    console.log('\n[2/5] 留言：公开 / 悄悄话 / 限流');
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

    console.log('\n[3/5] 统计与管理端');
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

    console.log('\n[4/5] 季刊订阅与导出');
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

    console.log('\n[5/5] 酷狗歌单只读接口');
    {
      const playlists = await request(base, '/api/kugou/playlists');
      check(
        '歌单列表可用',
        playlists.status === 200 && playlists.json?.ok === true && playlists.json.playlists.length > 0,
      );
      const firstSlug = playlists.json?.playlists?.[0]?.slug;
      if (firstSlug) {
        const detail = await request(base, `/api/kugou/playlist?slug=${firstSlug}&page=1`);
        check(
          '歌单详情可用',
          detail.status === 200 && Array.isArray(detail.json?.tracks) && detail.json.tracks.length > 0,
        );
      }
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
