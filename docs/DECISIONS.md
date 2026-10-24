# 架构决策记录（ADR）

> 每次结构性决策一个条目；写清背景、决定、影响和回滚方式。
> 与 [PROJECT_RULES.md](PROJECT_RULES.md) 冲突时，以本文件记录的最新 ADR 为准，并回头更新规范。

---

## ADR-001 · 留言后端从 PHP + JSON 迁移到 Astro API + SQLite

- **日期**：2026-10-24
- **状态**：已接受，实施中
- **影响范围**：`/api/guestbook`、部署方式、服务器运行时

### 背景

- 现有留言接口是 `deploy/guestbook.php` + `/var/lib/xiaoquanzi/guestbook.json`；
- 运行环境 PHP 8.3 已进入「只修安全漏洞」阶段；
- 站点本身是 Astro 7 静态构建，团队只维护一套 JS/TS 更省心；
- 服务器是 2 核 2G，不需要 PostgreSQL 这类独立数据库进程；
- 公开留言、悄悄话、限流、蜜罐等行为需要保留。

### 决定

1. 保留 Astro 的静态输出，页面继续全量预渲染；
2. 引入 `@astrojs/node`（standalone），只让 `src/pages/api/guestbook.ts` 以 `prerender = false` 在请求时执行；
3. 数据层用 Node 26 内置的 `node:sqlite`，单文件数据库，开 WAL；
4. 运行时用 Docker Compose：`web`（nginx）+ `app`（Node）；
5. nginx 继续负责静态文件、缓存、安全和限流，`/api/guestbook` 反代到 app；
6. 数据放在名为 `guestbook-data` 的 Docker 卷，容器重建不丢；
7. 旧 PHP 配置与 `/var/www/xiaoquanzi` 保留，作为回滚路径。

### 数据模型

```sql
letters (
  id, name, station, message, tag,
  is_private, status(pending|approved|hidden),
  ip_hash, created_at
)
rate_limits (ip_hash, last_at)
```

- 公开留言：`status = 'approved'`，`is_private = 0`；
- 悄悄话：`is_private = 1`，`status = 'pending'`，GET 不返回；
- 限流：每 IP 60 秒一次，nginx 再加 6r/m 的粗粒度限制。

### 影响

**正面**

- 去掉 PHP 运行时，站点只有 JS/TS 一套语言；
- 数据库可查询、可备份、可加审核状态；
- 静态页面性能不变，仍由 nginx 直接返回；
- 2C2G 足够：Node + SQLite 常驻约 60–120MB。

**负面**

- 服务器需要 Docker 和 Node 镜像；
- 部署从「rsync 静态文件」变成「构建镜像 + 启动容器」；
- npm 依赖供应链要持续更新；
- 需要新写导入、备份、审核流程。

### 回滚

1. `cd /opt/fengyu && docker compose down`；
2. `systemctl start nginx`，恢复旧 `/var/www/xiaoquanzi` 与 PHP 站点；
3. 旧 JSON 数据在迁移前已备份，不受影响。

### 后续

- 留言管理后台（审核、隐藏、回复、导出）；
- 把旧 JSON 一次性导入 SQLite；
- 域名 / HTTPS（SNI 分流）后再做邮件订阅；
- 更新 `PROJECT_RULES.md` 的架构章节与部署章节。

---

## ADR-002 · 管理后台用单令牌鉴权，内容改为数据驱动

- **日期**：2026-10-24
- **状态**：已接受，实施中
- **影响范围**：`/admin/`、`/api/admin/*`、`/api/stats`、`/api/subscribe`、`src/data/*`

### 背景

- 悄悄话以 `pending` 存在 SQLite，只能进容器查，日常审核成本高；
- 站点是单人维护，2C2G，暂未上 HTTPS，不适合引入完整账号体系；
- 首页统计、搜索索引、歌单、照片、随记计数都写死在模板里，改内容要动多处；
- 季刊订阅只有假表单。

### 决定

1. 管理端用 `ADMIN_TOKEN`（服务器 `.env`，64 位 hex）做 Bearer Token，`timingSafeEqual` 比较；
   未配置时管理 API 统一 503；令牌只存 `sessionStorage`，不落 Cookie；
