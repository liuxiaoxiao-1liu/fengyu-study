---
title: "一些技术笔记"
date: 2026-10-03
tags: ["技术"]
summary: "代码块、表格、列表的样式检查。"
---

用来检查排版细节：代码、表格、列表、引用。

## 代码块

```bash
# 一条命令发布
./deploy.sh
```

```python
def render(posts):
    for p in sorted(posts, key=lambda x: x.date, reverse=True):
        yield p.title
```

## 表格

| 项目 | 数值 | 说明 |
|---|---|---|
| 内存 | 523 MB | 系统 + xray |
| 带宽 | 5 Mbps | 全员共享 |
| 磁盘 | 39 GB 可用 | 图片随便放 |

## 嵌套列表

- 第一层
  - 第二层
    - 第三层
- 回到第一层

## 引用

> 任何“为了更完善”的提议，先问一句：现成方案里有没有？
