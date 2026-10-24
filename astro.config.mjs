// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// 站点部署在自己的服务器上，暂时通过 IP 访问。
// 绑定域名时改这里的 site，再执行 ./deploy.sh。
export default defineConfig({
  site: 'http://example.com',
  // 页面仍然全量预渲染；只有 /api/* 标了 prerender = false 的接口
  // 由 Node adapter 在请求时执行。
  output: 'static',
  adapter: node({
    mode: 'standalone',
    // 与 nginx 的 client_max_body_size 保持一致
    bodySizeLimit: 16 * 1024,
  }),
  // 本站不用 Astro session，关掉以免容器只读文件系统时写缓存目录
  session: false,
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