2. `/admin/` 仍是静态预渲染页，所有敏感数据通过 API 取，静态 HTML 里没有留言内容；
3. `letters` 增加 `reply`/`replied_at`；公开 GET 返回回复；新增 `subscribers` 表存季刊订阅；
4. 内容统一进 `src/data/`，页面循环渲染：`books` / `music` / `photos` / `quotes` / `essays`；
   搜索索引构建期生成，不再手写；
5. 站内播放采用可选音源：`track.audio` 有值才播，没有则降级外链并标注「未上传音源」；
   不引入第三方播放器、不绕过版权限制；
6. 照片用原生 `<dialog>` 灯箱，EXIF 作为可选字段由数据提供，不新增构建依赖。

### 影响

**正面**

- 审核、回复、导出不需要再进容器；
- 内容只改一处，统计与搜索自动跟随；
- 零新增运行时依赖，仍是一套 Astro + SQLite。

**负面**

- HTTP 下令牌明文传输，**上 HTTPS 前只应在可信网络使用**；
- 单令牌无法区分操作者，适合单人站，不适合多人协作；
- 图片 EXIF 需手工补，暂不做自动提取。

### 回滚

1. 管理端问题：停用 `ADMIN_TOKEN`（清空 `.env` 并重建 app），管理 API 返回 503，公开站不受影响；
2. 数据层问题：`reply`/`replied_at`/`subscribers` 均为增量列/表，旧代码会忽略，可直接回退镜像；
3. 内容页回退：`git revert` 对应提交后重新部署，数据库不动。

### 后续

- 域名 + HTTPS（SNI 分流）后启用日常审核；
- 如有多人维护需求，再评估 Basic Auth / OAuth；
- 音频文件托管与版权策略单独评审。

---

## ADR-003 · 酷狗站内播放：账号登录态 + 白名单解析

- **日期**：2026-10-24
- **状态**：已接受，已上线
- **影响范围**：`/reading/`、`/api/kugou/*`、`vendor/kugou/`、服务器 `.env`

### 背景

- 用户有酷狗 VIP，要求把账号里的歌单搬到站内并直接播放；
- 酷狗对付费曲目只向有权限的登录态返回播放地址，裸接口会返回 `20018` / `The Resource Needs to be Paid`；
- 站点的音频优势是浏览器原生 `<audio>`，不需要服务端解码或代理音频字节。

### 决定

1. 通过 KuGouMusicApi 的二维码登录拿 `token` / `vip_token`，只存服务器 `.env`；
2. 把该项目中 `register_dev` / `song_url` / 歌单读取的最小运行时 vendor 到 `vendor/kugou/`（MIT，保留 LICENSE）；
3. 先 `/register/dev` 换 `dfid`，再 `/song/url` 换 CDN 直链；`album_audio_id` 失败时退回 0 再试；
4. 歌单同步成 `src/data/kugou-playlists.ts`，播放接口只解析其中的 hash，不做通用代理；
5. 前端 `<audio>` 直接播直链；服务端不缓存/不转发音频字节；
6. 登录态失效或接口变更时返回 502，播放器降级为酷狗外链。

### 影响

**正面**

- 站内播放走用户自己的会员权限，不需要下载或破解；
- 复用成熟 API 实现，登录/签名逻辑不重写；
- 歌单与页面解耦，重新同步只改一个数据文件。

**负面**

- 强依赖酷狗非官方接口和账号登录态，可能随时失效；
- token 等价于账号凭据，服务器被入侵即泄露（建议小号/不绑支付）；
- 直链是 HTTP，站点上 HTTPS 后需要代理或换 https 源；
- 页面公开可请求解析接口，靠白名单 + 限流收窄。

### 回滚

1. 清空服务器 `.env` 里的 `KUGOU_*` 并重建 app → `/api/kugou/url` 返回 503，播放器降级外链；
2. 删除 `vendor/kugou`、`src/pages/api/kugou`、`src/data/kugou-playlists.ts`，恢复 `reading.astro` 的静态 5 首即可；
3. 酷狗侧随时可在网页退出登录，使 token 失效。

> 后续（ADR-006）：歌单改为运行时同步，只保留账号歌单 `maotouying`；静态 `src/data/kugou-playlists.ts` 已删除。

---

