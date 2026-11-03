import { onPageLoad } from './page-init';

onPageLoad('photos', () => {
  const buttons = [...document.querySelectorAll<HTMLElement>('.filter-btn')];
  const cards = [...document.querySelectorAll<HTMLElement>('.photo-card')];
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      for (const b of buttons) {
        b.setAttribute('aria-pressed', String(b === btn));
      }
      const filter = btn.dataset.filter ?? 'all';
      for (const card of cards) {
        const show = filter === 'all' || card.dataset.series === filter;
        card.style.display = show ? 'flex' : 'none';
      }
    });
  }
});
