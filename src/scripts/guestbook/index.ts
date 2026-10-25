import { onPageLoad } from '../site/page-init';
import { initForm } from './form';
import { initLetters } from './letters';
import { initBottleModal } from './modal';
import { initStats } from './stats';

export function initGuestbook() {
  const letters = initLetters();
  const stats = initStats();

  initForm({
    onSubmitted: async (isPrivate) => {
      await stats.refresh();
      if (!isPrivate) await letters.load();
    },
  });

  initBottleModal();

  stats.refresh();
  letters.load();
}

onPageLoad('guestbook', () => {
  initGuestbook();
});
