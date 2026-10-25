# 风屿书房 · 项目规范

> 版本：v0.2
> 日期：2026-10-25
> 状态：**生效**。v0.2 起按本文执行；尚未拍板的事项收敛在[第 16 节](#16-待确认事项)，不影响已生效条款。
> 适用：本地仓库、构建产物、部署脚本、服务器上的站点与接口、站点内容与素材。
>
> **v0.2 变更**：按 [DECISIONS.md](DECISIONS.md) 的 ADR-001 / ADR-002 / ADR-003 / ADR-004 全面对齐当前实现——Astro 静态页 + Node API + SQLite + Docker Compose；移除与 PHP / JSON 留言、手工 `deploy.sh` 相关的过期描述；补充自动化校验（`astro check` / Prettier / `npm run verify` / 冒烟）与备份、回滚现状。

---

## 0. 先读这里

- 这份文件定义“以后怎么做”，不是对现有代码的判决书。
- 现有代码里不符合本规范的地方，统一列入《附录 A · 当前技术债》，按阶段迁移，不做一次性大重写。
- **任何偏离本规范的做法，必须在提交信息或 `docs/DECISIONS.md` 里写清原因、影响和回滚方式。**
- 规范优先级：安全与数据完整性 > 可回滚 > 可维护性 > 视觉还原 > 开发速度。
- “能跑”不等于“完成”。完成的定义见 12.3 节。

---

## 1. 项目与架构

### 1.1 项目是什么

风屿书房（Island of Solitude）是一个个人内容站点：

- 首页：个人介绍、网文/音乐/影集/随记入口、数据存根、留言预览
- 读听：网文与酷狗音乐档案，网文卡片外链起点中文网
- 影集：图片档案与手记
- 随记：文章列表与详情页
- 留言：公开留言 + 悄悄话 + 漂流瓶
- RSS、站点地图、404

### 1.2 运行架构

```text
本地开发机
  Astro 7 构建（Node ≥ 26）
        │  npm run build
        ▼
  dist/client（纯静态 HTML / CSS / JS / 图片 / 字体）
  dist/server（API bundle，仅 /api/* 在请求时执行）
        │  ./deploy/docker-deploy.sh（npm run deploy:docker）→ rsync
        ▼
服务器 example.com（/opt/fengyu）
  web 容器（nginx 1.27-alpine）:80
    ├─ /            → /usr/share/nginx/html（dist/client）
    └─ /api/*       → app 容器 :4321
  app 容器（Node 26 / @astrojs/node standalone）
    └─ 命名卷 fengyu_guestbook-data → /data/guestbook.sqlite（WAL）
  xray :443 独立代理，不属于本站代码
```

- 页面**全量预渲染**，只有 `src/pages/api/**`（`prerender = false`）由 app 容器执行；
- 服务器只放构建产物、`vendor/`、编排文件与运维脚本，**不存放源码和 `.git`**；
- 旧 PHP 站点 `/var/www/xiaoquanzi` 与 `deploy/guestbook.php` 仅作为回滚路径保留。

### 1.3 关键事实

| 项              | 值                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| 本地技术栈      | Astro 7.4.2 + Tailwind CSS 3.4.17 + PostCSS 8 + Autoprefixer 10 + `@astrojs/node` 11                 |
| 运行时          | Node ≥ 26（本机 v26.11.1）；数据库用内置 `node:sqlite`                                               |
| 包管理器        | npm，锁文件 `package-lock.json` 必须提交                                                             |
| 服务器          | Ubuntu 24.04 / Docker 24+ / Compose v2 / xray 443                                                    |
| 部署目录        | `/opt/fengyu`（`dist/`、`vendor/`、`docker-compose.yml`、`.env`、`backups/`、`scripts/`）            |
| 站点入口        | `http://example.com/`，尚未启用 HTTPS                                                                |
| 留言 / 订阅 API | app 容器内 `/api/guestbook`、`/api/stats`、`/api/subscribe`、`/api/admin/*`                          |
| 数据卷          | `fengyu_guestbook-data` → `/data/guestbook.sqlite`（letters / subscribers / rate_limits）            |
| 旧站（回滚）    | `/var/www/xiaoquanzi`、`/var/www/xiaoquanzi-api/guestbook.php`、`/var/lib/xiaoquanzi/guestbook.json` |
| 部署入口        | `npm run deploy:docker`（默认 8080）；`WEB_PORT=80 npm run deploy:docker` 切正式端口                 |

---

## 2. 技术栈与版本

### 2.1 允许的运行时

- **Node.js**：本地开发、构建与 app 容器统一使用 Node ≥ 26（Astro 7 + `node:sqlite`）；当前本机 v26.11.1。
- **Docker + Compose v2**：服务器唯一运行时；`web`（nginx）与 `app`（Node）两个服务，见 [docker-compose.yml](../docker-compose.yml)。
- **nginx**：只在 `web` 容器内提供静态文件、缓存、安全头、限流与 `/api/` 反代。
- **PHP**：不属于当前站点的构建与运行链路，仅旧站 `/var/www/xiaoquanzi` 作为回滚路径保留；不得为新功能编写 PHP。
- **数据库**：只允许 `node:sqlite`（单文件 + WAL）。禁止引入 ORM、`sqlite3` 命令行、PostgreSQL/MySQL/Redis。
- **不允许**在 app 容器之外新增 Node 进程或数据库容器；结构性变更必须单独评审并写 ADR。

### 2.2 依赖规则

- 新依赖必须满足：确实需要、维护活跃、许可证可接受、不会显著增加构建体积。
- 禁止在运行时依赖外部 CDN（Tailwind CDN、Google Fonts、远程图片、远程图标）。字体与图标必须自托管。
- 禁止同时混用 npm / pnpm / yarn；本仓库统一 npm。
- 升级主版本（Astro、Tailwind、Node）必须单独提交、单独验证、可回滚。
- 新增依赖后必须提交 `package-lock.json`；仅开发使用的工具放 `devDependencies`。
- `vendor/kugou/` 是第三方运行时（MIT，许可证随目录保留），**不得改写其协议逻辑**，只能在 `src/lib/kugou.ts` 外层封装。

### 2.3 浏览器与设备

- 支持最近两个版本的 Chrome、Edge、Firefox、Safari；iOS Safari 16+。
- 必测宽度：360、390、768、1024、1440。
- 不要求 IE、不支持无 JavaScript 时的完整交互，但核心内容必须在无 JS 时可读。

---

## 3. 目录规范

### 3.1 当前结构

```text
src/
  components/   Header、Footer、Player、TrackRow、PhotoLightbox
  data/         books、music、photos、quotes、essays、search
  layouts/      BaseLayout
  lib/          site、xml、guestbook-db、newsletter-db、kugou
  pages/        五个栏目、essays/[slug]、admin、404、rss.xml、sitemap.xml
  pages/api/    guestbook、stats、subscribe、kugou/*、admin/*
  styles/       fonts、icons、global
public/         图片、字体、og、robots
deploy/         docker-deploy.sh、nginx.container.conf、server/（cron、logrotate）、旧 PHP（仅回滚）
docker/         app 镜像（构建 / 运行时）
scripts/        SQLite 备份、留言导入、探活、酷狗歌单同步、冒烟测试
vendor/kugou/   酷狗解析最小运行时（MIT）
docs/           规范、ADR、功能契约
```

### 3.2 后续目标结构（渐进，不一次性重写）

```text
src/
  components/   继续按页面拆：site/、home/、reading/、photos/、essays/、guestbook/
  content/      随记迁移为 Content Collections（*.md + content.config.ts）
  scripts/      浏览器端交互从页面 <script> 抽出（按需，不强制）
tests/          Playwright 冒烟测试（与 scripts/smoke-test.mjs 并存）
docs/           ASSETS.md（素材来源与许可证）
```

### 3.3 目录规则

- `src/pages/` 只做路由、数据获取和页面组装，**不写大段业务逻辑和重复卡片 HTML**。
- 页面文件超过 **200 行** 必须拆分组件；组件超过 **150 行** 考虑继续拆分（存量见附录 A，按阶段处理）。
- `src/data/` 是内容数据的唯一来源。书籍、专辑、照片、台词、随笔、歌单不得同时写在多个地方。
- `src/pages/api/` 只做 HTTP 编排；SQL、校验与复用逻辑放 `src/lib/`。
- `src/lib/` 只放纯函数、类型与数据访问；不做 UI，不拼 HTML。
- `public/` 只放需要按原路径服务的文件；源素材、生成脚本、设计稿放 `scripts/` 或仓库内素材目录，不要混进 `public/`。
- `deploy/` 只放服务器侧配置与运维脚本；不得放密钥、密码、token、UUID。
- 文档统一放 `docs/`，根目录只保留 README、许可证和必要配置。

---

## 4. 命名规范

| 类型            | 规则                               | 示例                                    |
| --------------- | ---------------------------------- | --------------------------------------- |
| 目录            | 小写 kebab-case                    | `photo-journal/`、`guestbook/`          |
| Astro 组件      | PascalCase                         | `NovelCard.astro`、`SearchDialog.astro` |
| 页面路由        | 小写 kebab-case                    | `reading.astro`、`essays/[slug].astro`  |
| TS 文件         | 小写 camelCase 或 kebab-case       | `site.ts`、`format-date.ts`             |
| 导出的类型/接口 | PascalCase                         | `Essay`、`SearchEntry`                  |
| 函数/变量       | camelCase                          | `formatEssayDate`                       |
| 常量            | UPPER_SNAKE_CASE                   | `SITE`、`DATA_DIR`                      |
| CSS             | 优先 Tailwind；自定义类 kebab-case | `.prose-editorial`                      |
| 内容 slug       | 小写英文 kebab-case，发布后不改    | `lord-of-mysteries`                     |
| 图片文件        | 语义化小写 kebab-case              | `photo-store.jpg`、`book-guimi.jpg`     |
| 日期            | ISO `YYYY-MM-DD`                   | `2024-12-20`                            |

- 代码标识符用英文；站点文案用中文。
- 不使用中文文件名、空格、括号、版本号后缀（`final`、`new`、`v2`）。
- 发布后的 URL 不得随意更改；必须改时在 `astro.config.mjs` 增加 301 重定向并记录。

---

## 5. 代码规范

### 5.1 Astro

- 所有 `.astro` 文件使用 TypeScript 前端脚本；`interface Props` 明确声明 props。
- 组件只通过 props 接收数据，不在组件内部写死页面级数据。
- 页面 `<main>` 的唯一 ID 为 `main`；不要嵌套 `<main>`。
- 不写内联事件属性（`onclick`、`onsubmit`）；统一用 `data-*` + `addEventListener`。
- 用户输入一律用 `textContent` 输出，禁止把用户数据拼进 `innerHTML`。
- 外部链接必须带 `target="_blank"` 与 `rel="noopener noreferrer external"`。

### 5.2 TypeScript / JavaScript

- 保持 `astro/tsconfigs/strict`；不使用无理由的 `any`。
- 优先 `const`；异步用 `async/await`；错误要处理，不吞异常。
- 不在浏览器脚本里访问 Node API。
- 交互逻辑必须可重复初始化，不能依赖页面只加载一次。
- 动画与滚动监听尊重 `prefers-reduced-motion`。

### 5.3 HTML / CSS

- 使用语义标签：`header`、`nav`、`main`、`article`、`section`、`footer`。
- 每页只能有一个 `<h1>`；标题层级不跳级。
- Tailwind 优先；自定义 CSS 只放在 `src/styles/global.css` 或组件 `<style>` 中，并加注释说明用途。
- 颜色、字号、间距从 `tailwind.config.mjs` 的设计 token 取；禁止在模板里散落新的十六进制颜色。
- 图片必须有 `alt`；装饰图用 `alt=""`；内容图必须有 `width` / `height` 或明确比例。
- 禁止为了“看起来干净”全局隐藏滚动条；当前使用细滚动条样式。

### 5.4 格式与检查

提交前至少通过：

```bash
npm run format:check   # Prettier 检查（不写文件）
npm run check          # astro check（TypeScript + Astro）
npm run build          # 构建静态页与 server bundle
npm run smoke          # 启动构建产物，跑接口冒烟
npm run verify         # 上面四项的合集，发布前的总闸门
```

- `npm run format` 写入格式化结果；一次提交只做格式或只做功能，不混在一起。
- 不使用编辑器自动格式化去改无关文件。
- 本机 `$HOME` 只读，直接跑 Astro 可能因遥测写 `~/.config` 报错；`npm run verify` 与部署脚本已内置 `ASTRO_TELEMETRY_DISABLED=1`，手工执行时也可自行加上。
- CI 模板见 `.github/workflows/ci.yml`，执行同样的检查链；没有远程仓库时以本地 `npm run verify` 为准。

---

## 6. 内容规范

### 6.1 文章（随记）

- **现状**：正文在 `src/data/essays.ts`（`kind: 'essay' | 'micro'`），页面只遍历渲染。
- **目标形态**：迁移到 `src/content/essays/*.md` + `content.config.ts` 的 schema；迁移前不得新增第二份文章数据。
- frontmatter 字段（迁移后）：`title`、`date`、`category`、`readMinutes`、`tags`、`quote`、`summary`、`draft`（可选）。
- 日期使用 `YYYY-MM-DD`，展示时统一为“2024年12月20日”。
- 摘要 40–120 字；标题不堆关键词；正文段落短，适合中文长阅读。
- 草稿用 `draft: true`，不进入列表、RSS、sitemap。
- 修改已发布文章的 slug 必须加 301；不得静默换地址。

### 6.2 图片与素材

- 内容图必须有描述性 `alt`；照片可加拍摄地点、时间、器材说明。
- 页面展示图统一放 `public/images/`；封面生成脚本放 `scripts/` 并纳入版本控制（当前仍在 `stitch-assets/`，见附录 A）。
- 图片版权必须可追溯：自有、授权、Unsplash 等；在 `docs/ASSETS.md` 记录来源与许可证（尚未建立，见附录 A）。
- 不使用来源不明的网图、书籍封面扫描件或明星照片作为站点素材。
- 设计参考稿 `stitch_astro_personal_website/` 只作为参考，不直接作为线上素材来源。

### 6.3 文案与语气

- 中文为主，语气克制、具体，少用营销词和空泛排比。
- 示例内容必须标注为示例；上线前替换为真实内容，或明确保留为演示。
- 不使用“最”“第一”“保证”等无法证实的表述。
- 页面标题、描述、OG 文案必须与正文一致。

### 6.4 留言

- 公开留言入库即 `approved`，直接上墙；悄悄话入库为 `pending`，只有 `/admin/` 的「留言」或 `/api/admin/*` 可见。
- 房主可在 `/admin/` 的「留言」审核（通过 / 隐藏 / 删除）、回复并导出 JSON / CSV；`hidden` 仅后台可见。
- 内容后台 `/admin/` 用用户名 + 密码登录（HttpOnly cookie），导航管理影集 / 随笔 / 书架 / 唱片 / 曲目 / 台词 / 友链；数据在 `content.sqlite`，上传文件在 `/data/uploads`。
- 留言禁止 HTML；前端只用 `textContent` 渲染，禁止拼 `innerHTML`。
- 不收集邮箱、手机号、身份证等敏感信息；留言无需登录；订阅只收邮箱。
- 在启用 HTTPS 之前，页面必须提示“请勿在留言中填写敏感信息”，管理后台只应在可信网络使用。

### 6.5 外链

- 网文统一跳起点中文网对应书页；音乐统一跳酷狗；外部社交链接指向真实主页。
- 外链定期抽查，失效链接及时替换。
- 外链不得伪装成站内链接；带外链图标或明确文案。

---

## 7. 数据规范

- `src/data/` 是书籍、专辑、曲目、照片、台词、随笔的单一来源；账号歌单改为运行时同步，不再落静态数据。
- `src/data/search.ts` 必须从其他数据与文章集合**自动生成**，不再手工维护重复摘要。
- 账号歌单：`/api/kugou/playlist` 运行时用 `KUGOU_PLAYLIST_NAME`（默认 `maotouying`）从酷狗拉取，服务端内存缓存 60 秒；`/api/kugou/url` 的白名单来自这份缓存（另保留 `src/data/music.ts` 里首页/专辑精选的曲目），新增歌曲约 1 分钟内可播放。
- 数据字段命名统一 camelCase；日期用 ISO 字符串；URL 用完整绝对地址。
- `id` / `slug` 必须稳定，不随展示文案变化。
- 页面不直接内嵌数据数组；通过 `import` 使用。
- 站点数据与内容分离：留言、订阅、限流在服务器 SQLite 卷（`letters` / `subscribers` / `rate_limits`），不进仓库；本地开发默认写 `.data/guestbook.sqlite`。
- 任何数据迁移必须提供一次性脚本（现有：`scripts/import-guestbook-json.mjs`），并在提交信息中说明。
- 数据库访问只走 `src/lib/guestbook-db.ts` / `src/lib/newsletter-db.ts`，页面与 API 不直接写 SQL。

---

## 8. 样式与设计系统

- 设计 token 以 `tailwind.config.mjs` 与 `src/styles/global.css` 为准，包括颜色、字号、间距、圆角。
- 字体：Newsreader、Space Grotesk、Material Symbols 子集全部自托管；不引入 Google Fonts 运行时请求。
- 断点：Tailwind 默认 `sm 640 / md 768 / lg 1024 / xl 1280`，移动优先。
- 间距使用 token（`space-xs`…`space-xl`、`gutter`），不随手写新数值。
- 交互动效时长 0.2–0.7s；不使用无意义的持续动画；`prefers-reduced-motion` 下关闭。
- 当前站点是浅色纸感主题；新增暗色模式必须先补设计 token，不得临时反色。
- 可访问性目标：正文对比度 ≥ 4.5:1，大字 ≥ 3:1；键盘可到达所有交互；焦点可见。

---

## 9. 性能与可访问性

### 9.1 预算（提案）

| 指标                          | 目标                    |
| ----------------------------- | ----------------------- |
| Lighthouse 移动端 Performance | ≥ 90                    |
| Accessibility                 | ≥ 95                    |
| Best Practices                | ≥ 95                    |
| SEO                           | ≥ 95                    |
| 首屏 JS（gzip）               | ≤ 50 KB                 |
| CSS（gzip）                   | ≤ 80 KB                 |
| 字体（首屏实际加载）          | ≤ 250 KB                |
| 单张内容图                    | ≤ 300 KB，长边 ≤ 1800px |

- 首屏图片 `loading="eager"` + `fetchpriority="high"`；其余懒加载。
- 图片优先 WebP/AVIF；保留原图时单独放目录，不直接进首屏。
- 不引入第三方统计脚本；如确需统计，优先自托管、无 Cookie 方案，并更新本文件。

### 9.2 可访问性

- 所有图片有 `alt`；表单控件有 `<label>` 或 `aria-label`。
- 弹窗 / 搜索 / 移动菜单支持 Esc 关闭，焦点可返回触发按钮。
- 链接文字不能只有“点击这里”；外链图标需 `aria-hidden`。
- 颜色不能是唯一的信息载体；标签、状态需有文字。
- 每季度做一次键盘走查和移动端抽查。

---

## 10. Git 与协作

### 10.1 仓库与备份（最重要）

- **必须有私有远程仓库**（GitHub / Gitee / GitLab 均可），并配置 `origin`。
- 每个工作时段结束前 `git push`；不允许长期只存在本地。
- 服务器只存构建产物，不作为源码备份。
- 重大版本打 tag：`v0.1.0`、`v0.2.0`。
- 没有远程仓库之前，不得开始结构性重构。

### 10.2 分支

- 默认分支：`main`（迁移后改名；当前为 `master`）。
- 日常内容更新可直接提交 `main`；结构性改动用分支：
  - `feat/…` 新功能
  - `fix/…` 修复
  - `content/…` 内容批量更新
  - `refactor/…` 重构
  - `docs/…` 文档
  - `security/…` 安全加固
- 合并前至少自测、构建、预览；高风险改动需要截图对比。

### 10.3 提交信息

采用 `type(scope): summary`：

```text
feat(reading): link novel cards to Qidian
fix(guestbook): handle API rate limit response
content(essays): add autumn walk notes
docs: add project rules
security(nginx): rate-limit guestbook API
```

- 一次提交只做一件事；不把格式化、内容、重构混在一起。
- 不提交密钥、密码、服务器私钥、`.env`。
- 不回滚他人的提交；需要时用 revert，不 force-push 共享分支。

### 10.4 发布

- 发布前：`npm run verify`（格式 + 类型 + 构建 + 接口冒烟）、`npm run preview`、人工检查关键页。
- 发布必须走 `npm run deploy:docker`（默认 8080 预验证），确认后 `WEB_PORT=80 npm run deploy:docker`；不手工改服务器文件，紧急情况事后补回仓库。
- 发布后：验证首页、五个栏目、详情页、RSS、sitemap、留言/统计/订阅 API、管理端 401。
- 回滚：`git revert` 或切到上一个 tag 后重新部署；如需退回旧 PHP 站，见 11.1 的回滚步骤，数据库卷不受影响。

---

## 11. 部署与服务器

### 11.1 部署流程

1. 本地 `npm run verify` 通过；
2. `npm run deploy:docker` 发到 8080（不碰正式端口）：构建 → rsync `dist/`、`vendor/`、编排与运维脚本 → 远程 `docker compose build app && up -d` → 探活；
3. 逐页验证 8080，重点看 `/guestbook/`、`/admin/`、`/reading/` 与 `/api/*`；
4. `WEB_PORT=80 npm run deploy:docker` 切正式端口（宿主 nginx 已停用）；
5. 部署脚本幂等安装 `/etc/cron.d/fengyu` 与 `/etc/logrotate.d/fengyu`；
6. 回滚应用：重新部署上一个 tag；回滚到旧站：`cd /opt/fengyu && docker compose down && systemctl enable --now nginx`。

### 11.2 服务器规则

- 源码、`.git`、`node_modules` 不上服务器；服务器只保留 `dist/`、`vendor/`、`docker/`、`deploy/`、`scripts/`、`docker-compose.yml` 与 `.env`。
- 部署目录 `/opt/fengyu` 归 root；`.env` 权限 600，只存 `ADMIN_TOKEN` 与 `KUGOU_*`。
- 数据只在命名卷 `fengyu_guestbook-data` 中；不要在容器外手工改库，改动前先备份。
- 不新增公网端口：对外只有 80（xray 占用 443，不要动）。
- 容器以最小权限运行：`cap_drop: ALL`、`no-new-privileges`、只挂载必要目录；`web` 对 `dist` 只读。
- 服务器上的手工修改必须在 24 小时内回写仓库，否则视为事故。
- nginx 容器配置以 `deploy/nginx.container.conf` 为准，编排以 `docker-compose.yml` 为准；部署脚本必须可重复执行。

### 11.3 备份

- 源码：远程 Git（必须；当前仍缺，见附录 A）。
- 站点数据：`/opt/fengyu/scripts/backup-guestbook.sh` 每日 04:17 用 `VACUUM INTO` 备份到 `/opt/fengyu/backups/`，保留 7 天。
- 配置：`docker-compose.yml`、`deploy/` 随部署同步；`.env` 另存密码管理器。
- 至少每月把一份备份拉到本地/对象存储做异地备份；备份与源库同盘时，同盘故障会一起丢失。
- 恢复流程：先 `PRAGMA integrity_check` 校验，再停止 app、替换数据卷文件、启动并验证；每季度演练一次。

### 11.4 安全

- SSH 只允许密钥；fail2ban、UFW 保持开启；不随意开放端口。
- 接口防护：管理端会话 cookie / Bearer Token（`timingSafeEqual` 比较）、普通 API 16 KB 请求体上限（`/api/admin/upload` 单独 10 MB）、留言每 IP 60 秒一次、订阅 5 次/10 分钟、nginx 粗粒度限流、蜜罐字段、SQL 全部参数化。
- `ADMIN_TOKEN` 未配置时留言管理接口统一 503；`ADMIN_USER` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` 未配置时内容后台登录返回 503；公开接口不返回私密留言与 `ip_hash`；`/api/content/search` 只返回公开内容。
- 不在 HTTP 下收集敏感信息；HTTPS 未启用前，管理后台只应在可信网络使用，留言页保留提示。
- 酷狗登录态等价于账号凭据：建议使用专用小号、不绑定支付；泄露或失效时清空服务器 `.env` 中的 `KUGOU_*` 并重建 app。
- 服务器密钥、xray UUID、任何 token 不进入仓库、不贴聊天记录；泄露后立即轮换。
- 安全响应头（nosniff、X-Frame-Options、Referrer-Policy、Permissions-Policy）由 nginx 统一加；CSP 待评估后补。
- 系统与依赖安全更新每月检查，重大漏洞及时升级并记录。

---

## 12. 测试与验收

### 12.1 每次发布的人工检查

- [ ] 首页、读听、影集、随记、留言、详情页、404
- [ ] 移动端 390px 无横向溢出
- [ ] 搜索可打开/关闭，结果可跳转
- [ ] 筛选按钮生效
- [ ] 网文卡片外链正确
- [ ] 留言公开/私密提交与提示
- [ ] RSS / sitemap 可解析
- [ ] 无控制台报错、无缺失图片
- [ ] 部署后服务器 200、日志无异常

### 12.2 自动化

已落地（`npm run verify`）：

- `npm run format:check`：Prettier 格式检查（Astro / TS / CSS / Markdown / 配置）；
- `npm run check`：`astro check`（TypeScript + Astro + 页面内联脚本）；
- `npm run build`：静态页与 server bundle；
- `npm run smoke`：`scripts/smoke-test.mjs` 拉起构建产物，用临时 SQLite 验证页面 200、留言公开/悄悄话、限流、管理端鉴权与审核、订阅幂等与导出、酷狗歌单接口。

待补：

- Playwright 视觉与关键交互测试、链接检查、Lighthouse；
- 远程仓库接通后由 `.github/workflows/ci.yml` 自动执行同一套检查。

### 12.3 完成定义（DoD）

一个改动只有同时满足以下条件才算完成：

- 符合本规范；偏离有记录
- `npm run verify` 通过
- 移动端与桌面端检查通过
- 无新增控制台错误、无死链
- 文档 / 内容说明已更新
- 已提交（有远程仓库后必须推送）
- 部署后线上验证通过

---

## 13. 文档

- `README.md`：快速开始、结构、部署、服务器事实。
- `docs/PROJECT_RULES.md`：本文件。
- `docs/DECISIONS.md`：结构性决策（ADR），每次一个条目。
- `docs/FEATURES.md`：功能契约、接口表与验收清单；契约变更先改这里。
- `docs/ASSETS.md`：图片、字体、图标来源与许可证（待建立）。
- `scripts/smoke-test.mjs` 与 `.github/workflows/ci.yml`：自动化校验入口；改动接口时要同步更新冒烟测试。
- 行为变化必须同步 README 或相关文档；不允许“代码改了文档不管”。

---

## 14. 变更管理与豁免

- 本规范由项目所有者确认后生效；v0.2 于 2026-10-25 按当前实现对齐后生效。
- 现有不符合项列入附录 A，按阶段处理；在迁移完成前不强制一次性整改。
- 任何新代码从生效日起遵守规范。
- 临时绕过规范必须在提交信息写 `EXCEPTION:` 并说明原因、期限、回滚方式。
- 规范本身修改需单独提交 `docs:`，并记录版本号。

---

## 15. 分阶段计划

### 已完成（截至 2026-10-25）

- 内容数据化：`books` / `music` / `photos` / `quotes` / `essays`；账号歌单改为运行时同步；
- 搜索索引构建期自动生成；
- `/admin/` 审核、回复、导出；`/api/stats`、`/api/subscribe`；
- 酷狗歌单同步与站内播放（登录态在服务器 `.env`）；
- Docker Compose 部署、每日备份、探活、cron / logrotate；
- `.editorconfig`、Prettier、`astro check`、`scripts/smoke-test.mjs`、`npm run verify`、GitHub Actions 模板；
- 站点技能文档（`.dsh/skills/fengyu-site/SKILL.md`）。

### 下一步（按优先级）

1. 建立私有远程仓库并推送全部历史，默认分支改为 `main`（最高优先）；
2. 生成 `docs/ASSETS.md`，记录字体、图标、封面、照片来源与许可证；
3. 把 `stitch-assets/make-covers.py` 移入 `scripts/` 并纳入版本控制；
4. 拆分 `guestbook` / `index` / `reading` / `admin` 的超大页面为组件（见附录 A）；
5. 随记迁移到 Content Collections；
6. Playwright 视觉/交互测试、链接检查、Lighthouse；
7. 域名 + HTTPS（443 与 xray 做 SNI 分流）；
8. 异地备份与恢复演练。

---

## 16. 待确认事项

请项目所有者确认：

1. 远程仓库用 GitHub、Gitee 还是 GitLab？仓库地址？
2. 默认分支是否改为 `main`？
3. 是否已有域名？是否要上 HTTPS？（443 目前被 xray 占用）
4. 留言继续保持“公开自动上墙、悄悄话只后台可见”，还是改为“审核后上墙”？
5. 是否同意删除或归档 `_trial/`、`_scratch/`？
6. 图片/字体是否保留当前来源，还是全部换成自有素材？
7. 是否接受“页面文件 ≤ 200 行、组件 ≤ 150 行”的硬性拆分线？
8. 异地备份放在哪里（对象存储 / 本地 NAS / 另一台服务器）？
9. 酷狗是否换专用小号，登录态多久轮换一次？

---

## 附录 A · 当前技术债

| 项               | 现状                                                                                   | 处理阶段       |
| ---------------- | -------------------------------------------------------------------------------------- | -------------- |
| 无远程仓库       | 只有本地 `.git`，无 `origin`                                                           | 最高优先       |
| 远程 CI 未接通   | 本地 `npm run verify` + Actions 模板已就绪                                             | 接通远程仓库后 |
| 页面过大         | `admin/index` 约 768 行、`guestbook` 约 718 行、`index` 约 462 行、`reading` 约 415 行 | 第二阶段       |
| 组件过少         | 只有 Header、Footer、Player、TrackRow、PhotoLightbox                                   | 第二阶段       |
| 内联脚本         | 页面 `<script>` 已通过类型检查，但未抽到 `src/scripts/`                                | 第二阶段       |
| 随记仍是 TS 数据 | 尚未迁移 Content Collections                                                           | 第二阶段       |
| 素材许可证未记录 | 字体 OFL、示例图片、封面来源未集中记录                                                 | 第一阶段       |
| 生成脚本未入库   | `make-covers.py` 仍在 ignored 的 `stitch-assets/`                                      | 第一阶段       |
| 示例内容         | 书、歌、照片、友链仍以示例素材为主                                                     | 内容阶段       |
| 备份未异地       | 备份与源库同盘                                                                         | 运维阶段       |
| HTTP             | 站点、管理后台、酷狗直链均为明文                                                       | 待域名/443     |
| 酷狗依赖         | 非官方接口 + 账号登录态，可能随时失效                                                  | 持续           |
| 无视觉回归       | 只有接口/页面冒烟，无截图对比与链接检查                                                | 第三阶段       |

---

## 附录 B · 规范版本记录

| 版本 | 日期       | 变更                                                                                                                                                                            |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1 | 2026-10-24 | 初稿，待确认                                                                                                                                                                    |
| v0.2 | 2026-10-25 | 按 ADR-001/002/003/004 对齐 Docker + Node + SQLite 架构；更新目录、部署、备份、安全章节；删除过期 PHP/JSON 描述；补充 `npm run verify` 自动化与 CI 模板；刷新技术债与分阶段计划 |
