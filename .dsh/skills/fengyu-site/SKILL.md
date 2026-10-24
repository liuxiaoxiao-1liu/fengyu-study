---
name: fengyu-site
description: 风屿书房站点（Astro 静态 + Node API + SQLite + Docker）的开发、构建、部署与运维速查。改页面、改数据、加 API、发版、备份、排障时使用。
---

# 风屿书房站点

个人内容站，线上 <http://example.com/>。本技能只写“怎么操作”，规范和决策以仓库 `docs/` 为准。

## 0. 前置

| 依赖 | 用途 | 检查 |
| --- | --- | --- |
| Node ≥ 26 | Astro 7 + `node:sqlite` | `node -v` |
| Docker + Compose v2 | 服务器运行时 | `docker compose version` |
| rsync + ssh 私钥 | 部署 | `~/.ssh/id_ed25519` |
| 服务器 | `root@example.com`，部署目录 `/opt/fengyu` | `ssh -F /dev/null root@example.com` |

- 本机 `/etc/ssh/ssh_config.d/` 权限损坏，**所有 ssh/scp/rsync 都要带 `-F /dev/null`**，否则报 `Bad owner or permissions`。
- 本机 `$HOME` 只读，npm/Astro 缓存已重定向到项目内 `.npm-cache/`、`.config/`（不要清）；`npm run build/check` 已内置 `ASTRO_TELEMETRY_DISABLED=1`。
- 发布前跑 `npm run verify`（Prettier + `astro check` + 构建 + 接口冒烟），它是本地 CI 的总入口。

## 1. 架构

```text
浏览器 → nginx 容器 :80 → dist/client 静态页
                       └─ /api/* → app 容器 :4321（Astro Node）
                                     └─ /data/guestbook.sqlite（卷 fengyu_guestbook-data）
```

- 页面混合渲染：首页、随记、读听、影集、留言、RSS、sitemap 由 app 在请求时读内容库；其余页面仍预渲染。`src/pages/api/**` 均设 `prerender = false`。
- 数据库用 Node 26 内置 `node:sqlite`，WAL 模式，禁止引入 sqlite3 命令行/ORM。
- 服务器只放构建产物，不放源码和 `.git`。

## 2. 本地开发

```bash
npm install
npm run dev        # http://localhost:4321，含 API
npm run build      # dist/client + dist/server
npm run preview
npm run check      # astro check
npm run format     # Prettier 写入；format:check 只检查
npm run smoke      # 构建产物 + 临时 SQLite 的接口冒烟
npm run verify     # format:check + check + build + smoke
```

- 本地库默认 `.data/guestbook.sqlite`；`GUESTBOOK_DB=/tmp/x.sqlite` 可隔离测试；冒烟测试用临时库，不碰本地数据。
- 后台本地调试：先 `set -a; . ./.env; set +a` 再 `npm run dev`；`/admin/` 用 `ADMIN_USER` + 密码登录（内容后台），`/admin/letters/` 仍用 `ADMIN_TOKEN`。
- 并发构建用 `flock /tmp/fengyu-build.lock npm run build`，避免两个进程抢 `.astro/`。
- 改接口后同步更新 `scripts/smoke-test.mjs`；`astro check` 已排除 `vendor/`，不要把它加回 `tsconfig.json` 的检查范围。

## 3. 内容改动

| 改什么 | 文件 |
| --- | --- |
| 随记正文、标题、引用 | `src/data/essays.ts` |
| 书 / 歌 / 照片 / 台词 | `src/data/{books,music,photos,quotes}.ts` |
| 站内搜索 | `/api/content/search` 请求时从内容库生成；`src/data/search.ts` 仅作首屏/断网 fallback |
| 站点名、导航、简介 | `src/lib/site.ts` |
| 图片 | `public/images/`（封面 `covers/`、照片 `photos/`） |

- 用户输入只走 `textContent`/Astro 转义，禁止拼 `innerHTML`。
- 文案用中文，代码标识符用英文；图片必须有 `alt`、宽高。

## 4. 后台与数据

