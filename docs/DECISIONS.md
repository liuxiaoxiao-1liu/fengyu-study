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
