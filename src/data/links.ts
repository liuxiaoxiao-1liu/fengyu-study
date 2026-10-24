/**
 * 友链种子数据。后台 /admin/ 的「友链」会接管这里；
 * url 留空的条目在页面上仍显示卡片，但链接回友链区，等房主补上真实地址。
 */
export type FriendLink = {
  slug: string;
  title: string;
  note: string;
  tag: string;
  url?: string;
};

export const friendLinks: FriendLink[] = [
  {
    slug: 'cloud-walk',
    title: '云中漫步',
    note: 'Astro 与前端引擎折腾记录',
    tag: 'CS 大四',
    url: '',
  },
  {
    slug: 'evening-store',
    title: '晚风便利店',
    note: '日常胶片记录与同人速写',
    tag: '二次元画师',
    url: '',
  },
  {
    slug: 'sunset-glow',
    title: '落日余晖',
    note: '网文书荒避难所 & 乐评',
    tag: '古典吉他',
    url: '',
  },
  {
    slug: 'heart-realm',
    title: '心素之境',
    note: '白灵淼同人与街头纪实摄影',
    tag: '《道诡》骨灰粉',
    url: '',
  },
];
