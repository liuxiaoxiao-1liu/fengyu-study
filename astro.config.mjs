// @ts-check
import { defineConfig } from 'astro/config';

// 站点部署在自己的服务器上，暂时通过 IP 访问。
// 绑定域名时改这里的 site，再执行 ./deploy.sh。
export default defineConfig({
  site: 'http://example.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
