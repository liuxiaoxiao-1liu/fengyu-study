# 风屿书房 · 项目规范

> 版本：v0.1（提案）
> 日期：2026-10-24
> 状态：**待确认**。确认后从下一项改动开始执行；在此之前只作为评审稿，不追溯修改已完成的工作。
> 适用：本地仓库、构建产物、部署脚本、服务器上的站点与留言接口、站点内容与素材。
>
> **2026-10-24 架构更新**：留言后端已按 [DECISIONS.md](DECISIONS.md) 的 ADR-001 迁移为 Astro API + SQLite + Docker。第 1.2、2.1、11 节中与 PHP / JSON 文件相关的描述，在留言接口范围内以 ADR-001 为准；规范正文待后续统一修订。

---

## 0. 先读这里

- 这份文件定义“以后怎么做”，不是对现有代码的判决书。
- 现有代码里不符合本规范的地方，统一列入《附录 A · 当前技术债》，按阶段迁移，不做一次性大重写。
- **任何偏离本规范的做法，必须在提交信息或 `docs/DECISIONS.md` 里写清原因、影响和回滚方式。**
- 规范优先级：安全与数据完整性 > 可回滚 > 可维护性 > 视觉还原 > 开发速度。
- “能跑”不等于“完成”。完成的定义见第 13 节。

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
  Astro 构建（Node）
        │  npm run build
        ▼
      dist/（纯静态 HTML / CSS / JS / 图片 / 字体）
        │  ./deploy.sh  → rsync
        ▼
服务器 example.com
  nginx :80  ── 直接返回 /var/www/xiaoquanzi 的静态文件
  php-fpm    ── 只处理 /api/guestbook
  xray :443  ── 独立代理服务，不属于本站代码
```

**服务器上不安装、不运行 Node / Astro。** 服务器不存放源码和 `.git`。

### 1.3 关键事实

| 项 | 值 |
| --- | --- |
| 本地技术栈 | Astro 7.4.2 + Tailwind CSS 3.4.17 + PostCSS 8 + Autoprefixer 10 |
| 包管理器 | npm，锁文件 `package-lock.json` 必须提交 |
| 服务器 | Ubuntu 24.04 / nginx 1.24 / PHP 8.3 / xray 443 |
| 站点根目录 | `/var/www/xiaoquanzi` |
| 留言 API | `/var/www/xiaoquanzi-api/guestbook.php` |
| 留言数据 | `/var/lib/xiaoquanzi/guestbook.json`（web 根目录之外） |
| 访问方式 | 目前 `http://example.com/`，尚未启用 HTTPS |
| 部署入口 | 根目录 `./deploy.sh` |

---

## 2. 技术栈与版本

### 2.1 允许的运行时

- **Node.js**：只用于本地开发和构建；版本 ≥ 22.23.4（Astro 7 要求）。当前本机 v26.11.1。
- **PHP**：只用于 `/api/guestbook`，服务器 PHP 8.3。
- **nginx**：只做静态托管和单一路由转发。
- **不允许**在服务器上新增 Node 进程、数据库、Redis、Docker 站点容器，除非单独评审并写 ADR。

### 2.2 依赖规则

- 新依赖必须满足：确实需要、维护活跃、许可证可接受、不会显著增加构建体积。
- 禁止在运行时依赖外部 CDN（Tailwind CDN、Google Fonts、远程图片、远程图标）。字体与图标必须自托管。
- 禁止同时混用 npm / pnpm / yarn；本仓库统一 npm。
- 升级主版本（Astro、Tailwind、PHP）必须单独提交、单独验证、可回滚。
- 新增依赖后必须提交 `package-lock.json`。

### 2.3 浏览器与设备

- 支持最近两个版本的 Chrome、Edge、Firefox、Safari；iOS Safari 16+。
- 必测宽度：360、390、768、1024、1440。
- 不要求 IE、不支持无 JavaScript 时的完整交互，但核心内容必须在无 JS 时可读。

---

## 3. 目录规范

### 3.1 当前结构（迁移前）

```text
src/
  components/   Header、Footer
  data/         essays、search
  layouts/      BaseLayout
  lib/          site、xml
  pages/        首页、读听、影集、随记、留言、404、rss、sitemap
  styles/       fonts、icons、global
public/         图片、字体、og、robots
deploy/         nginx.conf、guestbook.php
deploy.sh
```

### 3.2 目标结构

