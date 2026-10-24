// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// 站点部署在自己的服务器上，暂时通过 IP 访问。
// 绑定域名时改这里的 site，再执行 ./deploy.sh。
export default defineConfig({
  site: 'http://example.com',
  // 页面默认静态预渲染；/api/*、/photos/（内容后台管理）标记 prerender = false，
  // 由 Node adapter 在请求时执行。
  output: 'static',
  adapter: node({
    mode: 'standalone',
    // 图片上传需要较大请求体；留言/订阅接口仍各自限制 16 KB / 4 KB。
    bodySizeLimit: 12 * 1024 * 1024,
  }),
  // 本站不用 Astro session，关掉以免容器只读文件系统时写缓存目录
  session: false,
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
