// 后台「留言与悄悄话」：状态筛选、计数、审核/隐藏/删除与回复。
import { $, request, setText } from './dom';

type LetterStatus = 'pending' | 'approved' | 'hidden';
type AdminLetter = {
  id: string;
  name: string;
  station: string;
  message: string;
  tag: string;
  reply: string;
  replied_at: string | null;
  created_at: string;
  is_private: number;
  status: LetterStatus;
};

const lettersList = $('letters-list');
const lettersEmpty = $('letters-empty');
const lettersStatus = $('letters-status');
let letterFilter: LetterStatus | 'all' = 'all';
let letters: AdminLetter[] = [];
const lettersSelectAll = $<HTMLInputElement>('letters-select-all');
const lettersSelected = $('letters-selected');

function setLettersStatus(message: string) {
  setText(lettersStatus, message);
}

function letterStatusText(status: LetterStatus): string {
  return status === 'pending' ? '待审核' : status === 'approved' ? '已上墙' : '已隐藏';
}

function styleLetterFilters() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-letter-filter]')) {
    const on = button.dataset.letterFilter === letterFilter;
    button.classList.toggle('bg-primary', on);
    button.classList.toggle('text-on-primary', on);
    button.classList.toggle('bg-surface-container', !on);
    button.classList.toggle('text-primary', !on);
  }
}

function selectedLetterIds(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>('.letter-select:checked')]
    .map((input) => input.value)
    .filter(Boolean);
}

function updateSelectionCount() {
  const count = selectedLetterIds().length;
  setText(lettersSelected, `已选 ${count} 条`);
  if (lettersSelectAll) {
    const all = [...document.querySelectorAll<HTMLInputElement>('.letter-select')];
    lettersSelectAll.checked = all.length > 0 && count === all.length;
    lettersSelectAll.indeterminate = count > 0 && count < all.length;
  }
}

