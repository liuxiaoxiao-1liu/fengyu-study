// @ts-check
import { defineConfig } from 'astro/config';

// 站点部署在自己的服务器上，暂时通过 IP 访问。
// 以后绑定域名时，只需改这里的 site，重新构建部署即可。
export default defineConfig({
  site: 'http://example.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
