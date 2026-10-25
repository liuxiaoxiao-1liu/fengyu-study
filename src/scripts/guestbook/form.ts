import { postLetter } from './api';
import { getActiveTag, initTags, resetTags } from './tags';
import { hideToast, showToast } from './toast';
import type { LetterDraft } from './types';

const DRAFT_KEY = 'fengyu-guestbook-drafts';

type FormOptions = {
  onSubmitted: (isPrivate: boolean) => void | Promise<void>;
};

function saveDraft(draft: LetterDraft) {
  // 本地预览或网络异常时，至少把信笺留在浏览器里，不丢失。
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]') as Array<LetterDraft & { at: string }>;
    drafts.unshift({ ...draft, at: new Date().toISOString() });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts.slice(0, 20)));
  } catch {}
}

export function initForm(options: FormOptions) {
  initTags();

  const author = document.getElementById('author-name') as HTMLInputElement | null;
  const station = document.getElementById('music-station') as HTMLInputElement | null;
  const content = document.getElementById('message-content') as HTMLTextAreaElement | null;
  const privateCheck = document.getElementById('private-check') as HTMLInputElement | null;
  const counter = document.getElementById('char-counter');
  const form = document.getElementById('guestbook-form') as HTMLFormElement | null;

  const query = new URLSearchParams(window.location.search);
  const queryName = query.get('name');
  const queryStation = query.get('station');
  const queryMessage = query.get('message');
  if (author && queryName) author.value = queryName;
  if (station && queryStation) station.value = queryStation;
  if (content && queryMessage) {
    content.value = queryMessage;
    if (counter) counter.textContent = `${content.value.length} / 600`;
  }
  if (query.get('private') === '1' && privateCheck) privateCheck.checked = true;

  content?.addEventListener('input', () => {
    if (counter) counter.textContent = `${content.value.length} / 600`;
  });

  document.querySelector('[data-close-toast]')?.addEventListener('click', hideToast);

  document.querySelector('[data-prefill-friend]')?.addEventListener('click', () => {
    if (author) author.value = '某站长';
    if (content) {
      content.value = '你好！想申请与《风屿书房》交换友链：\n站名：\n网址：\n简介：\n头像链接：';
      content.dispatchEvent(new Event('input'));
    }
    author?.focus();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!author?.value.trim() || !content?.value.trim()) {
      showToast('昵称和正文都要写一点，才好投递。');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const payload: LetterDraft = {
      name: author.value.trim(),
      station: station?.value.trim() || '',
      tag: getActiveTag(),
      message: content.value.trim(),
      private: Boolean(privateCheck?.checked),
      website: '',
    };
    submitButton?.setAttribute('disabled', '');
    submitButton?.classList.add('opacity-60');

    try {
      const data = await postLetter(payload);
      showToast(data.message || '信笺已收妥。');
      form.reset();
      if (counter) counter.textContent = '0 / 600';
      resetTags();
      await options.onSubmitted(payload.private);
    } catch (error) {
      saveDraft(payload);
      showToast(
        error instanceof Error && error.message !== 'offline' && error.message !== 'Failed to fetch'
          ? error.message
          : '信箱暂时没连上，信笺先存在这只浏览器里。',
      );
    } finally {
      submitButton?.removeAttribute('disabled');
      submitButton?.classList.remove('opacity-60');
    }
  });
}
