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
