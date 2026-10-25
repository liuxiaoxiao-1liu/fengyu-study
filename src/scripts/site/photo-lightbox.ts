import { onPageLoad } from './page-init';

onPageLoad('photo-lightbox', () => {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
  if (dialog) {
    const slides = [...dialog.querySelectorAll<HTMLElement>('[data-lightbox-slide]')];
    const counter = dialog.querySelector<HTMLElement>('[data-lightbox-counter]');
    const closeButton = dialog.querySelector<HTMLButtonElement>('[data-lightbox-close]');
    const prevButton = dialog.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
    const nextButton = dialog.querySelector<HTMLButtonElement>('[data-lightbox-next]');
    const downloadLink = dialog.querySelector<HTMLAnchorElement>('[data-lightbox-download]');
    const editLink = dialog.querySelector<HTMLAnchorElement>('[data-lightbox-edit]');
    let visibleSlides = slides;
    let current = 0;
    let lastTrigger: HTMLElement | null = null;

    const currentSlide = () => visibleSlides[current];

    const updateMetaLinks = () => {
      const slide = currentSlide();
      if (!slide) return;
      const image = slide.querySelector<HTMLImageElement>('img');
      const src = image?.getAttribute('src') ?? '#';
      if (downloadLink) {
        downloadLink.href = src;
        const name = src.split('/').pop() ?? 'photo.jpg';
        downloadLink.download = name;
      }
      if (editLink) {
        editLink.href = `/admin/?photo=${encodeURIComponent(slide.dataset.slug ?? '')}`;
      }
    };

    const show = (index: number) => {
      if (!visibleSlides.length) return;
      current = (index + visibleSlides.length) % visibleSlides.length;
      slides.forEach((slide) => slide.classList.add('hidden'));
      visibleSlides.forEach((slide, slideIndex) => {
        slide.classList.toggle('hidden', slideIndex !== current);
      });
      if (counter) counter.textContent = `${current + 1} / ${visibleSlides.length}`;
      updateMetaLinks();
    };

    const open = (slug: string, trigger: HTMLElement) => {
      const series = trigger.dataset.series;
      // 只在当前分类里翻页；没有分类或该分类无图时退回全部。
      const filtered = series ? slides.filter((slide) => slide.dataset.series === series) : slides;
      visibleSlides = filtered.length ? filtered : slides;
      const index = visibleSlides.findIndex((slide) => slide.dataset.slug === slug);
      if (index < 0) return;
      lastTrigger = trigger;
      show(index);
      if (!dialog.open) dialog.showModal();
      closeButton?.focus();
    };

    document.querySelectorAll<HTMLElement>('[data-photo-open]').forEach((card) => {
      const slug = card.dataset.photoOpen ?? '';
      card.addEventListener('click', () => open(slug, card));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(slug, card);
        }
      });
    });

    closeButton?.addEventListener('click', () => dialog.close());
    prevButton?.addEventListener('click', () => show(current - 1));
    nextButton?.addEventListener('click', () => show(current + 1));

    // 点击遮罩关闭；内容区是 dialog 的子元素，不会误触。
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    // 原生 Esc 会触发 close；把焦点还给打开它的卡片。
    dialog.addEventListener('close', () => {
      lastTrigger?.focus();
    });

    document.addEventListener('keydown', (event) => {
      if (!dialog.open) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        show(current - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        show(current + 1);
      }
    });
  }
});
