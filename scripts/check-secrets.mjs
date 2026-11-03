#!/usr/bin/env node
/**
 * 开源前的泄漏扫描：检查被 Git 跟踪的文件里有没有真实凭据。
 * 只读取 git ls-files 的文本文件，不访问网络。
 *
 *   npm run check:secrets
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TEXT_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.astro',
  '.mjs',
  '.js',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.yml',
  '.yaml',
  '.sh',
  '.css',
  '.html',
  '.txt',
  '.example',
  '.gitignore',
];

const SKIP_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

const CHECKS = [
  { name: 'ADMIN_TOKEN 旧令牌', pattern: /^ADMIN_TOKEN=(?!\s*$)(\S{8,})/m },
  { name: 'KUGOU_TOKEN', pattern: /^KUGOU_TOKEN=(?!\s*$)(\S{8,})/m },
  { name: 'KUGOU_VIP_TOKEN', pattern: /^KUGOU_VIP_TOKEN=(?!\s*$)(\S{8,})/m },
  { name: 'KUGOU_USERID', pattern: /^KUGOU_USERID=(?!\s*$)(\d{4,})/m },
  { name: 'KUGOU_MID / GUID', pattern: /^KUGOU_(?:MID|GUID)=(?!\s*$)(\S{8,})/m },
  { name: 'scrypt 密码哈希', pattern: /scrypt:[0-9a-f]{32}:[0-9a-f]{64}/ },
  { name: 'ADMIN_SESSION_SECRET', pattern: /^ADMIN_SESSION_SECRET=(?!\s*$)(\S{16,})/m },
];

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

function isTextFile(path) {
  if (SKIP_FILES.has(path)) return false;
  return TEXT_EXTENSIONS.some((extension) => path.endsWith(extension)) || path === '.env.example';
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

let trackedEnv = [];
try {
  trackedEnv = execFileSync('git', ['ls-files', '.env'], { encoding: 'utf8' }).trim();
} catch {
  trackedEnv = '';
}

const findings = [];

for (const path of trackedFiles()) {
  if (!isTextFile(path)) continue;
  let content = '';
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  for (const check of CHECKS) {
    const match = check.pattern.exec(content);
    if (!match) continue;
    findings.push({
      path,
      line: lineOf(content, match.index),
      name: check.name,
    });
  }
}

if (trackedEnv) findings.push({ path: '.env', line: 0, name: '.env 被 Git 跟踪' });

if (findings.length === 0) {
  console.log('✓ 没有发现被 Git 跟踪的凭据（.env.example 为空，.env 不在仓库中）。');
  process.exit(0);
}

console.error('✗ 发现可能泄漏的凭据：');
for (const finding of findings) {
  console.error(`  ${finding.path}${finding.line ? `:${finding.line}` : ''} · ${finding.name}`);
}
console.error('\n请移除这些值，并考虑轮换对应账号的 token / 密码。');
process.exit(1);
