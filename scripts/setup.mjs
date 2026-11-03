#!/usr/bin/env node
/**
 * 开源版首次配置：生成管理员账号、密码哈希与会话密钥，写入本地 .env。
 *
 *   npm run setup
 *
 * 也可以非交互运行（适合 Docker/CI）：
 *   ADMIN_USER=admin ADMIN_PASSWORD='至少 8 位' npm run setup
 *
 * 只写 ADMIN_USER / ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET；
 * 密码本身和哈希都不会打印，.env 已在 .gitignore 中。
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ENV_PATH = '.env';
const MIN_LENGTH = 8;

function readEnv() {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
}

function upsertEnv(existing, values) {
  const kept = existing
    .split('\n')
    .filter((line) => !/^(ADMIN_USER|ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET)=/.test(line))
    .join('\n')
    .replace(/\n+$/, '');
  const block = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  return `${kept ? `${kept}\n` : ''}${block}\n`;
}

function buildHash(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** 终端里逐行读取；hidden 时回显 *，非 TTY 直接拒绝。 */
function askLine(query, { hidden = false } = {}) {
  if (!process.stdin.isTTY) {
    return Promise.reject(new Error('当前环境不支持交互输入，请用 ADMIN_USER / ADMIN_PASSWORD 环境变量运行。'));
  }
  process.stdout.write(query);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise((resolve) => {
    let value = '';
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n已取消。\n');
          process.exit(130);
        }
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (char < ' ') continue;
        value += char;
        process.stdout.write(hidden ? '*' : char);
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const existing = readEnv();
  const hasCreds = /^ADMIN_PASSWORD_HASH=scrypt:/m.test(existing);

  const envPassword = process.env.ADMIN_PASSWORD;
  let username = (process.env.ADMIN_USER || '').trim();
  let password = envPassword || '';

  if (!password) {
    if (hasCreds) {
      const answer = (await askLine('检测到已有管理员凭据，重新设置会覆盖它。继续？[y/N] ')).trim().toLowerCase();
      if (answer !== 'y' && answer !== 'yes') {
        console.log('已取消，.env 没有改动。');
        return;
      }
    }
    username = username || (await askLine('管理员用户名 [admin]：')).trim() || 'admin';
    password = await askLine(`设置管理员密码（至少 ${MIN_LENGTH} 位）：`, { hidden: true });
    const confirm = await askLine('再输入一次：', { hidden: true });
    if (password !== confirm) {
      console.error('两次输入不一致，没有写入任何内容。');
      process.exitCode = 1;
      return;
    }
  } else {
    username = username || 'admin';
  }

  if (!password || password.length < MIN_LENGTH) {
    console.error(`密码至少 ${MIN_LENGTH} 位，没有写入任何内容。`);
    process.exitCode = 1;
    return;
  }

  const values = {
    ADMIN_USER: username,
    ADMIN_PASSWORD_HASH: buildHash(password),
    ADMIN_SESSION_SECRET: randomBytes(32).toString('hex'),
  };
  writeFileSync(ENV_PATH, upsertEnv(existing, values), { mode: 0o600 });

  console.log(`\n已写入 ${ENV_PATH}：`);
  console.log(`  管理员用户名：${username}`);
  console.log('  密码哈希与会话密钥：已生成（不打印）');
  console.log('\n下一步：');
  console.log('  npm run dev      # 打开 http://localhost:4321/');
  console.log('  npm run build    # 生产构建');
  console.log('\n说明：');
  console.log('  · 酷狗音乐是可选项，不配置也能正常浏览站点；');
  console.log('  · 登录后台 /admin/ 后，在「酷狗」标签扫码登录并选择歌单；');
  console.log('  · 服务器上的 .env 不会被部署脚本覆盖，需要单独配置一次。');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
