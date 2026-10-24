# 风屿书房 / Island of Solitude

一个大学生收藏网文、酷狗歌单、影像与随笔的数字秘密基地。视觉参考 `stitch_astro_personal_website/` 中的 *Warm Editorial Literary Journal* 设计稿，用 Astro 重建为可部署的独立站点。

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

开发、提交和部署前请先读 [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md)。当前为 **v0.1 提案，待确认**；确认后从下一项改动开始执行。

## 本地开发

```bash
npm install
npm run dev          # http://localhost:4321，含 /api/guestbook
npm run build        # 输出 dist/client 与 dist/server
npm run preview      # 预览构建结果
```

- 需要 Node ≥ 26（Astro 7 + `node:sqlite`）；
- 本地 SQLite 默认写到 `.data/guestbook.sqlite`，可用 `GUESTBOOK_DB` 覆盖；
- 旧留言 JSON 导入：`npm run guestbook:import -- <json> <sqlite>`；
- 备份：`npm run guestbook:backup -- <sqlite> <backup>`。

这台机器的 `$HOME`、`/etc/ssh` 有部分只读限制，所以脚本会把 npm / Astro 的缓存和配置写进项目内（`.npm-cache/`、`.config/`）。普通开发机不需要这些设置。

## 页面与内容

| 路由 | 内容 |
| --- | --- |
| `/` | 首页：欢迎语、状态广播、网文/酷狗/影集/随记四宫格、数据存根、留言预览 |
| `/reading/` | 读听：追更书架、年度网文、酷狗歌单与听歌月报 |
| `/photos/` | 影集：动漫 / 现实 / 虚拟 CG 图像档案与手记 |
| `/essays/` | 随记：文章列表、书写脉络、即刻手记、主题检索、季刊订阅 |
| `/essays/[slug]/` | 随记详情页 |
| `/guestbook/` | 留言：投递信笺、房主公告、友链、留言回廊、漂流瓶 |
| `/rss.xml`、`/sitemap.xml`、`/404.html` | 订阅、站点地图、404 |

内容目前是设计稿中的示例文案，直接改这些地方即可换成自己的：

- 随记正文：`src/data/essays.ts`
- 站内搜索索引：`src/data/search.ts`
- 首页与各栏目的文案、书籍/歌单信息：直接在各页面的 `.astro` 文件里改
- 首页/栏目图片：`public/images/`
- 书籍封面与专辑封面：`public/images/covers/`（由 `stitch-assets/make-covers.py` 生成，可直接替换）
- 站点名、简介、页脚：`src/lib/site.ts`

字体文件在 `public/fonts/`，CSS 在 `src/styles/fonts.css` 与 `src/styles/icons.css`。

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

| 服务 | 说明 |
| --- | --- |
| `web` | `nginx:1.27-alpine`，映射 `${WEB_PORT:-8080}:80`，挂载 `dist/client` 与容器版 nginx 配置 |
| `app` | `docker/app.runtime.Dockerfile`，Node 26，只跑 `/api/` 与 server bundle |
| 数据卷 | `fengyu_guestbook-data` → `/data/guestbook.sqlite` |

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

| 项目 | 值 |
| --- | --- |
| 服务器 | `example.com`（Ubuntu 24.04 / nginx 1.24） |
| 登录 | `root` + `~/.ssh/id_ed25519` |
| Docker 部署目录 | `/opt/fengyu` |
| 旧 Web 根目录 | `/var/www/xiaoquanzi`（回滚用，暂不删） |
| 留言数据卷 | `fengyu_guestbook-data` |
| 旧留言 API / 数据 | `/var/www/xiaoquanzi-api/guestbook.php`、`/var/lib/xiaoquanzi/guestbook.json`（回滚用） |
| 端口 | `80` 站点；`8080` 预验证；`443` 由 xray 占用，未改动 |

### 以后绑定域名

1. 域名 A 记录指向 `example.com`；
2. 修改 `astro.config.mjs` 的 `site`、`deploy/nginx.container.conf` 的 `server_name`；
3. 用 certbot 签证书（80 HTTP-01）；
4. 443 建议用 nginx `stream` + `ssl_preread` 做 SNI 分流：站点域名走站点，其余 SNI 转给 xray（xray 退到 `127.0.0.1:8443`），客户端配置不用改；
5. 切换前用 `openssl s_client -servername` 验证分流，保留回滚。

## 设计参考

`stitch_astro_personal_website/` 是设计稿导出（5 个页面截图 + 设计 token），只作为参考，不参与构建；已在 `.gitignore` 中忽略。照片与头像为设计稿里的示例素材，字体与图标已本地化。
