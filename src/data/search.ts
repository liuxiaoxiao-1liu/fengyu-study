export type SearchEntry = {
  title: string;
  href: string;
  kind: string;
  summary: string;
};

/** 站内搜索的轻量索引：页面、随记、书、歌、照片。 */
export const searchIndex: SearchEntry[] = [
  { title: '首页', href: '/', kind: '页面', summary: '欢迎光临我的数字秘密基地。' },
  { title: '读听', href: '/reading/', kind: '页面', summary: '追更书架、年度网文与酷狗音乐档案。' },
  { title: '影集', href: '/photos/', kind: '页面', summary: '动漫、摄影与虚拟 CG 的视觉灵感档案。' },
  { title: '随记', href: '/essays/', kind: '页面', summary: '慢慢写下的随笔、书评与歌单笔记。' },
  { title: '留言 & 时光信箱', href: '/guestbook/', kind: '页面', summary: '投递一枚字句，等它在夜里被拆封。' },

  { title: '为什么当代大学生依然离不开网文与老歌？', href: '/essays/why-webnovels-and-old-songs/', kind: '随记', summary: '深夜、耳机与网文章节，给紧绷的现实搭一座避风港。' },
  { title: '《追完〈诡秘之主〉：当代网文的叙事宿命感》', href: '/essays/lord-of-mysteries/', kind: '随记', summary: '当代优秀网文早已脱离了单纯的升级爽快，构建起工业维多利亚与神话克苏鲁交织的庞大宇宙。' },
  { title: '《戴着耳机用酷狗听老歌，在大学操场漫步》', href: '/essays/campus-walk-playlist/', kind: '随记', summary: '周杰伦《晴天》与操场夜风，一代人共同的青春声轨。' },
  { title: '在周末的咖啡馆听雨', href: '/essays/coffee-shop-rain/', kind: '随记', summary: '窗外的雨丝将路灯的光晕染成浅橘色，邻座的同学正对着微积分习题抓耳挠腮。' },
  { title: '为什么我们仍然需要一份自己的数字花园', href: '/essays/digital-garden/', kind: '随记', summary: '在速食信息的节奏里，留一块可以慢慢长大的地方。' },

  { title: '诡秘之主', href: '/reading/#shelf', kind: '网文', summary: '爱潜水的乌贼 · 克苏鲁奇幻 · 蒸汽朋克。' },
  { title: '道诡异仙', href: '/reading/#shelf', kind: '网文', summary: '狐尾的笔 · 悬疑志怪 · 克系修仙。' },
  { title: '赤心巡天', href: '/reading/#shelf', kind: '网文', summary: '情何以甚 · 古典仙侠 · 争鸣热血。' },
  { title: '深空彼岸', href: '/reading/#shelf', kind: '网文', summary: '辰东 · 科幻修真 · 星际长河。' },
  { title: '放开那个女巫', href: '/reading/#shelf', kind: '网文', summary: '二目 · 种田奇幻 · 工业革命。' },

  { title: '大鱼', href: '/reading/#music', kind: '酷狗', summary: '周深 · 动画电影《大鱼海棠》印象曲。' },
  { title: '呼吸之野', href: '/reading/#music', kind: '酷狗', summary: '许嵩 · 酷狗热榜金曲。' },
  { title: 'SPECIALZ / 一途', href: '/reading/#music', kind: '酷狗', summary: 'King Gnu · 咒术回战 OP。' },
  { title: '七里香 / 晴天', href: '/reading/#music', kind: '酷狗', summary: '周杰伦 · 磁带重温。' },

  { title: '三楼靠窗的午后光线', href: '/photos/#gallery', kind: '影集', summary: '暖金色斜光穿过木质书桌，落在一本翻开的旧书上。' },
  { title: '黄昏操场奔跑的影子', href: '/photos/#gallery', kind: '影集', summary: '大学跑道上被夕阳拉长的影子。' },
  { title: '雨夜便利店的赛博霓虹', href: '/photos/#gallery', kind: '影集', summary: '雨夜路面倒映着霓虹招牌，像一块被打碎的赛博屏幕。' },
  { title: '老街咖啡馆木桌上的半本旧书', href: '/photos/#gallery', kind: '影集', summary: '旧书、咖啡与眼镜，一个下午的光。' },
  { title: '落日熔金的江边单车', href: '/photos/#gallery', kind: '影集', summary: '自行车靠在石栏上，远处是被夕阳烧红的江面。' },
  { title: '阳台养的薄荷与初冬晴天', href: '/photos/#gallery', kind: '影集', summary: '薄荷叶脉在冬日阳光里清晰可见。' },
];
