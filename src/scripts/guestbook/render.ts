import { formatRelative } from './format';
import type { PublicLetter } from './types';

export function makeFilterButton(tag: string, count: number) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    'filter-btn px-space-md py-space-xs rounded-full font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-all';
  btn.dataset.filterCategory = tag;
  btn.dataset.generatedFilter = '1';
  btn.setAttribute('aria-pressed', 'false');
  btn.textContent = `${tag} (${count})`;
  return btn;
}

export function setActiveFilterButton(commentFilters: HTMLElement | null, category: string) {
  if (!commentFilters) return;
  for (const btn of commentFilters.querySelectorAll<HTMLElement>('[data-filter-category]')) {
    const on = (btn.dataset.filterCategory || 'all') === category;
    btn.classList.toggle('bg-primary', on);
    btn.classList.toggle('text-on-primary', on);
    btn.classList.toggle('shadow-sm', on);
    btn.classList.toggle('text-on-surface-variant', !on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

export function makeLetter(message: PublicLetter) {
  const card = document.createElement('article');
  card.className =
    'letter-card bg-surface-container-low p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md hover:shadow-md transition-shadow';
  card.dataset.category = (message.tag || '网文同好').trim() || '网文同好';
  if (message.id) card.dataset.id = message.id;

  const head = document.createElement('div');
  head.className = 'flex flex-col gap-space-sm';

  const top = document.createElement('div');
  top.className = 'flex items-start justify-between gap-space-sm';

  const who = document.createElement('div');
  who.className = 'flex items-center gap-space-sm min-w-0';
  const badge = document.createElement('div');
  badge.className =
    'w-10 h-10 shrink-0 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-serif font-semibold text-lg shadow-inner';
  badge.textContent = (message.name || '匿').slice(0, 1);
  const identity = document.createElement('div');
  identity.className = 'flex flex-col min-w-0';
  const name = document.createElement('span');
  name.className = 'font-body-lg text-primary font-medium leading-none break-words';
  name.textContent = message.name || '匿名旅人';
  const where = document.createElement('span');
  where.className = 'font-label-sm text-[0.6875rem] text-on-surface-variant mt-1 break-words';
  where.textContent = message.station || '来自一张匿名信笺';
  identity.append(name, where);
  who.append(badge, identity);

  const meta = document.createElement('div');
  meta.className = 'flex items-center gap-space-xs shrink-0';
  const tag = document.createElement('span');
  tag.className = 'bg-surface-container px-space-sm py-0.5 rounded font-label-sm text-label-sm text-secondary';
  tag.textContent = message.tag || '网文同好';
  const when = document.createElement('span');
  when.className = 'font-label-sm text-[0.6875rem] text-outline-variant';
  when.textContent = formatRelative(message.created_at);
  meta.append(tag, when);
  top.append(who, meta);

  const body = document.createElement('p');
  body.className = 'font-body-md text-body-md text-primary leading-relaxed pt-space-xs whitespace-pre-line break-words';
  body.textContent = message.message || '';
  head.append(top, body);
  card.append(head);

  if (typeof message.reply === 'string' && message.reply.trim() !== '') {
    const replyBox = document.createElement('div');
    replyBox.className = 'bg-surface-container p-space-md rounded-lg flex flex-col gap-space-xs';
    const replyHead = document.createElement('div');
    replyHead.className =
      'flex items-center justify-between gap-space-sm text-on-surface-variant font-label-sm text-label-sm';
    const replyLabel = document.createElement('span');
    replyLabel.className = 'flex items-center gap-1 font-medium text-primary';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-xs text-secondary';
    icon.textContent = 'reply';
    replyLabel.append(icon, document.createTextNode('房主回信 · 风屿'));
    const replyTime = document.createElement('span');
    replyTime.textContent = formatRelative(message.replied_at);
    replyHead.append(replyLabel, replyTime);
    const replyBody = document.createElement('p');
    replyBody.className = 'font-body-sm text-body-sm text-on-surface-variant whitespace-pre-line break-words';
    replyBody.textContent = message.reply;
    replyBox.append(replyHead, replyBody);
    card.append(replyBox);
  }

  return card;
}
