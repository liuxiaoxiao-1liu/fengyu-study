# 功能补齐计划与接口契约（2026-10）

> 本文件是「把功能全完善」阶段的施工图。动代码前先读；契约变更要先改这里。
> 关联：[DECISIONS.md](DECISIONS.md)（ADR）、[PROJECT_RULES.md](PROJECT_RULES.md)（规范）。

## 0. 现状与目标

| 项 | 现状 | 目标 |
| --- | --- | --- |
| 留言审核 | 私密留言只能进容器查 | `/admin/` 后台：审核、回复、导出 |
| 首页/留言统计 | 148 封、42 只、100% 写死 | `/api/stats` + 构建期真实计数 |
| 搜索索引 | 手写 24 条 | 由数据模块构建期生成 |
| 季刊订阅 | 假表单 | `POST /api/subscribe` 入库，后台导出 |
| 台词摘录 | 0 张卡片 | `quotes.ts` 数据驱动 |
| 歌单 / 站内播放 | 已接账号全部 17 个歌单、~1800 首 | 歌单切换 + 分页；服务端换酷狗直链，浏览器 `<audio>` 播放 |
| 照片 | 静态卡片 | 数据驱动 + 灯箱 + 系列筛选 + EXIF |
| 随记计数 | 48/21/19/8 | 由 `essays`/`quotes` 实际长度计算 |

## 1. 数据模块（`src/data/`）

所有内容只在一处维护；页面用 `map` 渲染，不再复制卡片。类型用 `export type`。

```ts
// books.ts
export type Book = {
  slug: string; title: string; author: string; genre: string;
  status: 'reading' | 'finished' | 'paused';
  year: number; cover: string; url: string; blurb: string;
};
export const books: Book[];

// music.ts
export type Track = {
  slug: string; title: string; artist: string; album: string;
  cover: string; tag: string; duration: string;
  audio?: string;       // 例 '/audio/big-fish.mp3'，没有音源就省略
  url?: string;         // 酷狗/官方外链
};
export const tracks: Track[];

// photos.ts
export type Photo = {
  slug: string; title: string; src: string; alt: string;
  width: number; height: number;
  series: 'anime' | 'reality' | 'virtual';
  takenAt: string; note: string;
  exif?: { camera?: string; lens?: string; aperture?: string; shutter?: string; iso?: string; location?: string };
};
export const photos: Photo[];

// quotes.ts
export type Quote = { id: string; text: string; source: string; work?: string; date?: string; tags: string[] };
export const quotes: Quote[];
```

`essays.ts` 增加 `kind: 'essay' | 'micro'`（网文/音乐随笔与碎碎念），正文仍用 HTML 字符串。
`search.ts` 不再手写数组：从上述模块 + `essays` + 固定页面生成 `searchIndex`，`Header.astro` 无需改导入。

## 2. API 契约（`src/pages/api/`，全部 `prerender = false`）

| 方法/路径 | 说明 |
| --- | --- |
| `GET /api/guestbook` | 公开留言，`status=approved AND is_private=0`；新增返回 `reply`、`replied_at` |
| `POST /api/guestbook` | 保持不变（蜜罐、限流、长度校验） |
| `GET /api/stats` | `{ok, letters:{total,approved,pending,hidden,replied,publicTotal,publicReplied}, replyRate}`；replyRate 只按公开可见留言计算；不泄露内容 |
| `POST /api/subscribe` | `{email}` → 幂等入库；格式校验 + 蜜罐 + 限流；`{ok:true}` |
| `GET /api/admin/letters?status=pending\|approved\|hidden\|all` | 管理端列表（含私密；不含 `ip_hash`） |
| `PATCH /api/admin/letters/:id` | `{status?, reply?}`；写 `replied_at`；校验状态枚举 |
| `GET /api/admin/export?kind=letters\|subscribers&format=json\|csv` | 附件下载，`Content-Disposition: attachment` |

鉴权：所有 `/api/admin/*` 需要 `Authorization: Bearer $ADMIN_TOKEN`，用 `crypto.timingSafeEqual` 比较；
`ADMIN_TOKEN` 未设置时返回 `503 admin_disabled`。错误响应统一 `{ok:false,error}`。

## 3. 数据库（`src/lib/guestbook-db.ts`）

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

## 4. 页面改造

- `index.astro`：书架/音乐/照片/随记计数取数据长度；留言预览与统计走 `/api/stats`；表单提交真实 API。
- `essays.astro`：列表与计数由 `essays` 生成；新增「台词摘录」卡片（`quotes.ts`，`data-target="excerpt"`）；季刊表单提交 `/api/subscribe` 并显示结果。
- `reading.astro`：唱片与曲目由 `tracks` 生成；播放器用 `<audio>`：有 `audio` 才可播，没有则按钮外链酷狗搜索并明确提示「未上传音源」。
- `photos.astro`：网格由 `photos` 生成；原生 `<dialog>` 灯箱（上一张/下一张/Esc）；系列筛选；EXIF 面板。
- `guestbook.astro`：统计与留言回廊接 API；分页/筛选保留。
- `admin/`：`/admin/` 单页后台，Token 存 `sessionStorage`，待审核/全部、通过/隐藏、回复、导出。

## 5. 工程约束

- 只允许 `node:sqlite`，不新增数据库依赖；不引入前端框架。
- 用户输入一律 `textContent` / Astro 转义，禁止拼 `innerHTML`。
- 服务端只监听容器内网；浏览器请求走 nginx `/api/` 反代。
- 新依赖必须有理由；本阶段原则上零新增依赖。
- 构建验证：`npm run build`；多个 agent 并发时用 `flock /tmp/fengyu-build.lock npx astro build`。
- 部署先 `WEB_PORT=8080` 验证，再 `WEB_PORT=80` 切换；`ADMIN_TOKEN` 放服务器 `/opt/fengyu/.env`，不进仓库。

## 6. 文件所有权（本阶段）

| 范围 | 负责人 |
| --- | --- |
| `src/lib/guestbook-db.ts`、`src/lib/newsletter-db.ts`、`src/pages/api/**`、`src/pages/admin/**`、`src/pages/guestbook.astro` | admin 线 |
| `src/data/**`、`src/pages/index.astro`、`essays.astro`、`reading.astro`、`photos.astro`、`src/components/**` | content 线 |
| `deploy/**`、`docker-compose.yml`、`scripts/**`、`docs/**`、`README.md` | Lead |

## 7. 验收清单

- [ ] `npm run build` 通过，无 TypeScript 报错
- [ ] 本地 `npm run dev`：首页计数真实；搜索条目数随数据变化；歌词/照片灯箱可用
- [ ] 未带 Token 访问 `/api/admin/letters` 返回 401；错误 Token 返回 401；未配置返回 503
- [ ] 悄悄话入库后 `/admin/` 可见，审核通过后公开页出现
- [ ] 订阅邮箱入库，重复提交幂等，可导出 CSV
- [ ] 8080 预览通过后切 80，线上五页 + API + RSS + sitemap 200