## ADR-004 · 自动化校验用 astro check + Prettier + 构建冒烟

- **日期**：2026-10-25
- **状态**：已接受，已落地
- **影响范围**：`package.json`、`tsconfig.json`、`.prettierrc.json`、`.github/workflows/ci.yml`、`scripts/smoke-test.mjs`、页面内联脚本

### 背景

- 仓库此前只有 `npm run build` 一道关，没有类型检查、格式检查和自动化接口验证；
- 页面内联脚本是普通 JS，长期没有类型约束，`astro check` 一开就会报大量 DOM / 隐式 any 错误；
- 还没有远程仓库，无法直接依赖 CI；本机 `$HOME` 只读，Astro 遥测会写配置失败；
- 2026-10-25 文档对齐时决定把“能跑”升级为“可验证”。

### 决定

1. 开发依赖：`@astrojs/check`、`typescript`、`@types/node`、`prettier`、`prettier-plugin-astro`，运行时不新增依赖；
2. `npm run check` 跑 `astro check`；`tsconfig.json` 排除 `vendor/`、设计稿与试验目录，保留严格模式；
3. `npm run format` / `format:check` 跑 Prettier；第三方 `vendor/`、二进制素材不参与格式化；
4. `scripts/smoke-test.mjs` 拉起 `dist/server/entry.mjs`，用临时 SQLite + 测试 Token 验证页面、留言、限流、管理端、订阅、导出与酷狗歌单接口；
5. `npm run verify` 串联四项检查，作为发布前总闸门；`.github/workflows/ci.yml` 为接通远程仓库后的 CI 模板；
6. 页面内联脚本补齐类型（DOM 类型断言、接口响应类型、错误对象类型），行为不变。

### 影响

**正面**

- 类型、格式、构建、接口四条线都有可重复的验证；
- 冒烟测试覆盖了留言/审核/订阅等最容易回归的路径；
- 新页面和接口改动可以通过 `npm run verify` 在本地拦截。

**负面**

- 首次引入 Prettier 产生一次性大范围格式化提交，review 成本上升；
- 冒烟测试只覆盖 HTTP 行为，不覆盖视觉与浏览器交互；
- `@astrojs/check` 依赖 TypeScript 语言服务，装包体积增加（仅开发环境）；
- 没有远程仓库时，CI 模板不会自动执行。

### 回滚

1. 移除 `.prettierrc.json`、`.prettierignore`、`.editorconfig`、`.github/` 与 `scripts/smoke-test.mjs`，还原 `package.json` / `package-lock.json`；
2. `git revert` 格式化提交即可恢复原排版；类型修复与行为无关，可保留。

### 后续

- 接通私有远程仓库后启用 Actions；
- 补 Playwright 视觉/交互测试与链接检查；
- 视需要再评估 ESLint 与 Lighthouse。

---

## ADR-005 · 站内播放器：单 `<audio>` + `data-play` 指令 + 站内音源门面

- **日期**：2026-10-25
- **状态**：已接受，已落地
- **影响范围**：`src/components/Player.astro`、`src/layouts/BaseLayout.astro`、`src/pages/index.astro`、`src/pages/reading.astro`

### 背景

- 首页「酷狗音乐」卡片和读听「专辑归档」的播放图标只是装饰，点击没有声音；
- 知识库「音频播放管线」（`audio-playback-pipeline`）的原则是：解码交给浏览器 `<audio>`，应用不写解码器；音频地址由 provider 提供；直链有 TTL，失败要重取并续播；
- 知识库「在线音乐 Provider 架构」（`online-music-provider-architecture`）要求 UI 不直接碰平台接口，地址获取收敛到门面；
- 知识库「前端运行时性能护栏」（`frontend-runtime-guardrails`）要求连续播放时间不进框架状态，用 DOM/ref 直接更新；
- 本站是 Astro 多页站，没有 React，也没有 Folia 的双 deck / Web Audio / 队列能力。

### 决定

