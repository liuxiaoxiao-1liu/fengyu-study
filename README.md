# 小圈子

一个安静的个人笔记站点，用 [Astro](https://astro.build) 构建，部署在自己的服务器上。

- 纯静态输出，不依赖数据库和运行时服务
- 文章用 Markdown 写在 `src/content/blog/`
- 支持归档、标签、RSS、站点地图、暗色模式、文章阅读进度
- 无统计脚本、无评论框、无 Cookie

线上地址：<http://example.com/>

## 本地开发

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # 输出到 dist/
npm run preview      # 预览构建结果
```

> 这台机器的 `$HOME` 和 `/etc/ssh` 有一部分是只读的，所以脚本会把 npm / Astro 的缓存和配置写到项目内（`.npm-cache/`、`.config/`）。在正常机器上不需要这些设置。

## 写一篇新文章

在 `src/content/blog/` 新建 `.md` 文件，文件名会成为 URL：`my-post.md` → `/posts/my-post/`。

```md
---
title: "标题"
date: 2026-10-10
tags: ["随笔"]
summary: "列表页显示的一句话摘要。"
cover: "/img/road.jpg"        # 可选
coverAlt: "封面图说明"         # 可选
coverCaption: "图片说明"       # 可选
draft: false                  # true 则不会发布
---

正文……
```

正文里的图片放在 `public/img/`，引用 `/img/xxx.jpg`；原图放 `public/original/`，供“点开看原图”链接使用。示例照片来自 [Unsplash](https://unsplash.com/)，可以直接替换成自己的照片。

## 部署

```bash
./deploy.sh
```

脚本会：

1. `npm run build`
2. 上传 `deploy/nginx.conf` 到服务器的 `/etc/nginx/sites-available/xiaoquanzi`
3. `rsync` 上传 `dist/` 到 `/var/www/xiaoquanzi`
4. 停用 nginx 默认站点、启用本站、检查配置并重载 nginx
5. 验证首页、RSS、站点地图

可覆盖的变量：

```bash
SERVER=root@1.2.3.4 REMOTE_DIR=/var/www/site ./deploy.sh
SSH_KEY=~/.ssh/other_key SSH_CONFIG=~/.ssh/config ./deploy.sh
```

服务器上第一次部署前的默认站点配置会备份到 `/root/nginx-default-site.bak`。

### 服务器约定

| 项目 | 值 |
| --- | --- |
| 服务器 | `example.com`（Ubuntu 24.04） |
| 登录 | `root` + `~/.ssh/id_ed25519` |
| Web 根目录 | `/var/www/xiaoquanzi` |
| Nginx 站点 | `/etc/nginx/sites-enabled/xiaoquanzi` |
| 端口 | `80`（`443` 由 xray 占用，未改动） |

### 以后绑定域名

1. 把域名 A 记录指向 `example.com`
2. 修改 `astro.config.mjs` 的 `site` 和 `deploy/nginx.conf` 的 `server_name`
3. 重新执行 `./deploy.sh`
4. 如需 HTTPS，需要让 443 端口可用（目前被 xray 占用）后再用 certbot 签证书

## 目录

```text
src/
  components/       页头、页脚、主题切换、文章行
  content/blog/     Markdown 文章
  layouts/          基础布局
  lib/              日期、标签、阅读时间等工具
  pages/            首页、文章、归档、标签、关于、404、RSS、sitemap
  styles/           全站样式
public/
  img/              页面使用的压缩图片
  original/         原图（“点开看原图”）
deploy/
  nginx.conf        服务器 nginx 配置
deploy.sh           一键构建 + 发布
```

## 说明

- 站点内容（文字与示例照片）是演示用的，发布前可以换成自己的。
- `_trial/` 是之前 Hugo 方案的试验目录，未纳入构建，已在 `.gitignore` 中忽略。
