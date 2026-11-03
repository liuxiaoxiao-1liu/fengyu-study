import type { APIRoute } from 'astro';
import { isAdminAuthConfigured } from '../../../lib/admin-auth';
import { json } from '../../../lib/http';

export const prerender = false;

/**
 * 公开的配置状态：只回答“后台有没有配置管理员”，不返回任何凭据。
 * 后台页面用它决定是显示登录表单，还是显示 npm run setup 的引导。
 */
export const GET: APIRoute = async () => {
  return json({ ok: true, configured: isAdminAuthConfigured() });
};