1. **单实例固定迷你播放器**：`Player.astro` 只在 `BaseLayout` 渲染一次，固定在视口底部；首次点播时出现，点「收起」隐藏并暂停；全站共用同一个 `<audio>`；不引入 Web Audio、双 deck、音频字节缓存；
2. **指令式入口**：所有播放入口只写 `data-play` + `data-hash` / `data-title` / `data-artist` / `data-external`，由播放器做事件委托，不在每个按钮里复制请求逻辑；
3. **音源门面**：浏览器只请求站内 `/api/kugou/url`，不直接访问酷狗；服务端继续做白名单、限流和登录态；
4. **失败与续播**：直链过期/断流时只重取一次，并按 `currentTime` 续播；5xx 网络抖动重试一次，429/503/404 不重试；最终失败显示错误并保留酷狗外链；
5. **统一 seek**：进度条只有一个入口；暂停中拖动进度条视为继续听，自动恢复播放；
6. **进度更新**：`timeupdate` 直接写文本和 range，不重建 DOM；
7. **入口接线**：首页精选卡与两行循环曲目改为播放按钮；读听专辑卡点击播放该专辑第一首，底部迷你条随即出现，不再需要页面内嵌播放器。

### 影响

**正面**

- 首页、专辑归档、歌单三个入口都能真正出声；
- 播放器固定底部，滚动不消失，切页后仍是同一套布局；
- 播放入口、错误处理和 seek 只有一份实现；
- 直链过期不再直接变成“坏按钮”，会尝试续播。

**负面**

- 仍然是 Astro 多页站：点站内链接会整页刷新，<audio> 被重建，播放会停止，需要重新点播；本轮没有上 View Transitions；
- 没有队列/自动下一首/预取/歌词，也没有 Folia 的无缝混音；
- 迷你条只在点播后出现，空状态不占位；
- 收起按钮是暂停 + 隐藏，不是最小化到小图标。

### 回滚

1. `git revert` 本提交即可恢复静态卡片和装饰图标；
2. 播放能力本身不依赖新接口，回滚不影响服务端。

### 后续

- 若要跨页面连续播放，再评估 Astro View Transitions + `transition:persist`；
- 需要队列/自动下一首/预取时，再参考知识库的 warm deck 与 URL 预取，而不是一次性照搬；
- 下一步可补 Playwright 的播放交互回归。

---

## ADR-006 · 只展示账号歌单 maotouying，运行时同步

- **日期**：2026-10-25
- **状态**：已接受，已落地
- **影响范围**：`src/lib/kugou.ts`、`src/pages/api/kugou/{playlist,playlists,url}.ts`、`src/pages/reading.astro`、`src/data/`

### 背景

- 读听页原先展示 17 个歌单，还混了一个「编辑精选」；用户只想要账号里名为 `maotouying` 的那一个；
- 旧方案把账号歌单在构建期生成到 `src/data/kugou-playlists.ts`，在酷狗上加歌后必须重新同步 + 重新构建 + 部署；
- 用户希望「在酷狗上添加歌曲，网站歌单自动同步」。

### 决定

1. **只保留一个歌单**：读听页移除歌单选择器，只展示 `maotouying`（`KUGOU_PLAYLIST_NAME` 可覆盖）；
2. **运行时拉取**：`/api/kugou/playlist` 调 vendor 的 `userPlaylist` + `playlistTracks`，服务端内存缓存 60 秒；`/api/kugou/playlists` 返回同一个歌单的元数据；
3. **白名单同源**：`/api/kugou/url` 不再查静态歌单快照，而是查运行时歌单缓存；首页/专辑精选仍用 `src/data/music.ts` 的固定曲目，作为白名单的第二来源保留；酷狗新增歌曲在缓存过期后即可解析播放；
4. **失败保留旧缓存**：拉取失败时优先返回上一次成功结果；没有缓存才向页面报同步失败；
5. **删除静态快照**：移除 `src/data/kugou-playlists.ts`、`src/data/playlists.ts` 与 `scripts/sync-kugou-playlists.mjs`，不再需要「同步 → 构建 → 部署」；
6. **页面改造**：读听页初始显示同步占位，加载后替换为真实曲目与数量；分页仍由服务端切片。

### 影响

**正面**

- 在酷狗上增删歌曲，约 1 分钟内自动反映到站内，不需要改代码或发版；
- 只展示一个歌单，UI 和代码都更简单；
- 静态数据删除后仓库少约 2000 行，构建更快。

**负面**

