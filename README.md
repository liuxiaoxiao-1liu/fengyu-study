# 风屿书房 / Island of Solitude

一个大学生收藏网文、酷狗歌单、影像与随笔的数字秘密基地。视觉参考 `stitch_astro_personal_website/` 中的 _Warm Editorial Literary Journal_ 设计稿，用 Astro 重建为可部署的独立站点。

- 页面静态输出（Astro 7）+ Tailwind CSS 3
- 自托管字体与图标（Newsreader / Space Grotesk / Material Symbols），不依赖 Google Fonts
- 首页、读听、影集、随记、留言五个板块
- 随记详情页、站内搜索、分类筛选、打捞漂流瓶、纸感排版
- 读听页的 5 本网文卡片整卡可点，新窗口直达起点中文网对应书目；首页书架的《诡秘之主》封面与“去起点读全书”同样可跳转
- 留言箱：Astro API + SQLite（公开留言直接上墙，悄悄话只存服务器）

线上地址：<http://example.com/>

## 运行架构（2026-10 起）

```text
浏览器
  │
  ▼
nginx（宿主或容器 :80）
  ├─ /            → dist/client 静态 HTML
  └─ /api/guestbook → Node 容器（Astro API :4321）
                          └─ /data/guestbook.sqlite（Docker 卷）
```

- 页面仍是**静态预渲染**，不跑 SSR；
- 只有 `src/pages/api/guestbook.ts` 标了 `prerender = false`，由 `@astrojs/node` 在请求时执行；
- 数据库是 Node 26 内置的 `node:sqlite`，单文件 + WAL；
- 旧 PHP 站点与 `/var/www/xiaoquanzi` 保留，作为回滚路径。
- 决策记录见 [docs/DECISIONS.md](docs/DECISIONS.md)。

## 项目规范

开发、提交和部署前请先读 [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md)。当前为 **v0.2 · 已生效**（2026-10-25 按 Docker + Node + SQLite 架构对齐）；功能契约见 [docs/FEATURES.md](docs/FEATURES.md)。

## 本地开发

```bash
npm install
npm run dev          # http://localhost:4321，含 /api/*
npm run build        # 输出 dist/client 与 dist/server
npm run preview      # 预览构建结果
npm run check        # astro check（TypeScript + Astro）
npm run format       # Prettier 写入；format:check 只检查
npm run smoke        # 拉起构建产物，跑接口冒烟（需先 build）
npm run verify       # 发布总闸门：format:check + check + build + smoke
```

- 需要 Node ≥ 26（Astro 7 + `node:sqlite`）；
- 本地 SQLite 默认写到 `.data/guestbook.sqlite`，可用 `GUESTBOOK_DB` 覆盖；冒烟测试用临时库，不碰本地数据；
- 旧留言 JSON 导入：`npm run guestbook:import -- <json> <sqlite>`；
- 备份：`npm run guestbook:backup -- <sqlite> <backup>`。

这台机器的 `$HOME`、`/etc/ssh` 有部分只读限制，所以脚本会把 npm / Astro 的缓存和配置写进项目内（`.npm-cache/`、`.config/`）。`npm run build` / `check` 已内置 `ASTRO_TELEMETRY_DISABLED=1`；手工执行 Astro 命令时若报 `mkdir ~/.config/astro`，加上这个环境变量即可。普通开发机不需要这些设置。

## 页面与内容

| 路由                                    | 内容                                                                  |
| --------------------------------------- | --------------------------------------------------------------------- |
| `/`                                     | 首页：欢迎语、状态广播、网文/酷狗/影集/随记四宫格、数据存根、留言预览 |
| `/reading/`                             | 读听：追更书架、年度网文、酷狗歌单与听歌月报                          |
| `/photos/`                              | 影集：动漫 / 现实 / 虚拟 CG 图像档案与手记                            |
| `/essays/`                              | 随记：文章列表、书写脉络、即刻手记、主题检索、季刊订阅                |
| `/essays/[slug]/`                       | 随记详情页                                                            |
| `/guestbook/`                           | 留言：投递信笺、房主公告、友链、留言回廊、漂流瓶                      |
| `/rss.xml`、`/sitemap.xml`、`/404.html` | 订阅、站点地图、404                                                   |

