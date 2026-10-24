# 服务器/部署用：不在服务器上跑 Astro 构建。
# 本地 npm run build 后，把 dist/ 和 package 文件同步过来即可。
FROM node:26-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    GUESTBOOK_DB=/data/guestbook.sqlite

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY dist ./dist

RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /data \
 && chown -R app:app /app /data

USER app
VOLUME ["/data"]
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4321/api/guestbook').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/entry.mjs"]