- 依赖酷狗接口在运行期可用；首次请求/缓存过期时会有一次拉取延迟；
- 没有静态快照兜底：Kugou 完全不可用时只能显示同步失败；
- 每个 app 实例各自缓存，多实例部署会有最多 60 秒不一致；
- 需要 `KUGOU_TOKEN` / `KUGOU_USERID` / `KUGOU_DFID` 等登录态。

### 回滚

1. 恢复 `src/data/kugou-playlists.ts`、`src/data/playlists.ts` 与同步脚本，把 API 改回静态查询；
2. 或在 `.env` 设 `KUGOU_PLAYLIST_NAME` 指向别的歌单验证运行链路，不影响账号数据。

### 后续

- 需要更快同步可把缓存降到 15–30 秒，或在酷狗 webhook/同步任务里主动失效；
- 后续可加服务端定时快照，作为酷狗不可用时的只读兜底。

---

## ADR-007 · 内容后台与影集运行时管理

- **日期**：2026-10-25
- **状态**：已接受，已落地
- **影响范围**：`/admin/`、`/photos/`、`src/lib/content-db.ts`、`src/lib/admin-auth.ts`、`src/pages/api/admin/photos*`、上传与媒体路由、nginx、备份脚本

### 背景

- 影集是构建期静态数据，改一张照片要改 `src/data/photos.ts`、重新构建、部署；
- 灯箱翻页不遵守当前分类，且没有下载入口；
- 用户需要一个带登录的内容后台，逐步替代「改代码运维内容」。

### 决定

1. **内容库**：影集数据落到 `content.sqlite`（默认 `.data/content.sqlite`，容器 `/data/content.sqlite`），首次启动从现有 `src/data/photos.ts` 播种一次；
2. **后台登录**：`/admin/` 用 `ADMIN_USER` + `ADMIN_PASSWORD_HASH`（scrypt）+ `ADMIN_SESSION_SECRET` 签发 HttpOnly cookie；旧的 `/admin/letters/` 继续用 `ADMIN_TOKEN`；
3. **影集 CRUD**：`/admin/` 支持新增、编辑、删除、上传图片；上传文件写入 `CONTENT_UPLOADS`（容器 `/data/uploads`），经 `/api/media/photos/...` 读取；
4. **影集页 SSR**：`/photos/` 设为 `prerender = false`，请求时从内容库读取；nginx 把 `/photos/` 反代给 app；后台改完刷新即生效；
5. **灯箱修复**：当前分类内翻页（不跨系列）、显示 `n / 分类数量`、增加「下载」和「编辑」入口；
6. **备份**：每日备份同时覆盖 `guestbook.sqlite`、`content.sqlite` 和 `uploads/`；
7. **其它死交互**：随笔列表与侧栏的 `#标签` 从装饰 span 改成可点击的标签筛选。

### 影响

**正面**

- 影集可以在网页上维护，不需要改代码或发版；
- 上传、下载、分类内翻页都有明确行为；
- 登录态用 HttpOnly cookie，密码只存 scrypt 哈希。

**负面**

- `/photos/` 从纯静态变为按请求渲染，依赖 app 容器；nginx 必须保留 `/photos/` 反代；
- 上传文件与内容库都在 `/data` 卷，备份/恢复要一起处理；
- 仍没有多媒体格式校验之外的处理（缩放、EXIF 自动提取、孤儿文件清理）；
- 目前后台只覆盖影集，随笔/书/台词等内容仍走代码；
- HTTP 下登录密码明文传输，只应在可信网络使用。

### 回滚