```text
src/
  components/
    site/        Header、Footer、SearchDialog
    home/        Hero、ShelfCard、MusicCard、VisualCard、NotesCard、Stats、LetterboxPreview
    reading/     FilterBar、NovelCard、AlbumCard、MonthlyReport
    photos/      PhotoGrid、PhotoCard
    essays/      EssayCard、Sidebar、Newsletter
    guestbook/   LetterForm、LetterCard、BottleDialog
  content/
    essays/      *.md
  content.config.ts
  data/          books.ts、albums.ts、photos.ts、site.ts、search.ts（自动生成）
  layouts/       BaseLayout
  lib/           纯函数、格式化、常量
  pages/         只负责路由与页面组装
  scripts/       filters.ts、guestbook.ts、search.ts
  styles/        fonts.css、icons.css、global.css
scripts/
  make-covers.py
  deploy.sh（如迁入，需同步 README 与 npm script）
deploy/
  nginx.conf
  guestbook.php
tests/
  smoke.spec.ts
docs/
  PROJECT_RULES.md
  ARCHITECTURE.md（需要时）
  DECISIONS.md（需要时）
```

### 3.3 目录规则

- `src/pages/` 只做路由、数据获取和组件组装，**不写大段业务逻辑和重复卡片 HTML**。
- 页面文件超过 **200 行** 必须拆分组件；组件超过 **150 行** 考虑继续拆分。
- `src/data/` 是内容数据的唯一来源。书籍、专辑、照片、友链、留言种子不得同时写在多个地方。
- `src/scripts/` 存放浏览器端交互；页面里的 `<script>` 只允许极短的启动代码。
- `src/lib/` 只放无副作用的纯函数与类型，不放 UI。
- `public/` 只放需要按原路径服务的文件；源素材、生成脚本、设计稿放 `assets-src/` 或 `scripts/`，不要混进 `public/`。
- `deploy/` 只放服务器侧配置；不得放密钥、密码、UUID。
- 文档统一放 `docs/`，根目录只保留 README、许可证和必要配置。

---

## 4. 命名规范

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 目录 | 小写 kebab-case | `photo-journal/`、`guestbook/` |
| Astro 组件 | PascalCase | `NovelCard.astro`、`SearchDialog.astro` |
| 页面路由 | 小写 kebab-case | `reading.astro`、`essays/[slug].astro` |
| TS 文件 | 小写 camelCase 或 kebab-case | `site.ts`、`format-date.ts` |
| 导出的类型/接口 | PascalCase | `Essay`、`SearchEntry` |
| 函数/变量 | camelCase | `formatEssayDate` |
| 常量 | UPPER_SNAKE_CASE | `SITE`、`DATA_DIR` |
| CSS | 优先 Tailwind；自定义类 kebab-case | `.prose-editorial` |
| 内容 slug | 小写英文 kebab-case，发布后不改 | `lord-of-mysteries` |
| 图片文件 | 语义化小写 kebab-case | `photo-store.jpg`、`book-guimi.jpg` |
| 日期 | ISO `YYYY-MM-DD` | `2024-12-20` |

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

迁移完成后统一执行：

```bash
npm run format      # Prettier 写入
npm run format:check
npm run check       # astro check（TypeScript + Astro）
npm run build
```

- 提交前至少通过 `format:check`、`check`、`build`。
- 不使用编辑器自动格式化去改无关文件；一次提交只做一件事。

---

## 6. 内容规范

### 6.1 文章（随记）

- 目标形态：`src/content/essays/*.md` + `content.config.ts` 的 schema。
- frontmatter 字段：`title`、`date`、`category`、`readMinutes`、`tags`、`quote`、`summary`、`draft`（可选）。
- 日期使用 `YYYY-MM-DD`，展示时统一为“2024年12月20日”。
- 摘要 40–120 字；标题不堆关键词；正文段落短，适合中文长阅读。
- 草稿用 `draft: true`，不进入列表、RSS、sitemap。
- 修改已发布文章的 slug 必须加 301；不得静默换地址。

### 6.2 图片与素材

- 内容图必须有描述性 `alt`；照片可加拍摄地点、时间、器材说明。
- 页面展示图统一放 `public/images/`；封面生成脚本放 `scripts/make-covers.py` 并纳入版本控制。
- 图片版权必须可追溯：自有、授权、Unsplash 等；在 `docs/ASSETS.md` 记录来源与许可证。
- 不使用来源不明的网图、书籍封面扫描件或明星照片作为站点素材。
- 设计参考稿 `stitch_astro_personal_website/` 只作为参考，不直接作为线上素材来源。

