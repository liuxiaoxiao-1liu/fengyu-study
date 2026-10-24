/**
 * 酷狗 / 唱片归档数据。
 * 曲目没有上传音源时 audio 留空，页面会降级成酷狗搜索外链。
 */
export type Album = {
  slug: string;
  title: string;
  artist: string;
  cover: string;
  tag: string;
  /** 封面左上角的收藏标签 */
  label: string;
};

export type Track = {
  slug: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  tag: string;
  duration: string;
  /** 站内音频地址，例如 '/audio/big-fish.mp3'；没有音源就省略 */
  audio?: string;
  /**
   * 酷狗曲目元数据：服务端用它换播放直链。
   * hash / albumId / albumAudioId 来自酷狗搜索接口，只对本账号有权播放的曲目生效。
   */
  kugou?: { hash: string; albumId: string; albumAudioId: number };
  /** 官方 / 酷狗歌曲外链 */
  url?: string;
  note?: string;
  /** 是否属于单曲循环歌单 */
  repeat?: boolean;
  albumSlug?: string;
};

export const albums: Album[] = [
  {
    slug: 'big-fish',
    title: '大鱼 (Big Fish)',
    artist: '周深 · 蝰蛇纯净音效',
    cover: '/images/covers/album-bigfish.jpg',
    tag: '古风空灵',
    label: '酷狗TOP1',
  },
  {
    slug: 'breathing-wild',
    title: '呼吸之野 (Selected)',
    artist: '许嵩 · 酷狗热榜金曲',
    cover: '/images/covers/album-breathing.jpg',
    tag: '国风新潮',
    label: '华语经典',
  },
  {
    slug: 'specialz',
    title: 'SPECIALZ / 一途',
    artist: 'King Gnu · 咒术回战OP',
    cover: '/images/covers/album-specialz.jpg',
    tag: '提神燃曲',
    label: 'ACG热歌',
  },
  {
    slug: 'qilixiang',
    title: '七里香 / 晴天',
    artist: '周杰伦 · 蝰蛇母带重温',
    cover: '/images/covers/album-qilixiang.jpg',
    tag: '夏日回忆',
    label: '酷狗收藏',
  },
];

export const tracks: Track[] = [
  {
    slug: 'big-fish',
    title: '大鱼 (Big Fish)',
    artist: '周深',
    album: '大鱼',
    albumSlug: 'big-fish',
    cover: '/images/covers/album-bigfish.jpg',
    tag: '古风空灵',
    duration: '05:13',
    note: '动画电影《大鱼海棠》印象曲',
    repeat: true,
    kugou: {
      hash: '913ea11b77c1cb2cd11f2164d0406e2c',
      albumId: '1637713',
      albumAudioId: 38641536,
    },
  },
  {
    slug: 'hearing-hallucination',
    title: '幻听 (Hearing Hallucination)',
    artist: '许嵩',
    album: '梦游计',
    albumSlug: 'breathing-wild',
    cover: '/images/covers/album-breathing.jpg',
    tag: '蝰蛇全景声',
    duration: '04:32',
    note: '梦游计 / 酷狗热搜榜首',
    repeat: true,
    kugou: {
      hash: '24f5e7555646965cd7d1a924452b3300',
      albumId: '973046',
      albumAudioId: 32155790,
    },
  },
  {
    slug: 'blue-and-white-porcelain',
    title: '青花瓷',
    artist: '周杰伦',
    album: '我很忙',
    albumSlug: 'qilixiang',
    cover: '/images/covers/album-qilixiang.jpg',
    tag: '国风经典',
    duration: '03:59',
    note: '我很忙 / 酷狗华语流行榜',
    kugou: {
      hash: '37a8f50a9ec3b267c3cc6bec633d9c4a',
      albumId: '979856',
      albumAudioId: 32218352,
    },
  },
  {
    slug: 'gurenge',
    title: '红莲华 (Gurenge)',
    artist: 'LiSA',
    album: '鬼灭之刃 OP',
    albumSlug: 'specialz',
    cover: '/images/covers/album-specialz.jpg',
    tag: '超重低音',
    duration: '03:56',
    note: '鬼灭之刃 OP / ACG狂飙榜',
    kugou: {
      hash: '8e62077d4c68171fdb36075ef535ce67',
      albumId: '40473855',
      albumAudioId: 284861668,
    },
  },
  {
    slug: 'toward-clouds',
    title: '向云端',
    artist: '小霞 / 海来阿木',
    album: '向云端',
    albumSlug: 'big-fish',
    cover: '/images/covers/album-bigfish.jpg',
    tag: '治愈放空',
    duration: '03:45',
    note: '酷狗温暖民谣',
    kugou: {
      hash: '2e6d88a0ca2290ba32b614fc9c7ea43b',
      albumId: '74029376',
      albumAudioId: 518461178,
    },
  },
];

export const featuredTrack: Track = tracks[0]!;

/** 没有上传音源时，用酷狗搜索页兜底。 */
export function kugouSearchUrl(track: Pick<Track, 'title' | 'artist'>): string {
  const query = `${track.title} ${track.artist}`.trim();
  return `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${encodeURIComponent(query)}`;
}