1. 把 `/photos/` 的 `prerender = false` 和 nginx 反代移除，恢复静态页；
2. `git revert` 后台相关提交；`content.sqlite` 与 `uploads/` 留在卷里，不影响回滚后的静态页；
3. 如需彻底关闭后台，清空 `.env` 的 `ADMIN_USER` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET`，登录返回 503。

### 后续

- 把随笔、书、台词接入同一内容库与后台；
- 图片压缩/缩放、EXIF 自动读取、删除照片时清理孤儿文件；
- 后台增加操作日志；必要时把会话换成服务端存储。

---

## ADR-008 · 内容后台扩展到随笔 / 书架 / 唱片 / 曲目 / 台词

- **日期**：2026-10-25
- **状态**：已接受，已落地
- **影响范围**：`CONTENT_DB` 的 `content_records` 表、`/admin/` 导航、`/`、`/essays/`、`/reading/`、`/rss.xml`、`/sitemap.xml`、nginx

### 背景

- ADR-007 只接管了影集；随笔、书架、唱片、曲目和台词仍然要改 `src/data/*.ts` 再构建；
- 用户要求「全部弄进去」并加导航栏，后续靠后台运维内容。

### 决定

1. 在 `content.sqlite` 增加通用 `content_records` 表（type + slug + title + JSON data + sort_order），一次性从现有 `src/data/*` 播种；
2. `/admin/` 增加顶部导航：影集 / 随笔 / 书架 / 唱片 / 曲目 / 台词；非影集类型使用同一套 schema 驱动的动态表单；
3. 通用 CRUD API：`/api/admin/content/:type` 与 `/api/admin/content/:type/:id`；schema 由 `/api/admin/schema` 下发；
4. 首页、随记列表/详情、读听、RSS、sitemap 改为 `prerender = false`，请求时读取内容库；nginx 反代 `/`、`/essays/`、`/reading/`、`/rss.xml`、`/sitemap.xml`；
5. 曲目表成为站内播放白名单的第二来源：后台填入酷狗 hash 的曲目可以直接播放；
6. 读听页增加「精选曲目」列表，后台新增的曲目有地方可见/可播。

### 影响

**正面**

- 六类内容都能在网页上维护，改完刷新即生效；
- 导航和动态表单复用，新增字段只需要改 schema；
- 内容库统一备份，数据与页面解耦。

**负面**

- 首页、随记、读听、RSS、sitemap 都依赖 app 容器，nginx 必须保留这些反代；
- 站内搜索索引仍是构建期静态数据，后台新增内容不会自动进搜索（待补）；
- 曲目精选列表和播放器白名单依赖内容库，后台误删会影响播放；
- 静态站点变成混合渲染，静态部署的 SEO/缓存优势部分减弱；
- 管理后台目前仍是单用户，没有操作日志。

### 回滚

1. 移除 nginx 对动态页面的反代，恢复各页 `prerender` 默认值，回退到静态构建；
2. `content.sqlite` 保留，不影响回滚；必要时从每日备份恢复；
3. 后台 API 与登录保留，不影响公开站。

### 后续

- 把站内搜索改为动态索引；
- 增加内容操作日志、软删除与回收站；
- 首页/读听再做缓存或增量更新，减少每次请求的 DB 开销。

---

## ADR-009 · 动态搜索与友链后台

- **日期**：2026-10-25
- **状态**：已接受，已落地
- **影响范围**：`src/pages/api/content/search.ts`、`Header.astro`、`/guestbook/`、`links` 内容类型、nginx

### 背景

- 内容全部进后台后，构建期 `searchIndex` 搜不到后台新加的内容；
- 友链卡片写死在留言页，改一个链接也要发版。

### 决定

1. 新增公开接口 `GET /api/content/search`，请求时从 `content.sqlite` 汇总页面、随笔、书、唱片、曲目、影集、台词、友链；
2. Header 首次打开搜索时拉取该接口并替换结果，接口失败时保留构建期索引作 fallback；
3. 新增 `links` 内容类型，后台导航加「友链」；留言页改为 `prerender = false`，从内容库渲染友链卡片和席位数；
4. nginx 增加 `/guestbook/` 反代；`/api/content/search` 走现有 `/api/` 反代。

### 影响

**正面**

- 后台新增内容立即可搜；
- 友链可在网页维护，空 URL 的条目先链回友链区，避免死链。

**负面**

- 搜索接口是公开读接口，无缓存时每次打开搜索都会查库；当前数据量很小；
- 留言页从静态变成 SSR，依赖 app 容器；
- `src/data/search.ts` 仍需要保持 fallback，数据来源有两条路径。

### 回滚

1. Header 移除动态 fetch，恢复只用静态 `searchIndex`；
2. 留言页恢复静态，友链写回代码；nginx 移除 `/guestbook/` 反代；
3. `links` 表保留在内容库里，不影响回滚后的页面。

### 后续

- 给搜索接口加短缓存/ETag；
- 搜索支持标签过滤与键盘上下选择；
- 友链增加头像、申请状态与排序拖拽。
