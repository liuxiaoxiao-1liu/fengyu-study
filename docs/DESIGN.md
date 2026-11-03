# 设计规范 · 风屿书房

> v1.0（2026-11）。本文件是 UI 的唯一事实来源：颜色、字号、间距、圆角、组件状态。
> 改动页面时先查这里，不要新增临时色值和字号。

## 0. 设计立场

- 方向：**暖纸编辑风**（Warm Editorial）。纸感底色、衬线标题、细线、克制的暖色强调。
- 一句话：**像一本可以翻的刊物，不像一个组件演示页。**
- 反例（明确不做）：卡片套卡片、每个区块都带英文小标签、大面积阴影、渐变文字、玻璃拟态、AI 紫光。
- 层级原则：**一个视口只允许一个主视觉**；次要信息靠字号、字距和留白退后，不靠再叠一层卡片。

## 1. 颜色 token

| Token                      | 值                   | 用途                                   |
| -------------------------- | -------------------- | -------------------------------------- |
| `bg` / `surface`           | `#fcf9f4`            | 页面底色（暖纸，不是纯白）             |
| `surface-container-low`    | `#f6f3ee`            | 卡片、次级面板                         |
| `surface-container`        | `#f0ede9`            | 卡片内嵌块、表单底                     |
| `surface-container-high`   | `#e7e1d8`            | 标签、选中态、分隔块                   |
| `surface-container-lowest` | `#fffdfa`            | 输入框、需要“浮起来”的纸片             |
| `ink` / `on-surface`       | `#1c1c19`            | 标题与正文                             |
| `muted`                    | `#6b625d`            | 次要文字（≥14px 或小字，对比度 5.7:1） |
| `muted-2` / `outline`      | `#6f6560`            | 图标、三级文字（5.4:1）                |
| `accent` / `tertiary`      | `#a94d2c`            | 暖陶土：链接、强调、当前态（5.3:1）    |
| `accent-decor`             | `#c86d51`            | 仅装饰：下划线、焦点环、左边线         |
| `sage` / `secondary`       | `#4f6152`            | 状态色：成功、在线、标签（6.1:1）      |
| `line`                     | `rgba(28,28,25,.10)` | 发丝线（卡片、分隔）                   |
| `line-strong`              | `rgba(28,28,25,.18)` | 需要看清的边框                         |
| `inverse`                  | `#1c1c19`            | 反白纸：订阅卡、播放器、主按钮         |
| `on-inverse`               | `#f3f0eb`            | 反白纸上的文字                         |

规则：

1. 一个页面一个强调色；`accent` 出现面积不超过视口的 5%。
2. 不用纯 `#fff` / `#000`；需要更亮时用 `#fffdfa`，更深用 `#141110`。
3. 正文对比度 ≥ 4.5:1，大字号 ≥ 3:1；占位符按正文标准。
4. 边框只用半透明发丝线，不用实色灰线。
5. 阴影一律带暖色（`rgba(42,36,33,…)`），且只给浮层：Header、播放器、搜索框。

## 2. 字号阶梯（只允许 6 档）

| 角色     | 类                              | 尺寸                            | 行高 | 字距     |
| -------- | ------------------------------- | ------------------------------- | ---- | -------- |
| 展示     | `text-display`                  | `clamp(2.25rem, 4.6vw, 3.5rem)` | 1.05 | -0.02em  |
| 栏目标题 | `text-headline-lg`              | `clamp(1.75rem, 3vw, 2.5rem)`   | 1.15 | -0.015em |
| 区块标题 | `text-headline-md`              | `clamp(1.35rem, 2vw, 1.75rem)`  | 1.3  | -0.01em  |
| 正文     | `text-body-lg` / `text-body-md` | 1.1875 / 1.0625rem              | 1.8  | 0        |
| 小正文   | `text-body-sm`                  | 0.9375rem                       | 1.65 | 0        |
| 元信息   | `text-label-sm` / `text-meta`   | 0.75 / 0.6875rem                | 1.45 | 0.04em   |

规则：中文标题不加 letter-spacing；英文小标签才加；每 3 个区块最多 1 个英文 eyebrow。

## 3. 间距与圆角

- 横向容器：`max-w-7xl`（1280）或 `max-w-6xl`（1152），左右 `px-gutter`（24px，移动端 20px）。
- 区块纵向：`py-section` = `clamp(2.75rem, 6vw, 5.5rem)`；相邻区块不再叠加两个大 padding。
- 卡片内边距：20 / 24 / 32 三档（`p-5` / `p-6` / `p-8`）。
- 内容间距：8 的倍数（8 / 16 / 24 / 32 / 48）。
- 圆角：`rounded` 3px（小标签）· `rounded-lg` 8px（输入、按钮）· `rounded-xl` 12px（卡片）· `rounded-2xl` 16px（大面板）· `rounded-full` 胶囊。

## 4. 组件状态

- **按钮**：primary / secondary / ghost / icon 四级，每级 hover、active、focus-visible、disabled、loading 五态。
- **输入**：`#fffdfa` 底 + 发丝线 + 2px 焦点环；标签常驻，不用 placeholder 代替标签；错误态用 `error` 色 + 文案说明怎么改。
- **卡片**：`.card`（发丝线、无阴影）· `.card-flat`（无框）· `.card-inverse`（深色）。禁止卡片内再套卡片。
- **空状态**：图标或一句手写感的话 + 一个主行动，不留空白大框。
- **加载**：骨架屏优于转圈；超过 300ms 才显示。
- **筛选**：`aria-pressed` 同步；移动端横向滚动，不换行。

