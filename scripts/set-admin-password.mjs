#!/usr/bin/env node
/**
 * 生成内容后台登录凭据并写入本地 .env：
 *   node scripts/set-admin-password.mjs '<new-password>' [username]
 *
 * 只写 ADMIN_USER / ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET，不打印密码或哈希。
 * 服务器上需要把这三项同步到 /opt/fengyu/.env（部署脚本不覆盖 .env）。
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const password = process.argv[2];
const username = process.argv[3] ?? process.env.ADMIN_USER ?? 'maotouying';

if (!password || password.length < 8) {
  console.error('用法：node scripts/set-admin-password.mjs <至少 8 位的密码> [用户名]');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
const passwordHash = `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
const sessionSecret = randomBytes(32).toString('hex');

const envPath = '.env';
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const kept = existing
  .split('\n')
  .filter((line) => !/^(ADMIN_USER|ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET)=/.test(line))
  .join('\n')
  .replace(/\n+$/, '');
const next = `${kept}\nADMIN_USER=${username}\nADMIN_PASSWORD_HASH=${passwordHash}\nADMIN_SESSION_SECRET=${sessionSecret}\n`;
writeFileSync(envPath, next, { mode: 0o600 });
console.log(`已更新 ${envPath}：ADMIN_USER=${username}（哈希与会话密钥未打印）`);
