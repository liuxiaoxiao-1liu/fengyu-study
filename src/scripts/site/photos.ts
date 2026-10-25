import { onPageLoad } from './page-init';

onPageLoad('photos', () => {
  const buttons = [...document.querySelectorAll<HTMLElement>('.filter-btn')];
  const cards = [...document.querySelectorAll<HTMLElement>('.photo-card')];
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      for (const b of buttons) {
        b.classList.remove('bg-primary', 'text-on-primary', 'shadow-sm');
        b.classList.add('text-on-surface-variant');
      }
      btn.classList.add('bg-primary', 'text-on-primary', 'shadow-sm');
      btn.classList.remove('text-on-surface-variant');
      const filter = btn.dataset.filter ?? 'all';
      for (const card of cards) {
        const show = filter === 'all' || card.dataset.series === filter;
        card.style.display = show ? 'flex' : 'none';
      }
    });
  }
});