async function batchUpdate(status: LetterStatus) {
  const ids = selectedLetterIds();
  if (!ids.length) {
    setLettersStatus('先勾选要处理的留言');
    return;
  }
  setLettersStatus(`批量处理 ${ids.length} 条…`);
  try {
    await Promise.all(
      ids.map((id) =>
        request(`/api/admin/letters/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),
      ),
    );
    setLettersStatus('已批量更新');
    await loadLetters();
  } catch (error) {
    setLettersStatus(error instanceof Error ? error.message : '批量更新失败');
  }
}

async function batchDelete() {
  const ids = selectedLetterIds();
  if (!ids.length) {
    setLettersStatus('先勾选要删除的留言');
    return;
  }
  if (!window.confirm(`永久删除选中的 ${ids.length} 条留言？删除后不能恢复。`)) return;
  setLettersStatus(`删除 ${ids.length} 条…`);
  try {
    await Promise.all(ids.map((id) => request(`/api/admin/letters/${encodeURIComponent(id)}`, { method: 'DELETE' })));
    setLettersStatus('已批量删除');
    await loadLetters();
  } catch (error) {
    setLettersStatus(error instanceof Error ? error.message : '批量删除失败');
  }
}

function updateLetterCounts(counts: Record<string, number> | undefined) {
  if (!counts) return;
  for (const node of document.querySelectorAll<HTMLElement>('[data-letter-count]')) {
    const key = node.dataset.letterCount ?? '';
    node.textContent = String(counts[key] ?? 0);
  }
}

function renderLetters() {
  if (!lettersList) return;
  lettersList.replaceChildren();
  for (const letter of letters) {
    const card = document.createElement('article');
    card.className =
      'flex flex-col gap-space-sm rounded-xl border border-surface-container-high bg-surface-container-low p-space-lg shadow-sm';

    const head = document.createElement('div');
    head.className = 'flex flex-wrap items-center justify-between gap-space-sm';
    const who = document.createElement('div');
    who.className = 'flex flex-wrap items-center gap-2';
    const select = document.createElement('input');
    select.type = 'checkbox';
    select.className = 'letter-select h-4 w-4 accent-secondary';
    select.value = letter.id;
    select.setAttribute('aria-label', `选择 ${letter.name} 的留言`);
    select.addEventListener('change', updateSelectionCount);
    who.append(select);
    const name = document.createElement('strong');
    name.className = 'text-sm font-medium text-primary';
    name.textContent = letter.name;
    who.append(name);
    if (letter.is_private) {
      const priv = document.createElement('span');
      priv.className = 'rounded-full bg-secondary-container/60 px-2 py-0.5 font-label-sm text-[0.625rem] text-primary';
      priv.textContent = '悄悄话 · 仅房主可见';
      who.append(priv);
    }
    if (letter.tag) {
      const tag = document.createElement('span');
      tag.className =
        'rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-[0.625rem] text-on-surface-variant';
      tag.textContent = letter.tag;
      who.append(tag);
    }
    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-2 font-label-sm text-[0.625rem] text-on-surface-variant';
    const status = document.createElement('span');
    status.className = letter.status === 'pending' ? 'text-secondary' : 'text-on-surface-variant';
    status.textContent =
      letter.is_private && letter.status === 'approved' ? '已通过 · 不公开' : letterStatusText(letter.status);
    const date = document.createElement('span');
    date.textContent = new Date(letter.created_at).toLocaleString('zh-CN');
    meta.append(status, date);
    head.append(who, meta);

    const message = document.createElement('p');
    message.className = 'whitespace-pre-wrap font-body-md text-body-md leading-relaxed text-on-surface';
    message.textContent = letter.message;

    card.append(head, message);

    if (letter.reply) {
      const reply = document.createElement('div');
      reply.className = 'rounded-lg bg-surface-container p-space-sm';
      const replyLabel = document.createElement('span');
      replyLabel.className = 'font-label-sm text-[0.625rem] text-secondary';
      replyLabel.textContent = '房主回复';
      const replyText = document.createElement('p');
      replyText.className = 'mt-1 whitespace-pre-wrap font-body-sm text-body-sm text-primary';
      replyText.textContent = letter.reply;
      reply.append(replyLabel, replyText);
      card.append(reply);
    }

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap items-center gap-2';
    if (letter.status !== 'approved') {
      const approve = document.createElement('button');
      approve.type = 'button';
      approve.className = 'rounded-lg bg-primary px-space-md py-1.5 font-label-sm text-label-sm text-on-primary';
      approve.textContent = '通过';
      approve.addEventListener('click', () => void updateLetter(letter.id, { status: 'approved' }));
      actions.append(approve);
    }
    if (letter.status !== 'hidden') {
      const hide = document.createElement('button');
      hide.type = 'button';
      hide.className = 'rounded-lg border border-error/40 px-space-md py-1.5 font-label-sm text-label-sm text-error';
      hide.textContent = '隐藏';
      hide.addEventListener('click', () => void updateLetter(letter.id, { status: 'hidden' }));
      actions.append(hide);
    }

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'rounded-lg px-space-md py-1.5 font-label-sm text-label-sm text-error hover:bg-error/10';
    remove.textContent = '删除';
    remove.addEventListener('click', async () => {
      if (!window.confirm('永久删除这条留言？删除后不能恢复，隐藏则只是从公开页撤下。')) return;
      setLettersStatus('删除中…');
      try {
        await request(`/api/admin/letters/${encodeURIComponent(letter.id)}`, { method: 'DELETE' });
        setLettersStatus('已删除');
        await loadLetters();
      } catch (error) {
        setLettersStatus(error instanceof Error ? error.message : '删除失败');
      }
    });
    actions.append(remove);

    const replyBox = document.createElement('textarea');
    replyBox.className = 'field min-h-[4rem] flex-1';
    replyBox.placeholder = letter.is_private
      ? '写一句回复（悄悄话仅房主可见）'
      : '写一句回复，保存后显示在公开留言下面';
    replyBox.value = letter.reply;
    const saveReply = document.createElement('button');
    saveReply.type = 'button';
    saveReply.className = 'rounded-lg bg-surface-container px-space-md py-1.5 font-label-sm text-label-sm text-primary';
    saveReply.textContent = '保存回复';
    saveReply.addEventListener('click', () => void updateLetter(letter.id, { reply: replyBox.value }));
    actions.append(replyBox, saveReply);
    card.append(actions);
    lettersList.append(card);
  }
  lettersEmpty?.classList.toggle('hidden', letters.length !== 0);
}

async function updateLetter(id: string, patch: { status?: LetterStatus; reply?: string }) {
  setLettersStatus('保存中…');
  try {
    await request(`/api/admin/letters/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setLettersStatus('已保存');
    await loadLetters();
  } catch (error) {
    setLettersStatus(error instanceof Error ? error.message : '保存失败');
  }
}

export async function loadLetters() {
  styleLetterFilters();
  setLettersStatus('加载中…');
  try {
    const data = await request(`/api/admin/letters?status=${encodeURIComponent(letterFilter)}&limit=200`);
    letters = data.letters;
    updateLetterCounts(data.counts);
    renderLetters();
    updateSelectionCount();
    setLettersStatus(`共 ${letters.length} 条`);
  } catch (error) {
    setLettersStatus(error instanceof Error ? error.message : '加载失败');
  }
}

export function initLetters() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-letter-filter]')) {
    button.addEventListener('click', () => {
      const value = button.dataset.letterFilter;
      if (value === 'pending' || value === 'approved' || value === 'hidden' || value === 'all') {
        letterFilter = value;
        void loadLetters();
      }
    });
  }
  $('letters-refresh')?.addEventListener('click', () => void loadLetters());
  lettersSelectAll?.addEventListener('change', () => {
    for (const input of document.querySelectorAll<HTMLInputElement>('.letter-select')) {
      input.checked = Boolean(lettersSelectAll.checked);
    }
    updateSelectionCount();
  });
  $('letters-batch-approve')?.addEventListener('click', () => void batchUpdate('approved'));
  $('letters-batch-hide')?.addEventListener('click', () => void batchUpdate('hidden'));
  $('letters-batch-delete')?.addEventListener('click', () => void batchDelete());
}