## 5. 动效

- 只动 `transform` / `opacity`；`prefers-reduced-motion` 下全部静止。
- hover 150ms、进入 300ms、图片 400ms；不使用 700ms 以上的过渡。
- 首屏允许 3 段 80ms 错峰，其余区块不做整页 fade-up。

## 6. 移动端

- 断点：`sm 640` / `md 768` / `lg 1024` / `xl 1280`；补 `md`。
- 触控目标 ≥ 44×44；固定底栏加 `env(safe-area-inset-bottom)`。
- 页面级 `overflow-x: clip`；多列栅格图片轨道用 `minmax(0,1fr)`。
- 所有文本容器允许换行；标题用 `text-balance`，正文用 `text-pretty`。

## 7. 可访问性

- 每个可交互元素有可见焦点；图标按钮有 `aria-label`。
- 筛选/开关同步 `aria-pressed` / `aria-expanded`；对话框用原生 `<dialog>`，Esc 可关。
- 图片有 `alt`、宽高；装饰图标 `aria-hidden`。
- 支持 `forced-colors` 与 `prefers-contrast: more`。

## 8. 37 项改进对照

| #   | 方向           | 落点                            |
| --- | -------------- | ------------------------------- |
| 1   | 卡片材质分级   | `global.css` `.card*`           |
| 2   | 色彩角色收敛   | `tailwind.config.mjs`           |
| 3   | 字号阶梯收敛   | `tailwind.config.mjs`           |
| 4   | 中英混排       | `tailwind.config.mjs` / 组件    |
| 5   | 垂直节奏       | `spacing.section`               |
| 6   | 首屏收束       | `HeroProfile.astro`             |
| 7   | 随记去卡片化   | `EssayList.astro`               |
| 8   | 四宫格对齐     | `HobbyGrid` + 4 卡              |
| 9   | 侧栏与页脚降噪 | `essays.astro` / `Footer.astro` |
| 10  | 按钮体系       | `.btn*`                         |
| 11  | 表单控件       | `.field*`                       |
| 12  | 空/加载/错误态 | 各列表组件                      |
| 13  | 图片组件       | `PhotoGallery` / `VisualCard`   |
| 14  | 筛选器统一     | 三个 Filters + 脚本             |
| 15  | 触控与安全区   | Header / Player                 |
| 16  | 移动端破版     | Hero / EssayList                |
| 17  | 键盘与焦点     | global / scripts                |
| 18  | 语义状态       | Filters / Header                |
| 19  | 动效编排       | global / scripts                |
| 20  | 搜索与后台     | SearchDialog / admin            |
| 21  | 真实状态广播   | Header + Player + `home.ts`     |
| 22  | 品牌与分享卡   | `BaseLayout` / `og`             |
| 23  | 示例内容标识   | 数据组件                        |
| 24  | 信件隐喻文案   | 留言组件                        |
| 25  | 内联播放       | `TrackList` / scripts           |
| 26  | 详情阅读工具   | `essays/[slug].astro`           |
| 27  | 影集浏览       | `PhotoGallery` / lightbox       |
| 28  | 书架组织       | `Bookshelf`                     |
| 29  | 搜索入口       | Header / script                 |
| 30  | 404 与异常     | `404.astro`                     |
| 31  | 首屏性能       | 字体/图片/骨架                  |
| 32  | 断点栅格       | config / 各页                   |
| 33  | 微交互         | global                          |
| 34  | 打印与导出     | global print                    |
| 35  | 后台可用性     | admin 组件                      |
| 36  | 设计系统文档   | 本文件                          |
| 37  | 系统级显示适配 | global                          |

## 9. 验收命令

```bash
npm run format && npm run verify
```

截图：390 / 768 / 1024 / 1440 四档，检查文字碰撞、横向溢出、触控尺寸。

## 10. 实施记录（2026-11-04）

本轮完成的改动：

- token 与组件样式：颜色角色、6 档字号、圆角/阴影、`.card*`、`.btn*`、`.field*`、`.filter-pill`、`.tag-pill`、`.empty-state`；
- 站点外壳：Header（滚动收窄、真实播放状态、44px 触控、Ctrl/⌘+K 搜索）、Footer（四栏紧凑）、播放器（安全区、事件同步）、搜索（键盘上下选择）、404；
- 首页：首屏收束为 3 块、四宫格统一结构、统计条、留言预览与表单；
- 随记：列表去卡片化、移动端元信息换行、筛选 aria、详情页字号/进度/打印/分享/相关推荐；
- 读听：Hero 破版修复、书架按状态分组、内联播放、筛选统一样式；
- 影集：Hero/筛选移动端修复、卡片与灯箱样式、EXIF 保留；
- 留言：表单可见性、空状态、友链与公告重排、信件隐喻文案统一；
- 后台：登录/表单/按钮接入新 token，未登录不再误报「登录已过期」，列表支持搜索、留言支持批量通过/隐藏/删除，内容表单有未保存提醒；
- 全局：`overflow-x: clip`、安全区、`prefers-contrast`、`forced-colors`、打印样式、字体 preload、`text-wrap`；
- 验收：新增 `npm run visual`（390/768/1024/1440 × 7 个页面），检查横向溢出与触控目标并保存截图，当前 28 个组合 0 溢出。

尚未完成（留作下一轮）：

- 文章级 OG **图**生成（当前用 `og:type=article` + 正文首图兜底）；
- 图片 WebP/AVIF 构建管线；
- Lighthouse 性能预算（`npm run visual` 已覆盖布局与触控回归）。
