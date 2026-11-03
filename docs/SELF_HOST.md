# 自托管指南（开源版）

这个仓库是一个可以直接改成自己站点的模板：Astro 7 + Node API + SQLite + Docker。
没有默认管理员密码，也没有内置任何人的酷狗账号；这两件事都由你在本地配置。

## 1. 5 分钟跑起来

需要 **Node ≥ 26**（Astro 7 + `node:sqlite`）。

```bash
git clone <你的仓库地址>
cd fengyu-study
npm install
npm run setup      # 设置管理员用户名 / 密码，写入 .env
npm run dev        # http://localhost:4321/
```

`npm run setup` 会：

- 询问管理员用户名（默认 `admin`）和密码（至少 8 位，输入时不回显）；
- 生成 scrypt 密码哈希和随机会话密钥；
- 只写 `.env` 里的 `ADMIN_USER` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET`；
- 不会打印密码或哈希，也不会提交 `.env`（已在 `.gitignore`）。

也可以非交互运行：

```bash
ADMIN_USER=admin ADMIN_PASSWORD='至少 8 位' npm run setup
```

然后打开 <http://localhost:4321/admin/> 登录。

## 2. 管理员后台

- 入口：`/admin/`
- 登录态：HttpOnly cookie（`ADMIN_SESSION_SECRET` 签名），默认 7 天。
- 忘记密码：重新运行 `npm run setup`（会覆盖旧凭据），或
  `node scripts/set-admin-password.mjs '<新密码>' <用户名>`。
- 没有配置管理员时，后台会提示运行 `npm run setup`，登录接口返回 503，不会暴露任何默认账号。

**服务器上的 `.env` 不会被部署脚本覆盖**，需要在 `/opt/fengyu/.env` 单独放一份管理员配置。

## 3. 酷狗音乐（可选）

不配置酷狗，站点也能完整浏览；只是读听页会显示「未连接酷狗账号」的引导。

配置方式（二选一）：

1. **推荐**：登录 `/admin/` → 顶部「酷狗」→ 手机酷狗扫码 → 选择一个歌单 → 设为站内歌单。
   会话和选择分别写入 `.data/kugou-session.json`、`.data/kugou-settings.json`（容器里是 `/data/`）。
2. 在服务器 `.env` 里填 `KUGOU_TOKEN` / `KUGOU_USERID` 等登录态，并用 `KUGOU_PLAYLIST_NAME` 指定歌单名。

说明：

- 仓库里**没有**任何账号 token、userid 或歌单名默认值；
- 种子数据里的曲目也**不带**账号 hash，点击播放会跳到酷狗搜索页；
- 想启用站内播放，在后台上传/填写自己的曲目 hash，或扫码同步自己的歌单；
- 酷狗是非官方接口，登录态可能失效；失效后在后台重新扫码即可。

## 4. 改成你自己的站点

| 改什么                                                       | 位置                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 站点名、作者、导航、描述                                     | `src/lib/site.ts`                                                         |
| 首页文案、个人名片                                           | `src/components/site/HeroProfile.astro`                                   |
| 首启示例内容（随笔 / 书 / 唱片 / 曲目 / 照片 / 台词 / 友链） | `src/data/*.ts`                                                           |
| 站点图片与封面                                               | `public/images/`                                                          |
| 字体与图标                                                   | `public/fonts/`、`src/styles/fonts.css`、`src/styles/icons.css`           |
| 设计 token                                                   | `tailwind.config.mjs`、`src/styles/global.css`（规范见 `docs/DESIGN.md`） |
| 域名 / canonical                                             | `PUBLIC_SITE_URL`、`deploy/nginx.container.conf`、`public/robots.txt`     |

已经运行过、库里已有内容时，改 `src/data/` 不会覆盖数据库；日常内容请在 `/admin/` 里改，或删掉 `.data/content.sqlite` 重新播种。

## 5. 部署（Docker）

```bash
export SERVER=root@YOUR_SERVER_IP
npm run deploy:docker                 # 先发 8080 验证
WEB_PORT=80 npm run deploy:docker     # 确认后再切 80
```

首次部署前，在本地生成一份 `.env`（`npm run setup`），把其中的管理员三项复制到服务器的 `/opt/fengyu/.env`；酷狗配置可选。服务器只放构建产物，不放源码和 `.git`。

## 6. 开源前检查

```bash
npm run check:secrets   # 扫描被 Git 跟踪的文件里有没有真实 token / 哈希
npm run verify          # Prettier + astro check + secrets + 单测 + 构建 + 接口冒烟
```

`check:secrets` 会检查：

- `ADMIN_TOKEN` / `KUGOU_TOKEN` / `KUGOU_VIP_TOKEN` / `KUGOU_USERID` / `KUGOU_MID` / `KUGOU_GUID` 是否有真实值；
- `scrypt:` 密码哈希和 `ADMIN_SESSION_SECRET` 是否被提交；
- `.env` 是否被 Git 跟踪。

如果历史上提交过真实凭据，仅删除文件不够，需要重写 Git 历史（如 `git filter-repo`）并轮换所有对应 token。

## 7. 安全清单

- 上 HTTPS 之前，后台只应在可信网络使用；
- 不要提交 `.env`、`.data/`、`.data/uploads/`、酷狗会话文件；
- 生产环境把 `ADMIN_SESSION_SECRET` 设为独立随机值，不要与示例值相同；
- 留言/订阅接口已有限流；nginx 侧也有粗粒度限制；
- 备份 `.data/` 下的 SQLite 与上传目录；备份不要同盘长期保存；
- 仓库目前没有附带 `LICENSE` 文件，正式开源前请选择许可证（MIT / Apache-2.0 / AGPL-3.0 等）并添加。
