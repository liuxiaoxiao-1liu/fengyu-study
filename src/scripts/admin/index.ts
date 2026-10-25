// 后台入口：登录/会话、顶部标签切换，并启动各面板的事件绑定。
import { $, request, setText, showDashboard, showLogin } from './dom';
import { initLetters, loadLetters } from './letters';
import { loadPhotos, initPhotos } from './photos';
import { initKugou, loadKugou, stopKugouQr } from './kugou';
import { initRecords, loadSchemas, showRecords } from './records';

const loginForm = $<HTMLFormElement>('login-form');
const loginUser = $<HTMLInputElement>('login-user');
const loginPassword = $<HTMLInputElement>('login-password');
const loginMessage = $('login-message');
const tabButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-admin-tab]')];

function setTabStyle(type: string) {
  for (const button of tabButtons) {
    const active = button.dataset.adminTab === type;
    button.classList.toggle('bg-primary', active);
    button.classList.toggle('text-on-primary', active);
    button.classList.toggle('bg-surface-container', !active);
    button.classList.toggle('text-primary', !active);
  }
}

function showSection(section: 'photos' | 'records' | 'letters' | 'kugou') {
  const sections: Array<[string, HTMLElement | null]> = [
    ['photos', $('photos-section')],
    ['records', $('records-section')],
    ['letters', $('letters-section')],
    ['kugou', $('kugou-section')],
  ];
  for (const [name, node] of sections) {
    if (node) node.style.display = name === section ? '' : 'none';
  }
}

async function switchTab(type: string) {
  setTabStyle(type);
  if (type === 'photos') {
    stopKugouQr();
    showSection('photos');
    await loadPhotos();
    return;
  }
  if (type === 'kugou') {
    showSection('kugou');
    await loadKugou();
    return;
  }
  if (type === 'letters') {
    stopKugouQr();
    showSection('letters');
    await loadLetters();
    return;
  }
  stopKugouQr();
  showSection('records');
  await loadSchemas();
  await showRecords(type);
}

async function checkSession() {
  try {
    const data = await request('/api/admin/session');
    showDashboard(data.user);
    await loadSchemas();
    await loadPhotos();
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') return;
    showLogin();
  }
}

function init() {
  initPhotos();
  initRecords();
  initKugou();
  initLetters();

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setText(loginMessage, '');
    try {
      const data = await request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUser?.value.trim() ?? '', password: loginPassword?.value ?? '' }),
      });
      showDashboard(data.user);
      if (loginPassword) loginPassword.value = '';
      await loadSchemas();
      await loadPhotos();
    } catch (error) {
      setText(loginMessage, error instanceof Error ? error.message : '登录失败');
    }
  });

  $('logout-button')?.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/';
  });

  for (const button of tabButtons) {
    button.addEventListener('click', () => void switchTab(button.dataset.adminTab ?? 'photos'));
  }

  void checkSession();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
