# 功能补齐计划与接口契约（2026-10）

> 本文件是「把功能全完善」阶段的施工图。动代码前先读；契约变更要先改这里。
> 关联：[DECISIONS.md](DECISIONS.md)（ADR）、[PROJECT_RULES.md](PROJECT_RULES.md)（规范）。
> **状态（2026-10-25 v0.4 修订）**：第 1–5 节功能已落地并上线；第 7 节按 `npm run verify` 与线上实测复核。ADR-013/014 之后补充页面/组件拆分、`src/scripts/`、公共 API 层、Vitest 与扩展冒烟，本文件同步更新契约。

## 0. 施工前现状与已落地目标

| 项              | 施工前（2026-10 初）             | 已落地                                                                |
| --------------- | -------------------------------- | --------------------------------------------------------------------- |
| 留言审核        | 私密留言只能进容器查             | `/admin/` 后台：审核、回复、导出                                      |
| 首页/留言统计   | 148 封、42 只、100% 写死         | `/api/stats` 请求时聚合计数                                           |
| 搜索索引        | 手写 24 条                       | `/api/content/search` 请求时从内容库生成；`search.ts` 兜底            |
| 季刊订阅        | 假表单                           | `POST /api/subscribe` 入库，后台导出                                  |
| 台词摘录        | 0 张卡片                         | 内容库 `quotes` 类型驱动；首次从 `quotes.ts` 播种                     |
| 歌单 / 站内播放 | 已接账号全部 17 个歌单、~1800 首 | 后台切换歌单 + 分页；服务端换酷狗直链，浏览器 `<audio>` 播放          |
| 照片            | 静态卡片                         | 内容库驱动 + 灯箱 + 系列筛选 + EXIF                                   |
| 随记计数        | 48/21/19/8                       | 由内容库或种子数据实际计数                                            |
| 内容后台        | 只能改代码发版                   | `/admin/` 管理影集/随笔/书/唱片/曲目/台词/友链，写入 `content.sqlite` |
| 酷狗后台        | 改 `.env` 再重建                 | 扫码登录、切换歌单、增删曲目，会话写 `/data/kugou-session.json`       |
| 站内连续播放    | 换页即停                         | `ClientRouter` + `transition:persist` 保留播放器                      |

## 1. 数据模块与内容库

同一份内容不在页面里复制；运行时以 `content.sqlite` 为准，`src/data/` 只是首启种子。页面用 `map` 渲染，不再复制卡片。类型用 `export type`。

```ts
// books.ts
export type Book = {
  slug: string;
  title: string;
  author: string;
  genre: string;
  status: 'reading' | 'finished' | 'paused';
  year: number;
  cover: string;
  url: string;
  blurb: string;
};
export const books: Book[];

// music.ts
export type Track = {
  slug: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  tag: string;
  duration: string;
  audio?: string; // 例 '/audio/big-fish.mp3'，没有音源就省略
  url?: string; // 酷狗/官方外链
};
export const tracks: Track[];

// photos.ts
export type Photo = {
  slug: string;
  title: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  series: 'anime' | 'reality' | 'virtual';
  takenAt: string;
  note: string;
  exif?: { camera?: string; lens?: string; aperture?: string; shutter?: string; iso?: string; location?: string };
};
export const photos: Photo[];

// quotes.ts
export type Quote = { id: string; text: string; source: string; work?: string; date?: string; tags: string[] };
export const quotes: Quote[];
```

`essays.ts` 增加 `kind: 'essay' | 'micro'`（网文/音乐随笔与碎碎念），正文仍用 HTML 字符串；首次启动播种到 `content_records`。
`search.ts` 不再手写数组，只作为首屏/断网兜底；正常搜索由 `GET /api/content/search` 从内容库动态汇总。

## 2. API 契约（`src/pages/api/`，全部 `prerender = false`）

