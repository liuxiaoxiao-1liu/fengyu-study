let tagButtons: HTMLElement[] = [];
let activeTag = '网文同好';

export function getActiveTag() {
  return activeTag;
}

function selectTag(btn: HTMLElement) {
  for (const b of tagButtons) {
    b.setAttribute('aria-pressed', String(b === btn));
  }
  activeTag = btn.dataset.tag || '网文同好';
}

export function initTags() {
  tagButtons = [...document.querySelectorAll<HTMLElement>('#tag-capsules .tag-pill')];
  activeTag = tagButtons[0]?.dataset.tag || '网文同好';
  for (const btn of tagButtons) {
    btn.addEventListener('click', () => selectTag(btn));
  }
}

export function resetTags() {
  activeTag = tagButtons[0]?.dataset.tag || '网文同好';
  for (const b of tagButtons) {
    b.setAttribute('aria-pressed', String(b === tagButtons[0]));
  }
}