### 6.3 文案与语气

- 中文为主，语气克制、具体，少用营销词和空泛排比。
- 示例内容必须标注为示例；上线前替换为真实内容，或明确保留为演示。
- 不使用“最”“第一”“保证”等无法证实的表述。
- 页面标题、描述、OG 文案必须与正文一致。

### 6.4 留言

- 公开留言目前自动上墙；若出现刷屏，改为“审核后上墙”，并在本文件更新策略。
- 悄悄话只存服务器，不在 API 中返回。
- 留言禁止 HTML；前端只用 `textContent` 渲染。
- 不收集邮箱、手机号、身份证等敏感信息；留言无需登录。
- 在启用 HTTPS 之前，页面必须提示“请勿在留言中填写敏感信息”。

### 6.5 外链

- 网文统一跳起点中文网对应书页；音乐统一跳酷狗；外部社交链接指向真实主页。
- 外链定期抽查，失效链接及时替换。
- 外链不得伪装成站内链接；带外链图标或明确文案。

---

## 7. 数据规范

- `src/data/` 是书籍、专辑、照片、友链、留言种子的单一来源。
- `src/data/search.ts` 必须从其他数据与文章集合**自动生成**，不再手工维护重复摘要。
- 数据字段命名统一 camelCase；日期用 ISO 字符串；URL 用完整绝对地址。
- `id` / `slug` 必须稳定，不随展示文案变化。
- 页面不直接内嵌数据数组；通过 `import` 使用。
- 留言数据与站点种子分离：`/var/lib/xiaoquanzi/guestbook.json` 由服务器维护，不进仓库。
- 任何数据迁移必须提供一次性脚本，并在提交信息中说明。

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

| 指标 | 目标 |
| --- | --- |
| Lighthouse 移动端 Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 95 |
| 首屏 JS（gzip） | ≤ 50 KB |
| CSS（gzip） | ≤ 80 KB |
| 字体（首屏实际加载） | ≤ 250 KB |
| 单张内容图 | ≤ 300 KB，长边 ≤ 1800px |

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

- 发布前：`npm run check`、`npm run build`、`npm run preview`、人工检查关键页。
- 发布必须走 `./deploy.sh`；不手工改服务器文件，紧急情况事后补回仓库。
- 发布后：验证首页、五个栏目、详情页、RSS、sitemap、留言 API、404。
- 回滚：`git revert` 或切到上一个 tag，重新执行 `./deploy.sh`；服务器数据不受影响。

---

## 11. 部署与服务器

### 11.1 部署流程

1. 本地构建与预览通过
2. `./deploy.sh`
3. 上传 nginx 配置、PHP API
4. rsync `dist/` 到 `/var/www/xiaoquanzi`（root:root，D755/F644）
5. nginx 配置测试 + reload
6. 验证首页 / RSS / sitemap / 留言 API

### 11.2 服务器规则

- 源码、`.git`、`node_modules` 不上服务器。
- web 根目录对 `www-data` 只读；留言数据目录只允许 `www-data` 写。
- 不新增公网端口；UFW 默认拒绝。
- 服务器上的手工修改必须在 24 小时内回写仓库，否则视为事故。
- nginx 配置、PHP 脚本以 `deploy/` 为准；部署脚本必须可重复执行。

### 11.3 备份

- 源码：远程 Git（必须）。
- 站点数据：定期备份 `/var/lib/xiaoquanzi/guestbook.json` 和 `deploy/`。
- 建议保留最近 7 天 / 4 周的备份；至少异地一份。
- 恢复演练每季度一次。

### 11.4 安全

- SSH 只允许密钥；密码登录关闭；root 登录仅密钥。
- fail2ban、UFW 保持开启；不随意开放端口。
- 留言接口：固定单文件、输入长度限制、频率限制、蜜罐、无 `eval`/`include`/SQL、数据在 web 根目录外。
- 系统安全更新每月检查；重大漏洞及时升级并记录。
- 不在 HTTP 下收集敏感信息；HTTPS 未启用前，留言页保留提示。
- 服务器密钥、xray UUID、任何 token 不进入仓库、不贴聊天记录。

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

### 12.2 自动化（迁移目标）

