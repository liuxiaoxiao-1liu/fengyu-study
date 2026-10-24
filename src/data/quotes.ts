/**
 * 台词摘录数据：来自随记里的 quote 字段与页面上现有的摘句。
 * 随记页「台词摘录」筛选卡片只读这里。
 */
export type Quote = {
  id: string;
  text: string;
  source: string;
  work?: string;
  date?: string;
  tags: string[];
};

export const quotes: Quote[] = [
  {
    id: 'webnovel-shelter',
    text: '“网文不是逃避，而是给紧绷的现实搭起的一座避风港。”',
    source: '为什么当代大学生依然离不开网文与老歌？',
    work: '随记 · 网文与酷狗听歌杂记',
    date: '2025-11-04',
    tags: ['网文', '深夜'],
  },
  {
    id: 'night-watchers',
    text: '“我们是守夜人，也是一群时刻对抗着疯狂与危险的绝望者。赞美愚者先生！”',
    source: '《追完〈诡秘之主〉：当代网文的叙事宿命感》',
    work: '随记 · 网文随笔',
    date: '2024-12-20',
    tags: ['诡秘之主', '守夜人'],
  },
  {
    id: 'sunny-day',
    text: '“刮风这天，我试过握着你手，但偏偏雨渐渐……”',
    source: '周杰伦《晴天》',
    work: '随记 · 戴着耳机在操场漫步',
    date: '2024-11-15',
    tags: ['周杰伦', '老歌'],
  },
  {
    id: 'coffee-rain',
    text: '“生活的答案往往藏在无关紧要的细节里。”',
    source: '在周末的咖啡馆听雨',
    work: '随记 · 周末',
    date: '2025-11-04',
    tags: ['咖啡馆', '雨天'],
  },
  {
    id: 'digital-garden',
    text: '“写作是把散落的东西收拢到一个地方。”',
    source: '为什么我们仍然需要一份自己的数字花园',
    work: '随记 · 数字花园',
    date: '2025-06-06',
    tags: ['写作', '数字花园'],
  },
  {
    id: 'imagination',
    text: '“用想象力对抗生活的琐碎平庸。”',
    source: '为什么当代大学生依然离不开网文与老歌？',
    work: '首页 · 杂感随笔',
    date: '2025-11-04',
    tags: ['网文', '想象力'],
  },
  {
    id: 'fool-prayer',
    text: '“赞美愚者！不属于这个时代的愚者，灰雾之上的神秘主宰，执掌好运的黄黑之王。”',
    source: '《诡秘之主》',
    work: '首页 · 网文书架',
    tags: ['诡秘之主', '愚者'],
  },
  {
    id: 'big-fish-lyric',
    text: '“看海天一色，听风起雨落，执子手吹散苍茫茫烟波。”',
    source: '周深《大鱼》',
    work: '读听 · 酷狗音乐档案',
    tags: ['大鱼', '国风'],
  },
];