内容与页面已经数据驱动，改内容只动 `src/data/`：

- 随记正文与分类：`src/data/essays.ts`（`kind` 区分随笔/碎碎念）
- 书架：`src/data/books.ts`；唱片与曲目：`src/data/music.ts`
- 照片与 EXIF、系列：`src/data/photos.ts`
- 台词摘录：`src/data/quotes.ts`
- 站内搜索：`src/data/search.ts` 构建期自动生成，**不要手写条目**
- 页面只负责循环渲染，改版式再动 `src/pages/*.astro` / `src/components/`
- 首页/栏目图片：`public/images/`；书籍封面与专辑封面：`public/images/covers/`
- 站点名、简介、页脚：`src/lib/site.ts`

字体文件在 `public/fonts/`，CSS 在 `src/styles/fonts.css` 与 `src/styles/icons.css`。

### 自动化校验

- `npm run verify`：Prettier 格式检查 → `astro check` → 构建 → 冒烟测试；
- 冒烟脚本 [scripts/smoke-test.mjs](scripts/smoke-test.mjs) 会拉起构建产物、用临时 SQLite 验证页面、留言/悄悄话、限流、管理端鉴权与审核、订阅与导出、酷狗歌单接口；
- [.github/workflows/ci.yml](.github/workflows/ci.yml) 是 GitHub Actions 模板，接通远程仓库后自动执行同一套检查；
- 当前仓库还没有配置 `origin`，所以 CI 只在本地手动跑（这也是附录 A 的最高优先技术债）。

### 尚未完成（P2/P3）

- 远程仓库与 CI 接通、Playwright 视觉/交互测试、链接检查、图片 WebP/AVIF；
- 真实内容（随笔、书、歌、图）替换示例、友链与社交链接换真实主页；
- `docs/PROJECT_RULES.md` 的遗留债务见附录 A：远程仓库、素材许可证、组件拆分、Content Collections 等；
- 仓库没有本地音频文件；所有播放都走酷狗直链，解析失败时自动降级为酷狗搜索外链。

## 留言 API

- `GET /api/guestbook` 返回公开留言：`{ ok, messages, total }`；
- `POST /api/guestbook` 接收 JSON：

```json
{
  "name": "称呼",
  "station": "城市 / 推荐单曲",
  "tag": "网文同好",
  "message": "信笺正文",
  "private": false,
  "website": ""
}
```

- 公开留言 `status = 'approved'`，写入后立即上墙；`private: true` 存为 `pending`，GET 不返回；
- 蜜罐字段 `website`、长度限制、每 IP 60 秒一次；nginx 再加 6r/m 的粗粒度限制；
- 实现：`src/pages/api/guestbook.ts`，表结构在 `src/lib/guestbook-db.ts`；
- 数据库路径由 `GUESTBOOK_DB` 指定：本地默认 `.data/guestbook.sqlite`，容器里是 `/data/guestbook.sqlite`；
- 旧 JSON 导入：`npm run guestbook:import -- /path/guestbook.json /path/guestbook.sqlite`；
- 备份：`npm run guestbook:backup -- /path/guestbook.sqlite /path/backup.sqlite`。

### 管理后台

