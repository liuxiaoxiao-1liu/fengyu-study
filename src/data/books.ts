/**
 * 网文书架数据。页面只从这里取书名、封面、外链与卡片文案，
 * 不在模板里重复维护卡片内容。
 */
export type BookStatus = 'reading' | 'finished' | 'paused';
export type BookCategory = 'webnovel' | 'suspense';

export type Book = {
  slug: string;
  title: string;
  author: string;
  genre: string;
  status: BookStatus;
  year: number;
  cover: string;
  url: string;
  blurb: string;
  /** 阅读页筛选用的分类：玄幻奇幻 / 悬疑志怪 */
  category?: BookCategory;
  /** 卡片右上角字数与进度说明 */
  words?: string;
  /** 阅读进度文案 */
  progress?: string;
  /** 重点书卡上的摘句 */
  quote?: string;
  /** 卡片底部注记 */
  footer?: string;
  /** 首页书架是否展示 */
  featured?: boolean;
};

export const books: Book[] = [
  {
    slug: 'lord-of-mysteries',
    title: '《诡秘之主》',
    author: '爱潜水的乌贼',
    genre: '克苏鲁奇幻 · 蒸汽朋克',
    status: 'finished',
    year: 2024,
    cover: '/images/covers/book-guimi.jpg',
    url: 'https://www.qidian.com/book/1010868264/',
    blurb:
      '塔罗会二十二条序列魔药途径的宏大架构。克莱恩从廷根值夜者一路升格，每一次扮演与锚定都令人拍案惊奇。',
    category: 'webnovel',
    words: '446万字 · 完结二刷',
    progress: '第六卷 逐光者 · 84%',
    quote: '“我们是守夜人，也是一群时刻对抗着疯狂与危险的绝望者。赞美愚者先生！”',
    footer: '在起点阅读《诡秘之主》',
    featured: true,
  },
  {
    slug: 'dao-of-the-devil',
    title: '《道诡异仙》',
    author: '狐尾的笔',
    genre: '悬疑志怪 · 克系修仙',
    status: 'finished',
    year: 2025,
    cover: '/images/covers/book-daogui.jpg',
    url: 'https://www.qidian.com/book/1031794030/',
    blurb:
      '“妈，我分不清，我真的分不清啊！”游走在现代精神病院与扭曲克苏鲁修真界之间，李火旺每一次挥刀斩出的红中坐忘道。',
    category: 'suspense',
    words: '210万字 · 追读进度 100%',
    footer: '坐忘道心素篇 · 白灵淼线评析',
  },
  {
    slug: 'red-heart-crossing-heaven',
    title: '《赤心巡天》',
    author: '情何以甚',
    genre: '仙侠传统 · 争鸣热血',
    status: 'reading',
    year: 2025,
    cover: '/images/covers/book-chixin.jpg',
    url: 'https://www.qidian.com/book/1016530091/',
    blurb:
      '“我姜望行事，自有一柄三昧真火与青云剑。”群雄并立的列国世界观，文笔洗练，黄河之会群像极具张力。',
    category: 'webnovel',
    words: '650万字 · 追更中',
    footer: '太虚幻境与临淄天下演武',
  },
  {
    slug: 'deep-space-shore',
    title: '《深空彼岸》',
    author: '辰东',
    genre: '科幻修真 · 星际长河',
    status: 'finished',
    year: 2024,
    cover: '/images/covers/book-shenkong.jpg',
    url: 'https://www.qidian.com/book/1027339371/',
    blurb:
      '“枯寂的旧土与浩瀚新星，当旧术与新星科技对撞，王煊一人执炉横渡超凡光海。”辰东大开大合的宇宙想象力。',
    category: 'webnovel',
    words: '530万字 · 完结精修',
    footer: '神明熄灭与地仙泉探索笔记',
  },
  {
    slug: 'release-that-witch',
    title: '《放开那个女巫》',
    author: '二目',
    genre: '种田奇幻 · 工业革命',
    status: 'finished',
    year: 2024,
    cover: '/images/covers/book-nvwu.jpg',
    url: 'https://www.qidian.com/book/1003306811/',
    blurb: '工程师罗兰在边陲小镇点燃蒸汽机与火枪，与女巫们一起将魔法当作第一生产力推进文明复兴。',
    category: 'webnovel',
    words: '336万字 · 经典馆藏',
    footer: '无冬城工业蓝图与魔力解析',
  },
];

export const featuredBook: Book = books.find((book) => book.featured) ?? books[0]!;