- `astro check` 类型检查
- Prettier 格式检查
- Playwright 冒烟测试（页面 200、关键交互、外链存在）
- 链接检查
- Lighthouse（手动或 CI）

### 12.3 完成定义（DoD）

一个改动只有同时满足以下条件才算完成：

- 符合本规范；偏离有记录
- 构建通过，关键页面预览通过
- 移动端与桌面端检查通过
- 无新增控制台错误、无死链
- 文档 / 内容说明已更新
- 已提交并推送远程
- 部署后线上验证通过

---

## 13. 文档

- `README.md`：快速开始、结构、部署、服务器事实。
- `docs/PROJECT_RULES.md`：本文件。
- `docs/DECISIONS.md`：结构性决策（ADR），每次一个条目。
- `docs/ASSETS.md`：图片、字体、图标来源与许可证。
- 行为变化必须同步 README 或相关文档；不允许“代码改了文档不管”。

---

## 14. 变更管理与豁免

- 本规范由项目所有者确认后生效。
- 现有不符合项列入附录 A，按阶段处理；在迁移完成前不强制一次性整改。
- 任何新代码从生效日起遵守规范。
- 临时绕过规范必须在提交信息写 `EXCEPTION:` 并说明原因、期限、回滚方式。
- 规范本身修改需单独提交 `docs:`，并记录版本号。

---

## 15. 审批后立即执行（第一阶段）

不改变页面视觉，只做低风险整理：

1. 建立私有远程仓库，推送全部历史；默认分支改为 `main`
2. 添加 `.editorconfig`、Prettier 配置
3. 添加 `npm run format` / `format:check` / `check`
4. 把 5 个页面的内联脚本抽到 `src/scripts/`
5. 把 `stitch-assets/make-covers.py` 移入 `scripts/` 并纳入版本控制
6. 生成 `docs/ASSETS.md`（字体、图标、封面、照片来源）
7. 用现有页面做一次基线截图，后续重构对照

第二阶段（结构）：

- 拆分 `index` / `reading` / `guestbook` / `photos` / `essays` 为组件
- 书籍、专辑、照片移入 `src/data/`
- 搜索索引自动生成
- 随记迁移到 Content Collections

第三阶段（质量）：

- Playwright 冒烟测试、GitHub Actions
- 图片优化、Lighthouse、可访问性走查
- 自动备份与部署

---

## 16. 待确认事项

请项目所有者确认：

1. 远程仓库用 GitHub、Gitee 还是 GitLab？仓库地址？
2. 默认分支是否改为 `main`？
3. 是否已有域名？是否要上 HTTPS？（443 目前被 xray 占用）
4. 留言是否继续保持“公开自动上墙”，还是改为“审核后上墙”？
5. 是否同意删除 `_trial/`（104MB 旧 Hugo 试验）或归档？
6. 图片/字体是否保留当前来源，还是全部换成自有素材？
7. 是否接受“页面文件 ≤ 200 行、组件 ≤ 150 行”的硬性拆分线？

---

## 附录 A · 当前技术债

| 项 | 现状 | 处理阶段 |
| --- | --- | --- |
| 无远程仓库 | 只有本地 `.git` | 第一阶段（最高优先） |
| 页面过大 | `guestbook.astro` 713 行、`reading.astro` 472 行、`index.astro` 360 行 | 第二阶段 |
| 组件过少 | 只有 Header、Footer | 第二阶段 |
| 内容硬编码 | 书、歌、照片、留言写在页面 HTML 里 | 第二阶段 |
| 搜索重复维护 | `search.ts` 手写摘要，与页面内容重复 | 第二阶段 |
| 内联脚本 | 5 个页面各有一段 `<script>` | 第一阶段 |
| 无类型检查/格式检查 | 依赖 Astro 构建，没有 `astro check` / Prettier | 第一阶段 |
| 无测试/CI | 只有人工验收 | 第三阶段 |
| 生成脚本未入库 | `make-covers.py` 在 ignored 目录 | 第一阶段 |
| 素材许可证未记录 | 字体 OFL、示例图片、AI 封面来源未集中记录 | 第一阶段 |
| 旧试验目录 | `_trial/` 104MB | 待确认 |
| HTTP | 站点和留言均为明文 | 待确认（需域名/443） |

---

## 附录 B · 规范版本记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v0.1 | 2026-10-24 | 初稿，待确认 |