- **`/admin/` 内容后台**：用户名 + 密码登录（`ADMIN_USER` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET`，只放服务器 `.env`）；顶部导航切换 **影集 / 随笔 / 书架 / 唱片 / 曲目 / 台词 / 友链**，支持新增、编辑、删除；影集支持上传图片，唱片/曲目封面可填图片地址；
- 内容存在数据卷里的 `content.sqlite`；上传图片在 `/data/uploads`，通过 `/api/media/photos/...` 提供；
- 首页 `/`、影集 `/photos/`、随记 `/essays/`、读听 `/reading/`、留言 `/guestbook/`、`/rss.xml`、`/sitemap.xml` 都在请求时读取内容库；后台改完刷新即可生效，通常不需要构建发版；
- 曲目若填了酷狗 `hash` / `albumId` / `albumAudioId`，会自动进入站内播放白名单；
- `/admin/` 顶部「酷狗」：手机酷狗扫码登录、查看账号全部歌单、切换站内歌单、查看/添加/删除当前歌单曲目；扫码会话保存在 `/data/kugou-session.json`，歌单选择在 `/data/kugou-settings.json`，不把 token 下发浏览器；
- 站内搜索由 `GET /api/content/search` 在请求时生成，后台新增的随笔/书/歌/照片/友链都会自动进入搜索；
- `/admin/letters/`：旧的留言后台（审核悄悄话、通过/隐藏、回复、导出 JSON/CSV），仍用 `ADMIN_TOKEN`；
- 生成登录凭据：`node scripts/set-admin-password.mjs '<新密码>'`（只写本地 `.env`，服务器 `.env` 需同步这三项）；
- 其它接口：`GET /api/stats`（聚合计数）、`POST /api/subscribe`（季刊订阅入库）；
- 管理端走 HTTP 当前没有 TLS，令牌/密码只在本机/可信网络使用，后续上 HTTPS 后再日常使用。

## 酷狗站内播放

- 登录态（`KUGOU_TOKEN` / `KUGOU_USERID` / `KUGOU_VIP_TOKEN` / `KUGOU_VIP_TYPE` / `KUGOU_MID` / `KUGOU_GUID`）只放服务器 `/opt/fengyu/.env`，不进仓库、不下发浏览器；
- 服务端先 `/register/dev` 换 `dfid`，再 `/song/url` 换 CDN 直链，浏览器 `<audio>` 直接播放（服务端不代理音频字节）；
- 站内只展示账号里的 `maotouying` 歌单（可用 `KUGOU_PLAYLIST_NAME` 改名）；`/api/kugou/playlist` 运行时从酷狗拉取并缓存 60 秒，在酷狗上增删歌曲约 1 分钟内自动同步，不需要重新构建或部署；
- `/reading/` 只展示这一个歌单并分页（每页 30 首）；`/api/kugou/url` 只解析当前歌单或首页/专辑精选里出现过的 hash，按 IP 限流（30 次 / 10 分钟）；
- 播放入口统一用 `data-play` 指令：读听歌单行、读听「专辑归档」卡片、首页「酷狗音乐」卡片都会驱动同一个站内播放器；
- 播放器固定在页面底部（`BaseLayout` 单实例），首次点播出现、可收起；多页站整页刷新会停止播放，跨页连续播放留待 View Transitions；
- 浏览器 `<audio>` 负责解码；直链过期或断流时自动重取一次地址并按原进度续播，暂停中拖动进度条会自动恢复播放；
- 登录态过期或酷狗改接口时，`/api/kugou/url` 返回 502，播放器自动降级为酷狗外链；重新扫码登录后更新 `.env` 即可。
- 运行时来源是 `vendor/kugou/`（从 Folia 内置的 KuGouMusicApi 抽取，MIT），只保留 `register_dev` / `song_url` / 歌单读取。

## 运维

- 每日 04:17 自动备份留言库、内容库和上传图片（`VACUUM INTO` / tar，保留 7 天）：`/opt/fengyu/scripts/backup-guestbook.sh` → `/opt/fengyu/backups/`；
- 每 5 分钟本地探活首页与留言 API：`/var/log/fengyu-health.log`；
- 定时任务与日志轮转的仓库源文件在 `deploy/server/`，`npm run deploy:docker` 会幂等安装；
- 外部探活：用 UptimeRobot 等免费服务监控 `http://example.com/api/guestbook`，匹配 `"ok":true`（整机宕机只能靠外部监控发现）；
- 备份与本机同盘，建议每月拉一份到本地/对象存储做异地备份；
- 8081 旧版预览已于 2026-10-24 停止；8443 的 UFW 放行已关闭，留给以后 xray 回落。

## 部署

