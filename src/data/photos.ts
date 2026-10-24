/**
 * 影集数据：动漫、现实、虚拟 CG 三个系列。
 * 图片全部复用 public/images/photos/ 下已有素材。
 */
export type PhotoSeries = 'anime' | 'reality' | 'virtual';

export type PhotoExif = {
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
  location?: string;
};

export type Photo = {
  slug: string;
  title: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  series: PhotoSeries;
  takenAt: string;
  note: string;
  /** 卡片左上角展示的创作方式 / 胶卷信息 */
  badge: string;
  exif?: PhotoExif;
};

export const SERIES_LABELS: Record<PhotoSeries, string> = {
  anime: '动漫原画',
  reality: '现实纪实',
  virtual: '虚拟 CG',
};

export const SERIES_FILTERS: ReadonlyArray<{ value: PhotoSeries; label: string; english: string }> = [
  { value: 'anime', label: '动漫插画', english: 'Anime & Manga' },
  { value: 'reality', label: '现实纪实', english: 'Realism & Film' },
  { value: 'virtual', label: '虚拟 CG', english: 'Virtual Render' },
];

export const photos: Photo[] = [
  {
    slug: 'desk-afternoon-light',
    title: '三楼靠窗的午后光线',
    src: '/images/photos/desk.jpg',
    alt: '暖金色斜光穿过木质书桌，落在一本翻开的旧书上',
    width: 512,
    height: 279,
    series: 'anime',
    takenAt: '2025-10-18',
    note: '日光在木纹桌面上慢慢爬行，时间在这里变得肉眼可见。',
    badge: 'ANIME STYLE · 原画',
    exif: {
      camera: 'Procreate 5X',
      lens: '画布 4096 × 2731',
      aperture: '—',
      shutter: '约 6 小时',
      iso: '—',
      location: '图书馆三楼 · 靠窗座位',
    },
  },
  {
    slug: 'dusk-track-shadows',
    title: '黄昏操场奔跑的影子',
    src: '/images/photos/track.jpg',
    alt: '大学跑道上被夕阳拉长的奔跑身影',
    width: 512,
    height: 286,
    series: 'reality',
    takenAt: '2025-09-27',
    note: '影子拉得很长很长，仿佛能一路奔跑进整个青春。',
    badge: 'PORTRA 400 · 35MM',
    exif: {
      camera: 'Canon AE-1',
      lens: 'FD 50mm F1.8',
      aperture: 'f/2.8',
      shutter: '1/500s',
      iso: 'ISO 400',
      location: '东区操场 · 傍晚六点',
    },
  },
  {
    slug: 'rainy-convenience-store',
    title: '雨夜便利店的赛博霓虹',
    src: '/images/photos/store.jpg',
    alt: '雨夜路面积水倒映着霓虹招牌，像一块被打碎的赛博屏幕',
    width: 512,
    height: 279,
    series: 'virtual',
    takenAt: '2025-08-30',
    note: '雨水将虚拟赛博倒置，电子霓虹永不熄灭。',
    badge: 'OCTANE RENDER · 4K',
    exif: {
      camera: 'Blender 4.2 · Cycles',
      lens: '35mm 虚拟镜头',
      aperture: 'f/1.8',
      shutter: '—',
      iso: '—',
      location: '虚拟街区 · 雨夜 23:40',
    },
  },
  {
    slug: 'old-book-coffee',
    title: '老街咖啡馆木桌上的半本旧书',
    src: '/images/photos/book-coffee.jpg',
    alt: '一本翻开的旧书、咖啡杯与眼镜，落在老木桌上',
    width: 512,
    height: 279,
    series: 'reality',
    takenAt: '2025-07-12',
    note: '纸张泛黄的气味与深烘豆香，是老巷子里最好的避难所。',
    badge: 'ILFORD HP5 · MONO',
    exif: {
      camera: 'Leica M6',
      lens: 'Summicron 35mm',
      aperture: 'f/2',
      shutter: '1/60s',
      iso: 'ISO 800',
      location: '老街咖啡馆 · 靠门木桌',
    },
  },
  {
    slug: 'sunset-riverside-bicycle',
    title: '落日熔金的江边单车',
    src: '/images/photos/bicycle.jpg',
    alt: '一辆靠在石栏上的旧单车，远处是被夕阳烧红的江面',
    width: 512,
    height: 279,
    series: 'virtual',
    takenAt: '2025-06-21',
    note: '水面荡漾着碎金，晚风吹散了整周积压的疲惫。',
    badge: 'BLENDER · RAYTRACED',
    exif: {
      camera: 'Blender 4.2 · EEVEE',
      lens: '50mm 虚拟镜头',
      aperture: 'f/4',
      shutter: '—',
      iso: '—',
      location: '虚拟江畔 · 落日 18:52',
    },
  },
  {
    slug: 'balcony-mint',
    title: '阳台养的薄荷与初冬晴天',
    src: '/images/photos/mint.jpg',
    alt: '冬日阳光下的薄荷叶片，叶脉清晰可见',
    width: 512,
    height: 279,
    series: 'anime',
    takenAt: '2025-11-02',
    note: '寒意渐浓，但这捧绿意依然倔强地贪恋晨光。',
    badge: 'PROCREATE · 300DPI',
    exif: {
      camera: 'Procreate 5X',
      lens: '画布 2480 × 1754',
      aperture: '—',
      shutter: '约 3 小时',
      iso: '—',
      location: '宿舍阳台 · 初冬上午',
    },
  },
];

export function photoBySlug(slug: string): Photo | undefined {
  return photos.find((photo) => photo.slug === slug);
}

export function formatPhotoDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}
