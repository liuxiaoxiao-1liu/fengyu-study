// 四档尺寸的轻量视觉回归：检查横向溢出、过小触控目标，并保存截图。
// 用法：先启动站点（npm run dev 或 npm run preview），再运行 npm run visual。
// 可选：VISUAL_BASE=https://example.com CHROME_BIN=/path/to/chrome npm run visual
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.VISUAL_BASE ?? 'http://localhost:4321';
const WIDTHS = [390, 768, 1024, 1440];
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'essays', path: '/essays/' },
  { name: 'essay-detail', path: '/essays/lord-of-mysteries/' },
  { name: 'reading', path: '/reading/' },
  { name: 'photos', path: '/photos/' },
  { name: 'guestbook', path: '/guestbook/' },
  { name: 'admin', path: '/admin/' },
];
const SCREENSHOT_DIR = join(process.cwd(), '.screenshots', 'check');

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const root = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium_headless_shell')) continue;
    const candidate = join(root, entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const chrome = findChrome();
if (!chrome) {
  console.error('找不到 chrome-headless-shell；设置 CHROME_BIN 后重试。');
  process.exit(1);
}

mkdirSync(SCREENSHOT_DIR, { recursive: true });
const userDataDir = join(tmpdir(), `fengyu-visual-${process.pid}`);
const port = 9300 + (process.pid % 500);
const child = spawn(
  chrome,
  [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDevtools() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // 还没起来
    }
    await sleep(150);
  }
  throw new Error(`DevTools 没有在 ${port} 端口启动`);
}

async function newTarget() {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`创建页面失败: ${response.status}`);
  return response.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket));
    socket.addEventListener('error', (event) => reject(new Error(`WebSocket 失败: ${event.message ?? ''}`)));
  });
}

function makeClient(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  return {
    send(method, params = {}) {
      const id = (nextId += 1);
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
  };
}

const CHECK_SCRIPT = `(() => {
  const width = window.innerWidth;
  const offenders = [];
  const overflowAncestors = (node) => {
    for (let el = node.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'hidden' || style.overflowX === 'clip') return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.right > width + 1 && !overflowAncestors(el)) {
      offenders.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 90), right: Math.round(rect.right) });
      if (offenders.length >= 8) break;
    }
  }
  const widest = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.position === 'fixed') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) widest.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), right: Math.round(rect.right) });
  }
  widest.sort((a, b) => b.right - a.right);
  const smallTargets = [];
  if (width <= 768) {
    for (const el of document.querySelectorAll('button, input, select, textarea, a.btn-primary, a.btn-secondary, a.btn-ghost, a.btn-icon, [role="button"]')) {
      if (!(el instanceof HTMLElement)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) continue;
      if (rect.width < 44 || rect.height < 44) {
        smallTargets.push({ tag: el.tagName.toLowerCase(), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), w: Math.round(rect.width), h: Math.round(rect.height) });
        if (smallTargets.length >= 10) break;
      }
    }
  }
  return {
    width,
    scrollWidth: document.documentElement.scrollWidth,
    offenders,
    smallTargets,
    fonts: document.fonts.status,
    title: document.title,
    debug: {
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      visualViewport: window.visualViewport ? Math.round(window.visualViewport.width) : null,
    },
    widest: widest.slice(0, 5),
  };
})()`;

const results = [];
await waitForDevtools();

try {
  for (const page of PAGES) {
    for (const width of WIDTHS) {
      const target = await newTarget();
      const socket = await connect(target.webSocketDebuggerUrl);
      const client = makeClient(socket);
      try {
        await client.send('Page.enable');
        await client.send('Runtime.enable');
        await client.send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        });
        const targetUrl = `${BASE}${page.path}`;
        const nav = await client.send('Page.navigate', { url: targetUrl });
        if (nav.errorText) throw new Error(`导航失败: ${nav.errorText}`);
        let ready = false;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const state = await client.send('Runtime.evaluate', {
            expression: '({ href: location.href, ready: document.readyState })',
            returnByValue: true,
          });
          const value = state.result?.value;
          if (value?.href?.startsWith(BASE) && value.ready === 'complete') {
            ready = true;
            break;
          }
          await sleep(100);
        }
        if (!ready) throw new Error(`页面没有加载完成: ${targetUrl}`);
        await sleep(900);
        const evaluated = await client.send('Runtime.evaluate', {
          expression: CHECK_SCRIPT,
          returnByValue: true,
          awaitPromise: true,
        });
        const data = evaluated.result?.value ?? {};
        const horizontal = Math.max(0, (data.scrollWidth ?? width) - width);
        const pass = horizontal <= 1 && (data.offenders ?? []).length === 0;
        results.push({
          page: page.name,
          width,
          pass,
          horizontal,
          offenders: data.offenders ?? [],
          smallTargets: data.smallTargets ?? [],
          debug: data.debug,
          widest: data.widest ?? [],
        });

        await sleep(300);
        const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        const { writeFileSync } = await import('node:fs');
        writeFileSync(join(SCREENSHOT_DIR, `${page.name}-${width}.png`), Buffer.from(shot.data, 'base64'));
      } finally {
        socket.close();
        await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
      }
    }
    console.log(`✓ ${page.name}`);
  }
} finally {
  child.kill('SIGTERM');
}

let failed = 0;
for (const result of results) {
  if (result.pass) continue;
  failed += 1;
  console.log(`\n✗ ${result.page} @ ${result.width}px  横向溢出 ${result.horizontal}px`, result.debug ?? '');
  for (const item of result.offenders.slice(0, 5)) {
    console.log(`   ${item.tag}.${item.cls} → right ${item.right}px`);
  }
  for (const item of (result.widest ?? []).slice(0, 3)) {
    console.log(`   最宽: ${item.tag}.${item.cls} → right ${item.right}px`);
  }
}

const small = results.flatMap((result) =>
  result.smallTargets.map((target) => ({ page: result.page, width: result.width, ...target })),
);
const uniqueSmall = [...new Map(small.map((item) => [`${item.page}|${item.tag}|${item.label}`, item])).values()];
if (uniqueSmall.length) {
  console.log('\n触控目标 < 44px（仅提示，不阻断）：');
  for (const item of uniqueSmall.slice(0, 15)) {
    console.log(`   ${item.page} @ ${item.width}px · ${item.tag} “${item.label}” ${item.w}×${item.h}`);
  }
}

console.log(`\n视觉检查：${results.length} 个页面/尺寸组合，${failed} 个横向溢出。`);
console.log(`截图：${SCREENSHOT_DIR}`);
process.exit(failed ? 1 : 0);
