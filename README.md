# 风屿书房 / Island of Solitude

一个大学生收藏网文、酷狗歌单、影像与随笔的数字秘密基地。视觉参考 `stitch_astro_personal_website/` 中的 *Warm Editorial Literary Journal* 设计稿，用 Astro 重建为可部署的独立站点。

- 纯静态页面（Astro 7）+ Tailwind CSS 3
- 自托管字体与图标（Newsreader / Space Grotesk / Material Symbols），不依赖 Google Fonts
- 首页、读听、影集、随记、留言五个板块
- 随记详情页、站内搜索、分类筛选、打捞漂流瓶、暗色以外的纸感排版
- 留言箱带一个轻量 PHP API（公开留言直接上墙，悄悄话只存服务器）

线上地址：<http://example.com/>

## 本地开发

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # 输出到 dist/
npm run preview      # 预览构建结果
```

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

`POST /api/guestbook` 接收 JSON：

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

- 公开留言写入后立即上墙；`private: true` 只保存在服务器，不在页面返回
- 有蜜罐字段、长度限制和每 IP 60 秒一次的频率限制
- 数据文件：`/var/lib/xiaoquanzi/guestbook.json`（在 web 根目录之外，www-data 读写）
- 后台实现：`deploy/guestbook.php`，通过 nginx 的 `/api/guestbook` 交给 php8.3-fpm

## 部署

```bash
./deploy.sh
```

脚本会：

1. `npm run build`
2. 上传 `deploy/nginx.conf` 到 `/etc/nginx/sites-available/xiaoquanzi`
3. 上传留言 API 并准备数据目录
4. `rsync` 上传 `dist/` 到 `/var/www/xiaoquanzi`
5. 停用 nginx 默认站点、启用本站、检查配置并重载
6. 验证首页、RSS、站点地图、留言 API

可覆盖变量：

```bash
SERVER=root@1.2.3.4 REMOTE_DIR=/var/www/site ./deploy.sh
SSH_KEY=~/.ssh/other_key SSH_CONFIG=~/.ssh/config ./deploy.sh
```

### 服务器约定

| 项目 | 值 |
| --- | --- |
| 服务器 | `example.com`（Ubuntu 24.04 / nginx 1.24） |
| 登录 | `root` + `~/.ssh/id_ed25519` |
| Web 根目录 | `/var/www/xiaoquanzi` |
| 留言 API | `/var/www/xiaoquanzi-api/guestbook.php` |
| 留言数据 | `/var/lib/xiaoquanzi/guestbook.json` |
| Nginx 站点 | `/etc/nginx/sites-enabled/xiaoquanzi` |
| 端口 | `80`；`443` 由 xray 占用，未改动 |

### 以后绑定域名

1. 域名 A 记录指向 `example.com`
2. 修改 `astro.config.mjs` 的 `site` 和 `deploy/nginx.conf` 的 `server_name`
3. 重新执行 `./deploy.sh`
4. 如需 HTTPS，需要先让 443 端口可用（目前被 xray 占用），再用 certbot 签证书

## 设计参考

`stitch_astro_personal_website/` 是设计稿导出（5 个页面截图 + 设计 token），只作为参考，不参与构建；已在 `.gitignore` 中忽略。照片与头像为设计稿里的示例素材，字体与图标已本地化。