### Docker 方式（当前方向：Astro API + SQLite）

前置：服务器有 Docker 24+ / Compose v2、rsync、SSH 私钥；本地 Node ≥ 26。

```bash
npm run deploy:docker                 # 默认发到 8080，做验证，不碰宿主 nginx
WEB_PORT=80 npm run deploy:docker     # 确认宿主 nginx 已停，再切到 80
```

脚本会：

1. 本地 `npm run build`，产出 `dist/client` 与 `dist/server`；
2. `rsync` 上传 `dist/`、`docker-compose.yml`、`docker/`、`deploy/nginx.container.conf`；
3. 远程 `docker compose build app && docker compose up -d`；
4. 验证首页与 `/api/guestbook`。

服务组成：

| 服务   | 说明                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| `web`  | `nginx:1.27-alpine`，映射 `${WEB_PORT:-8080}:80`，挂载 `dist/client` 与容器版 nginx 配置 |
| `app`  | `docker/app.runtime.Dockerfile`，Node 26，只跑 `/api/` 与 server bundle                  |
| 数据卷 | `fengyu_guestbook-data` → `/data/guestbook.sqlite`                                       |

首次切换建议：

1. 备份旧站点和 `/var/lib/xiaoquanzi/guestbook.json`；
2. `npm run deploy:docker` 发到 8080，逐页验证；
3. 有旧留言时，先在本地 `npm run guestbook:import` 导入 SQLite，再放进数据卷；
4. `systemctl stop nginx`，然后 `WEB_PORT=80 npm run deploy:docker`；
5. 验证首页、五个栏目、详情页、RSS、sitemap、留言 API；
6. 切换成功后执行 `systemctl disable nginx`，避免重启时抢占 80。

回滚：

```bash
cd /opt/fengyu && docker compose down
systemctl enable --now nginx
```

旧 PHP 站点和 `/var/www/xiaoquanzi` 不要删除，切换前先确认还能回滚。

### 旧方式（PHP，保留作回滚）

```bash
./deploy.sh
```

脚本会 `npm run build`、上传 `deploy/nginx.conf`、留言 PHP、`rsync dist/client/` 到 `/var/www/xiaoquanzi`，再 reload 宿主 nginx。可覆盖变量：

```bash
SERVER=root@1.2.3.4 REMOTE_DIR=/var/www/site ./deploy.sh
SSH_KEY=~/.ssh/other_key SSH_CONFIG=~/.ssh/config ./deploy.sh
```

### 服务器约定

| 项目              | 值                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------- |
| 服务器            | `example.com`（Ubuntu 24.04 / nginx 1.24）                                              |
| 登录              | `root` + `~/.ssh/id_ed25519`                                                            |
| Docker 部署目录   | `/opt/fengyu`                                                                           |
| 旧 Web 根目录     | `/var/www/xiaoquanzi`（回滚用，暂不删）                                                 |
| 留言数据卷        | `fengyu_guestbook-data`                                                                 |
| 旧留言 API / 数据 | `/var/www/xiaoquanzi-api/guestbook.php`、`/var/lib/xiaoquanzi/guestbook.json`（回滚用） |
| 端口              | `80` 站点；`8080` 预验证；`443` 由 xray 占用，未改动                                    |

### 以后绑定域名

1. 域名 A 记录指向 `example.com`；
2. 修改 `astro.config.mjs` 的 `site`、`deploy/nginx.container.conf` 的 `server_name`；
3. 用 certbot 签证书（80 HTTP-01）；
4. 443 建议用 nginx `stream` + `ssl_preread` 做 SNI 分流：站点域名走站点，其余 SNI 转给 xray（xray 退到 `127.0.0.1:8443`），客户端配置不用改；
5. 切换前用 `openssl s_client -servername` 验证分流，保留回滚。

## 设计参考

`stitch_astro_personal_website/` 是设计稿导出（5 个页面截图 + 设计 token），只作为参考，不参与构建；已在 `.gitignore` 中忽略。照片与头像为设计稿里的示例素材，字体与图标已本地化。
