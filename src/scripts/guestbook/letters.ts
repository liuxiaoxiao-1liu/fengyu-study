import { fetchPublicLetters } from './api';
import { makeFilterButton, makeLetter, setActiveFilterButton } from './render';
import type { PublicLetter } from './types';

const LETTER_BATCH = 3;

export type LettersController = {
  load: () => Promise<void>;
};

export function initLetters(): LettersController {
  const lettersContainer = document.getElementById('letters-container');
  const loadMoreBtn = document.querySelector<HTMLElement>('[data-load-more]');
  const lettersEmpty = document.getElementById('letters-empty');
  const commentFilters = document.getElementById('comment-filters');

  let letterLimit = LETTER_BATCH;
  let activeLetterFilter = 'all';
  let publicLetters: PublicLetter[] = [];
  let lettersLoadFailed = false;

  function setEmptyMessage(message: string) {
    if (!lettersEmpty) return;
    if (message) {
      lettersEmpty.textContent = message;
      lettersEmpty.classList.remove('hidden');
    } else {
      lettersEmpty.classList.add('hidden');
    }
  }

  function renderTagFilters() {
    if (!commentFilters) return;
    for (const btn of commentFilters.querySelectorAll('[data-generated-filter]')) btn.remove();
    const allCount = commentFilters.querySelector('[data-filter-count="all"]');
    if (allCount) allCount.textContent = String(publicLetters.length);

    const counts = new Map<string, number>();
    for (const letter of publicLetters) {
      const tag = (letter.tag || '网文同好').trim() || '网文同好';
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }

    for (const [tag, count] of counts) {
      commentFilters.append(makeFilterButton(tag, count));
    }

    if (activeLetterFilter !== 'all' && !counts.has(activeLetterFilter)) {
      activeLetterFilter = 'all';
    }
    setActiveFilterButton(commentFilters, activeLetterFilter);
  }

  function refreshLetters() {
    if (!lettersContainer) return;
    const cards = [...lettersContainer.querySelectorAll<HTMLElement>('.letter-card')];
    const matched = cards.filter(
      (card) => activeLetterFilter === 'all' || card.dataset.category === activeLetterFilter,
    );
    let shown = 0;
    for (const card of cards) {
      const isMatch = activeLetterFilter === 'all' || card.dataset.category === activeLetterFilter;
      const visible = isMatch && shown < letterLimit;
      card.style.display = visible ? 'flex' : 'none';
      if (visible) shown += 1;
    }

    const remaining = Math.max(0, matched.length - shown);
    if (loadMoreBtn) {
      loadMoreBtn.style.display = remaining === 0 ? 'none' : '';
      const label = loadMoreBtn.querySelector('[data-load-more-label]');
      if (label) {
        label.textContent = remaining ? `展开翻阅更早的时光卷轴（还有 ${remaining} 封）` : '已经翻到最早的一封了';
      }
    }

    if (lettersLoadFailed) {
      setEmptyMessage('留言回廊暂时没连上，稍后再来看看。');
    } else if (publicLetters.length === 0) {
      setEmptyMessage('回廊里还没有公开的信笺，不如由你写下第一封。');
    } else if (matched.length === 0) {
      setEmptyMessage('这一类信笺还在整理中，先去别的分类看看吧。');
    } else {
      setEmptyMessage('');
    }
  }

  commentFilters?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-filter-category]') : null;
    if (!target) return;
    activeLetterFilter = target.dataset.filterCategory || 'all';
    letterLimit = LETTER_BATCH;
    setActiveFilterButton(commentFilters, activeLetterFilter);
    refreshLetters();
  });

  loadMoreBtn?.addEventListener('click', () => {
    letterLimit += LETTER_BATCH;
    refreshLetters();
  });

  async function load() {
    if (!lettersContainer) return;
    try {
      publicLetters = await fetchPublicLetters();
      lettersLoadFailed = false;
      lettersContainer.replaceChildren(...publicLetters.map(makeLetter));
    } catch {
      lettersLoadFailed = true;
      publicLetters = [];
      lettersContainer.replaceChildren();
    }
    renderTagFilters();
    refreshLetters();
  }

  return { load };
}
