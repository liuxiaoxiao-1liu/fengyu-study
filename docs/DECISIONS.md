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
3. `npm run format` / `format:check` 跑 Prettier；生成的 `src/data/kugou-playlists.ts`、第三方 `vendor/`、二进制素材不参与格式化；
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
