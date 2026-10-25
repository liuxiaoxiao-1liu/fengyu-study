// 后台「影集」面板：照片上传、预览、新增/编辑/删除与列表渲染。
import { $, localToday, request, setText } from './dom';

type PhotoRecord = {
  id: string;
  slug: string;
  title: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  series: 'anime' | 'reality' | 'virtual';
  takenAt: string;
  note: string;
  badge: string;
  exif?: Record<string, string | undefined>;
  sortOrder: number;
};

const photoForm = $<HTMLFormElement>('photo-form');
const photoFormTitle = $('photo-form-title');
const photoId = $<HTMLInputElement>('photo-id');
const photoTitle = $<HTMLInputElement>('photo-title');
const photoSlug = $<HTMLInputElement>('photo-slug');
const photoSeries = $<HTMLSelectElement>('photo-series');
const photoTakenAt = $<HTMLInputElement>('photo-taken-at');
const photoWidth = $<HTMLInputElement>('photo-width');
const photoHeight = $<HTMLInputElement>('photo-height');
const photoSrc = $<HTMLInputElement>('photo-src');
const photoAlt = $<HTMLTextAreaElement>('photo-alt');
const photoNote = $<HTMLTextAreaElement>('photo-note');
const photoBadge = $<HTMLInputElement>('photo-badge');
const photoSortOrder = $<HTMLInputElement>('photo-sort-order');
const photoFile = $<HTMLInputElement>('photo-file');
const photoPreview = $<HTMLImageElement>('photo-preview');
const uploadStatus = $('upload-status');
const photoStatus = $('photo-status');
const photoDelete = $<HTMLButtonElement>('photo-delete');
const photoList = $('photo-list');
const photoCount = $('photo-count');
const exifFields = {
  camera: $<HTMLInputElement>('exif-camera'),
  lens: $<HTMLInputElement>('exif-lens'),
  aperture: $<HTMLInputElement>('exif-aperture'),
  shutter: $<HTMLInputElement>('exif-shutter'),
  iso: $<HTMLInputElement>('exif-iso'),
  location: $<HTMLInputElement>('exif-location'),
};

let photos: PhotoRecord[] = [];
let wantSlug = new URLSearchParams(window.location.search).get('photo');

function fillForm(photo: PhotoRecord) {
  if (photoId) photoId.value = photo.id;
  if (photoTitle) photoTitle.value = photo.title;
  if (photoSlug) photoSlug.value = photo.slug;
  if (photoSeries) photoSeries.value = photo.series;
  if (photoTakenAt) photoTakenAt.value = photo.takenAt;
  if (photoWidth) photoWidth.value = String(photo.width);
  if (photoHeight) photoHeight.value = String(photo.height);
  if (photoSrc) photoSrc.value = photo.src;
  if (photoAlt) photoAlt.value = photo.alt;
  if (photoNote) photoNote.value = photo.note;
  if (photoBadge) photoBadge.value = photo.badge;
  if (photoSortOrder) photoSortOrder.value = String(photo.sortOrder);
  for (const [key, input] of Object.entries(exifFields)) {
    if (input) input.value = photo.exif?.[key] ?? '';
  }
  setText(photoFormTitle, '编辑照片');
  photoDelete?.classList.remove('hidden');
  updatePreview();
  photoForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  photoForm?.reset();
  if (photoId) photoId.value = '';
  if (photoSeries) photoSeries.value = 'anime';
  if (photoTakenAt) photoTakenAt.value = localToday();
  if (photoWidth) photoWidth.value = '1200';
  if (photoHeight) photoHeight.value = '800';
  if (photoSortOrder) photoSortOrder.value = '0';
  setText(photoFormTitle, '新增照片');
  setText(photoStatus, '');
  setText(uploadStatus, '');
  photoDelete?.classList.add('hidden');
  updatePreview();
}

function updatePreview() {
  if (!photoPreview) return;
  const src = photoSrc?.value.trim() ?? '';
  if (src) {
    photoPreview.src = src;
    photoPreview.classList.remove('hidden');
  } else {
    photoPreview.classList.add('hidden');
  }
}

