// 后台共用：DOM 小工具、登录面板切换、带 401 处理的 fetch 封装。

export const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

export function setText(node: HTMLElement | null, value: string) {
  if (node) node.textContent = value;
}

export function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function showLogin(message = '') {
  $('login-panel')?.removeAttribute('hidden');
  $('dashboard')?.setAttribute('hidden', '');
  setText($('login-message'), message);
}

export function showDashboard(user: string) {
  $('login-panel')?.setAttribute('hidden', '');
  $('dashboard')?.removeAttribute('hidden');
  setText(document.querySelector<HTMLElement>('[data-session-user]'), user);
}

export async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  });
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.status === 401) {
    showLogin('登录已过期，请重新登录。');
    throw new Error('unauthorized');
  }
  if (!response.ok || (data && data.ok === false)) {
    throw new Error((data && (data.message || data.error)) || `HTTP ${response.status}`);
  }
  return data;
}