| 方法/路径                                                          | 说明                                                                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/guestbook`                                               | 公开留言，`status=approved AND is_private=0`；新增返回 `reply`、`replied_at`                                                             |
| `POST /api/guestbook`                                              | 保持不变（蜜罐、限流、长度校验）                                                                                                         |
| `GET /api/stats`                                                   | `{ok, letters:{total,approved,pending,hidden,replied,publicTotal,publicReplied}, replyRate}`；replyRate 只按公开可见留言计算；不泄露内容 |
| `POST /api/subscribe`                                              | `{email}` → 幂等入库；格式校验 + 蜜罐 + 限流；`{ok:true}`                                                                                |
| `GET /api/admin/letters?status=pending\|approved\|hidden\|all`     | 管理端列表（含私密；不含 `ip_hash`）                                                                                                     |
| `PATCH /api/admin/letters/:id`                                     | `{status?, reply?}`；写 `replied_at`；校验状态枚举                                                                                       |
| `GET /api/admin/export?kind=letters\|subscribers&format=json\|csv` | 附件下载，`Content-Disposition: attachment`                                                                                              |

鉴权：`/api/admin/*` 统一走 `src/lib/admin-auth.ts` 的 `requireAdmin()`。优先接受 `/admin/` 登录后的 HttpOnly cookie 会话；旧 `Authorization: Bearer $ADMIN_TOKEN` 继续兼容脚本和 Bearer 调用，比较用 `crypto.timingSafeEqual`。旧 `/admin/letters/` 页面已改为 0 秒跳转，不再作为入口。
`ADMIN_USER` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` 未配置时主后台登录返回 `503 admin_disabled`；`ADMIN_TOKEN` 未配置时旧 Bearer 接口不可用，但 cookie 仍可访问管理 API。两种凭据都不可用时才返回 503；配了主账号但请求既无 cookie 又无 token 时返回 401。错误响应统一 `{ok:false,error}`，JSON 响应统一 `src/lib/http.ts`。

新增接口组（均在 `src/pages/api/` 下，`prerender = false`）：

- 内容后台：`POST /api/admin/login`、`POST /api/admin/logout`、`GET /api/admin/session`、`GET /api/admin/schema`、`GET|POST /api/admin/content/:type`、`PATCH|DELETE /api/admin/content/:type/:id`、`GET|POST /api/admin/photos`、`PATCH|DELETE /api/admin/photos/:id`、`POST /api/admin/upload`；
- 酷狗后台：`GET /api/admin/kugou/status`、`POST /api/admin/kugou/qr`、`GET /api/admin/kugou/qr?key=...`、`POST /api/admin/kugou/logout`、`GET /api/admin/kugou/playlists`、`POST /api/admin/kugou/settings`、`POST|DELETE /api/admin/kugou/tracks`；
- 公开接口：`GET /api/content/search?q=...`、`GET /api/kugou/playlists`、`GET /api/kugou/playlist?slug=...&page=...`、`GET /api/kugou/url?hash=...`、`GET /api/media/[...path]`。

## 3. 数据库（`src/lib/guestbook-db.ts` / `src/lib/content-db.ts`）

现有 `letters`：

```sql
CREATE TABLE letters (
  id, name, station, message, tag, is_private,
  status CHECK (status IN ('pending','approved','hidden')),
  ip_hash, created_at
);
```

迁移（幂等，`PRAGMA table_info(letters)` 判断后再 `ALTER TABLE`）：

```sql
ALTER TABLE letters ADD COLUMN reply TEXT NOT NULL DEFAULT '';
ALTER TABLE letters ADD COLUMN replied_at TEXT;

CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'quarterly',
  confirmed INTEGER NOT NULL DEFAULT 0
);
```

内容库 `content.sqlite`（`CONTENT_DB`，容器 `/data/content.sqlite`）：

```sql
content_records (
  id, type, slug, title, data JSON,
  sort_order, created_at, updated_at,
  UNIQUE (type, slug)
);

photos (
  id, slug, title, src, alt, width, height, series,
  taken_at, note, badge, exif JSON, sort_order, created_at, updated_at
);

settings (key, value);
```

上传文件在 `CONTENT_UPLOADS`（容器 `/data/uploads`），通过 `/api/media/[...path]` 提供；后台扫码会话 `kugou-session.json`、歌单设置 `kugou-settings.json` 也在 `/data/`。`content_records` 和 `photos` 首次启动从 `src/data/` 播种；`settings` 里保存版本化 manifest（已播种 slug 列表），后续新增种子条目会在启动时补入，后台删除的条目不会被重新插回。之后内容以后台写入为准。

## 4. 页面改造

页面只保留路由、数据获取和组装；区块在 `src/components/{site,guestbook,admin}/`，浏览器交互在 `src/scripts/{site,guestbook,admin}/`。

- `index.astro`（47 行）：`HeroProfile`、`HobbyGrid`（Reading/Music/Visual/Notes 卡）、`StatsSection`、`HomeGuestbook`；书架/音乐/照片/随记计数从内容库读取，留言预览与统计走 `/api/stats`；脚本 `src/scripts/site/home.ts`。
- `essays.astro`（87 行）：`EssaysHero`、`EssaysFilters`、`EssayList`、`ExcerptSection`、`WritingArchive`、`MicroNotes`、`TopicTags`、`NewsletterCard`；脚本 `src/scripts/site/essays.ts`。
- `reading.astro`（48 行）：`ReadingHero`、`ReadingFilters`、`Bookshelf`、`MusicShelf`（含 `AlbumGrid`/`PlaylistPanel`/`KugouLog`/`TrackList`/`PlaylistFooter`）；播放入口统一 `data-play`；脚本 `src/scripts/site/reading.ts`。
- `photos.astro`（46 行）：`PhotosHero`、`PhotosFilters`、`PhotoGallery`、`PhotosNotes`；原生 `<dialog>` 灯箱、系列筛选、EXIF；脚本 `src/scripts/site/photos.ts`。
- `guestbook.astro`（40 行）：`GuestbookHero`、`GuestbookForm`、`FriendsPanel`、`ArchiveFilters`、`LettersList`、`BottleModal`；脚本 `src/scripts/guestbook/*`。
- `admin/index.astro`（67 行）：`LoginPanel`、`Dashboard`、`DashboardNav`、`PhotosPanel`、`RecordsPanel`、`LettersPanel`、`KugouPanel`；脚本 `src/scripts/admin/*`；旧 `/admin/letters/` 为 35 行跳转页。
- `Header.astro`（141 行）+ `SearchDialog.astro`（65 行）：搜索索引/移动菜单；`src/scripts/site/header.ts` 监听 `astro:page-load`，换页后重新绑定；页面脚本统一走 `src/scripts/site/page-init.ts`。
- `Player.astro`（119 行）：`ClientRouter` + `transition:persist` 保持跨页播放；脚本在 `src/scripts/site/player.ts`；播放入口只写 `data-play`。
- `PhotoLightbox.astro`（103 行）+ `site/PhotoLightboxSlides.astro`（95 行）：灯箱壳与滑动内容分离；脚本在 `src/scripts/site/photo-lightbox.ts`，通过 `onPageLoad` 支持回访。

## 5. 工程约束

- 只允许 `node:sqlite`，不新增数据库依赖；不引入前端框架。
- 用户输入一律 `textContent` / Astro 转义，禁止拼 `innerHTML`。
- 服务端只监听容器内网；浏览器请求走 nginx `/api/` 与动态页面路由反代。
- 新依赖必须有理由；运行时零新增，开发依赖目前只有 `@astrojs/check`、`prettier`、`@types/node`、`typescript`、`vitest` 等。
- 验证入口：`npm run verify`（格式 + `astro check` + Vitest + 构建 + 接口冒烟）；多个 agent 并发构建时用 `flock /tmp/fengyu-build.lock npm run build`。
- 部署先 `WEB_PORT=8080` 验证，再 `WEB_PORT=80` 切换；`ADMIN_USER` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET`、旧 `ADMIN_TOKEN` 和 `KUGOU_*` 只放服务器 `/opt/fengyu/.env`，不进仓库。

## 6. 代码分层与职责

| 层         | 位置                                     | 职责                                               |
| ---------- | ---------------------------------------- | -------------------------------------------------- |
| 路由/组装  | `src/pages/*.astro`                      | 取数据、传 props、保持 <200 行；不写业务逻辑       |
| 展示组件   | `src/components/{site,guestbook,admin}/` | 只接收 props，不读数据库，不复制数据               |
| 浏览器交互 | `src/scripts/{site,guestbook,admin}/`    | 初始化函数 + DOM 查询；不访问 Node API             |
| 数据/服务  | `src/lib/`                               | SQLite、schema、校验、HTTP、限流、鉴权、酷狗、上传 |
| HTTP 编排  | `src/pages/api/`                         | 鉴权、解析、调 lib、返回统一 JSON                  |
| 测试       | `tests/`、`scripts/smoke-test.mjs`       | 纯函数单元测试、构建产物接口/页面冒烟              |

## 7. 验收清单（2026-10-25 复核）

- [x] `npm run check` 0 error、`npm test` 22 项通过、`npm run build` 通过
- [x] `npm run smoke`：70 项通过（页面、留言、审核、订阅、导出、cookie 登录、内容/照片 CRUD、上传/媒体路径、酷狗歌单）
- [ ] 本地 `npm run dev`：搜索条目数随数据变化；歌词/照片灯箱可用（需人工）
- [x] 未带凭据 / 错误 Token 访问管理接口返回 401（冒烟覆盖）
- [x] 两种管理凭据都未配置时 `/api/admin/*` 返回 503；只缺 `ADMIN_TOKEN` 但主账号已配置时，Bearer 请求 401、cookie 请求可用（单元测试/冒烟覆盖）
- [x] `/admin/` cookie 登录后可新增/编辑/删除内容与照片，上传图片可通过 `/api/media/...` 访问（冒烟覆盖）
- [x] 悄悄话入库后 `/admin/` 可见；通过审核后仍不出现在公开页（设计如此：公开页过滤 `is_private=1`）
- [x] 订阅邮箱入库，重复提交幂等，可导出 CSV（冒烟覆盖）
- [ ] 8080 预览通过后切 80（发布流程人工步骤）
- [x] 线上五页 + API + RSS + sitemap 200（2026-10-25 实测）

## 8. 自动化测试覆盖

### 8.1 Vitest（`tests/`）

- `validate.test.ts`：`text` / `integer` / `slugify` / `tags`；
- `content-schema.test.ts`：必填、枚举、数字、标签、曲目 `kugou` 嵌套对象；
- `rate-limit.test.ts`：窗口、超限、重置、不同 key、IP 解析与哈希；
- `admin-auth.test.ts`：密码/用户名、cookie、Bearer、401/503、cookie 属性；
- `content-db.test.ts`：种子、版本化 manifest、创建/更新/删除。

### 8.2 冒烟（`scripts/smoke-test.mjs`）

启动 `dist/server/entry.mjs`（临时 guestbook/content SQLite + 测试账号 + 测试 Token），验证 70 项：

1. `/`、`/reading/`、`/photos/`、`/essays/`、`/guestbook/`、`/admin/`、`/rss.xml`、`/sitemap.xml` 返回 200 且非空；未知路径 404；搜索索引含内容与友链。
2. 公开留言立即上墙；悄悄话不公开；同 IP 60 秒内二次提交 429；缺字段 422；统计计数正确。
3. 管理端 401、列表、审核、回复、私密留言通过后仍不公开、非法状态 400、不存在 404。
4. 错误密码 401；正确密码登录 + HttpOnly cookie；`/api/admin/session` 读取用户；内容创建/列表/更新/公开搜索/删除；照片创建/删除；图片上传、媒体访问、路径穿越拒绝；退出登录清空 cookie。
5. 订阅成功且重复提交幂等；邮箱格式错误 422；订阅 CSV 与留言 JSON 导出；非法导出类型 400。
6. 酷狗歌单列表与详情接口可用（不依赖账号 Token）；无登录态 503；旧 slug 404。

仍需人工/后续 Playwright：视觉回归、真实浏览器交互、链接检查、Lighthouse。