function renderList() {
  if (!photoList) return;
  photoList.replaceChildren();
  setText(photoCount, `(${photos.length})`);
  for (const photo of photos) {
    const card = document.createElement('article');
    card.className =
      'flex gap-space-sm rounded-xl border border-surface-container-high bg-surface-container-low p-3 shadow-sm';

    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = photo.alt;
    image.className = 'h-24 w-24 shrink-0 rounded object-cover';
    image.loading = 'lazy';

    const body = document.createElement('div');
    body.className = 'flex min-w-0 flex-1 flex-col gap-1';

    const title = document.createElement('strong');
    title.className = 'truncate text-sm font-medium text-primary';
    title.textContent = photo.title;

    const meta = document.createElement('span');
    meta.className = 'font-label-sm text-[0.625rem] text-on-surface-variant';
    meta.textContent = `${photo.series} · ${photo.takenAt} · ${photo.slug}`;

    const actions = document.createElement('div');
    actions.className = 'mt-auto flex items-center gap-2';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'text-xs text-secondary hover:text-primary';
    edit.textContent = '编辑';
    edit.addEventListener('click', () => fillForm(photo));
    const open = document.createElement('a');
    open.href = '/photos/';
    open.target = '_blank';
    open.rel = 'noopener';
    open.className = 'text-xs text-secondary hover:text-primary';
    open.textContent = '查看';
    actions.append(edit, open);

    body.append(title, meta, actions);
    card.append(image, body);
    photoList.append(card);
  }
}

export async function loadPhotos() {
  try {
    const data = await request('/api/admin/photos');
    photos = data.photos;
    renderList();
    if (wantSlug) {
      const target = photos.find((photo) => photo.slug === wantSlug);
      wantSlug = null;
      if (target) fillForm(target);
    }
  } catch (error) {
    setText(photoStatus, error instanceof Error ? error.message : '加载失败');
  }
}

export function initPhotos() {
  if (photoTakenAt) photoTakenAt.value = localToday();

  photoSrc?.addEventListener('input', updatePreview);
  $('photo-reset')?.addEventListener('click', resetForm);

  $('upload-button')?.addEventListener('click', async () => {
    const file = photoFile?.files?.[0];
    if (!file) {
      setText(uploadStatus, '先选择图片');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setText(uploadStatus, '上传中…');
    try {
      const data = await request('/api/admin/upload', { method: 'POST', body: form });
      if (photoSrc) photoSrc.value = data.url;
      if (photoSlug && !photoSlug.value.trim()) {
        const base = file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[^a-zA-Z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase();
        if (base) photoSlug.value = base;
      }
      const image = new Image();
      image.onload = () => {
        if (photoWidth && (!photoWidth.value || Number(photoWidth.value) === 1200))
          photoWidth.value = String(image.naturalWidth);
        if (photoHeight && (!photoHeight.value || Number(photoHeight.value) === 800))
          photoHeight.value = String(image.naturalHeight);
      };
      image.src = data.url;
      updatePreview();
      setText(uploadStatus, '已上传，记得保存照片');
    } catch (error) {
      setText(uploadStatus, error instanceof Error ? error.message : '上传失败');
    }
  });

  photoForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setText(photoStatus, '保存中…');
    const exif: Record<string, string> = {};
    for (const [key, input] of Object.entries(exifFields)) {
      if (input?.value.trim()) exif[key] = input.value.trim();
    }
    const payload = {
      title: photoTitle?.value.trim() ?? '',
      slug: photoSlug?.value.trim() ?? '',
      series: photoSeries?.value ?? 'anime',
      takenAt: photoTakenAt?.value ?? '',
      width: Number(photoWidth?.value ?? 1200),
      height: Number(photoHeight?.value ?? 800),
      src: photoSrc?.value.trim() ?? '',
      alt: photoAlt?.value.trim() ?? '',
      note: photoNote?.value.trim() ?? '',
      badge: photoBadge?.value.trim() ?? '',
      sortOrder: Number(photoSortOrder?.value ?? 0),
      exif,
    };

    try {
      const id = photoId?.value;
      if (id) {
        await request(`/api/admin/photos/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await request('/api/admin/photos', { method: 'POST', body: JSON.stringify(payload) });
      }
      setText(photoStatus, '已保存');
      resetForm();
      await loadPhotos();
    } catch (error) {
      setText(photoStatus, error instanceof Error ? error.message : '保存失败');
    }
  });

  photoDelete?.addEventListener('click', async () => {
    const id = photoId?.value;
    if (!id || !window.confirm('确定删除这张照片吗？')) return;
    try {
      await request(`/api/admin/photos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      resetForm();
      await loadPhotos();
      setText(photoStatus, '已删除');
    } catch (error) {
      setText(photoStatus, error instanceof Error ? error.message : '删除失败');
    }
  });

  $('refresh-button')?.addEventListener('click', () => void loadPhotos());
}