- 内容后台 `/admin/`：用户名 + 密码登录（`ADMIN_USER` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` 只放 `.env`）；顶部导航管理影集/随笔/书架/唱片/曲目/台词/友链。内容写入 `CONTENT_DB`（容器 `/data/content.sqlite`），图片写入 `CONTENT_UPLOADS`（容器 `/data/uploads`）。
- 留言后台 `/admin/letters/`：仍用 `ADMIN_TOKEN`；接口 `GET /api/admin/letters`、`PATCH /api/admin/letters/:id`、`GET /api/admin/export?...`。
- 内容接口：`GET /api/admin/schema`、`GET/POST /api/admin/content/:type`、`PATCH/DELETE /api/admin/content/:type/:id`、`GET/POST /api/admin/photos`、`PATCH/DELETE /api/admin/photos/:id`、`POST /api/admin/upload`；登录态是 HttpOnly cookie。
- `/`、`/essays/`、`/reading/`、`/photos/`、`/guestbook/`、`/rss.xml`、`/sitemap.xml` 由 app 请求时读取内容库；nginx 必须保留这些反代，删掉会让页面 404。
- 公开接口：`GET/POST /api/guestbook`、`GET /api/content/search`、`GET /api/stats`、`POST /api/subscribe`。
- 悄悄话入库即 `pending`，公开留言直接 `approved`；`hidden` 仅后台可见。
- 悄悄话即使点了“通过”也不会出现在公开留言页（公开查询过滤 `is_private=1`），这是当前设计。

## 5. 部署

```bash
npm run deploy:docker              # 先发 8080 验证
WEB_PORT=80 npm run deploy:docker  # 确认后切 80
```

- 脚本会构建、rsync `dist/`+配置+运维脚本、装 `/etc/cron.d/fengyu` 与 logrotate、重建容器、探活。
- 首次或换机器：在服务器建 `/opt/fengyu/.env`，写 `ADMIN_TOKEN=<长随机串>`，再 `up -d`。
- 回滚：`cd /opt/fengyu && docker compose down && systemctl enable --now nginx`（旧 PHP 站仍在 `/var/www/xiaoquanzi`）。
- 宿主 nginx 已停用；443 是 xray，不要动；8443 已关闭（留给以后 xray 回落）。

## 6. 运维

| 任务 | 位置 |
| --- | --- |
| 每日备份（04:17，保留 7 天） | `/opt/fengyu/scripts/backup-guestbook.sh` → `/opt/fengyu/backups/` |
| 本地探活（每 5 分钟） | `/opt/fengyu/scripts/healthcheck.sh` → `/var/log/fengyu-health.log` |
| 定时任务 | `/etc/cron.d/fengyu`（仓库源：`deploy/server/fengyu-cron`） |
| 日志轮转 | `/etc/logrotate.d/fengyu` |

- 外部探活建议用 UptimeRobot 免费监控 `http://example.com/api/guestbook`，关键字 `"ok":true`；本机探活只能发现应用故障，发现不了整机宕机。
- 备份在同盘，**至少每月拉一份到本地或对象存储**才算异地备份。
- 恢复演练：`python3 -c "import sqlite3;..."` 校验 `PRAGMA integrity_check` 后再替换卷。

## 7. 常见故障

| 现象 | 原因 | 处置 |
| --- | --- | --- |
| ssh 报 `Bad owner or permissions` | `/etc/ssh/ssh_config.d` 权限坏了 | 命令加 `-F /dev/null` |
| `/admin/` 返回 503 | 容器没拿到 `ADMIN_TOKEN` | 查 `/opt/fengyu/.env`，`docker compose up -d` 重建 |
| 新 API 404 | nginx 只反代了 `/api/guestbook` | 确认 `deploy/nginx.container.conf` 有 `location /api/`，重建 web 容器 |
| 改页面不生效 | 只改了服务器 dist | 本地构建后重新 `npm run deploy:docker` |
| 构建报 `.astro` 冲突 | 多进程同时构建 | `flock /tmp/fengyu-build.lock` 串行 |
| 构建报 `mkdir ~/.config/astro` | 本机 `$HOME` 只读、遥测写配置失败 | 命令前加 `ASTRO_TELEMETRY_DISABLED=1`（npm script 已内置） |
| `astro check` 报一堆 vendor 错误 | `tsconfig` 没排除 `vendor/` | 保留现有 `exclude`，vendor 是第三方 CommonJS |
| `npm run format:check` 报大量文件 | 新文件未格式化 | `npm run format` 后单独提交 `style:` |
| 备份体积为 0 | app 容器没跑 | `docker compose ps`；脚本会报错退出 |
| 留言 429 | 每 IP 60 秒 + nginx 60r/m | 等一分钟，别调高限流 |

## 8. 酷狗站内播放

- 登录态只放服务器 `/opt/fengyu/.env`：`KUGOU_TOKEN`、`KUGOU_USERID`、`KUGOU_VIP_TOKEN`、`KUGOU_VIP_TYPE`、`KUGOU_MID`、`KUGOU_GUID`、可选 `KUGOU_DFID`；**永不进仓库、不贴聊天**。
- 解析链路：`/register/dev` 换 `dfid` → `/song/url` 换 CDN 直链 → 浏览器 `<audio>` 播放。缺 `dfid` 时酷狗会返回 `20018`。
- 歌单同步：站内只展示账号歌单 `maotouying`（`KUGOU_PLAYLIST_NAME` 可覆盖）。`/api/kugou/playlist` 运行时向酷狗拉取，内存缓存 60 秒；酷狗上增删歌曲约 1 分钟自动反映，不需要重新构建。
- 接口：`GET /api/kugou/playlists`（只剩一个歌单）、`GET /api/kugou/playlist?slug=maotouying&page=1`、`GET /api/kugou/url?hash=...`；只认当前歌单缓存里的 hash。
- 运行时来源 `vendor/kugou/`（MIT，从 Folia 内置 KuGouMusicApi 抽取）；不要在页面里 import 它。
- 登录态过期：管理不了，只能重新扫码（KuGouMusicApi 的 `login_qr_key` + `login_qr_check`），更新 `.env` 后重建 app。
- 以后上 HTTPS：直链是 `http://`，会被混合内容拦截，需要同源代理或改 https 源；当前站点 HTTP，无此问题。

## 相关文件

- `docs/FEATURES.md` — 功能契约、接口表与验收清单
- `docs/DECISIONS.md` — ADR（架构决策）
- `docs/PROJECT_RULES.md` — 代码/内容/部署规范（v0.2）
- `scripts/smoke-test.mjs`、`.github/workflows/ci.yml` — 自动化校验
- `deploy/docker-deploy.sh`、`deploy/nginx.container.conf`、`docker-compose.yml`
