export const SITE = {
  name: '风屿书房',
  latin: 'Island of Solitude',
  tagline: 'Read · Listen · Capture · Write',
  description: '一个大学生收藏网文、酷狗歌单、影像与随笔的数字秘密基地。',
  author: '岛屿同学',
  startYear: 2025,
  url: import.meta.env.PUBLIC_SITE_URL ?? 'https://example.com',
} as const;

export const NAV = [
  { key: 'home', href: '/', label: '首页' },
  { key: 'reading', href: '/reading/', label: '读听' },
  { key: 'photos', href: '/photos/', label: '影集' },
  { key: 'essays', href: '/essays/', label: '随记' },
  { key: 'guestbook', href: '/guestbook/', label: '留言' },
] as const;

export type NavKey = (typeof NAV)[number]['key'];
