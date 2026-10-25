let tagButtons: HTMLElement[] = [];
let activeTag = '网文同好';

export function getActiveTag() {
  return activeTag;
}

function selectTag(btn: HTMLElement) {
  for (const b of tagButtons) {
    b.classList.remove('bg-primary', 'text-on-primary');
    b.classList.add('bg-surface-container', 'text-on-surface-variant');
  }
  btn.classList.remove('bg-surface-container', 'text-on-surface-variant');
  btn.classList.add('bg-primary', 'text-on-primary');
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
    const on = b === tagButtons[0];
    b.classList.toggle('bg-primary', on);
    b.classList.toggle('text-on-primary', on);
    b.classList.toggle('bg-surface-container', !on);
    b.classList.toggle('text-on-surface-variant', !on);
  }
}
