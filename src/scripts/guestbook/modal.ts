type Bottle = {
  text: string;
  author: string;
};

// 打捞漂流瓶（站内示例心事，不含私密留言）
const bottles: Bottle[] = [
  {
    text: '“今晚在操场跑完五公里，躺在草坪上看冬夜猎户座。耳机里正好放到周深的《化身孤岛的鲸》，突然觉得大学四年哪怕有再多迷茫，这一刻的风也是真实的。”',
    author: '— 匿名漫游者 (投递于 2025.02.14)',
  },
  {
    text: '“看完了《诡秘之主》最后一章，合上书的时候宿舍已经熄灯了。愚者先生回到了属于他的地方，而我还得赶明天八点的早课。但今晚的黑暗好像没那么难熬了。”',
    author: '— 贝克兰德夜行人 (投递于 2025.03.02)',
  },
  {
    text: '“在图书馆四楼靠窗的位置复习，阳光正好落在『道诡异仙』的封面上。李火旺分不清，我也分不清，到底是这世界疯了，还是我们都在假装正常。”',
    author: '— 心素未泯 (投递于 2025.01.27)',
  },
  {
    text: '“答辩结束的那天傍晚，我一个人走到操场，把耳机里《起风了》放到最大声。四年就这样过去了，好像一首歌的时间。”',
    author: '— 即将离校的岛民 (投递于 2025.05.20)',
  },
  {
    text: '“第一次在机房通宵渲图，凌晨四点的校园安静得像另一个星球。如果你也还没睡，请记得窗外的天很快就要亮了。”',
    author: '— 建模喵 (投递于 2025.04.11)',
  },
  {
    text: '“把这张小站存进了浏览器书签栏。以后不开心的时候，就来这里看看别人的日常，感觉世界还没有那么糟。”',
    author: '— 路过的旅人 (投递于 2025.06.06)',
  },
];

export function initBottleModal() {
  const modal = document.querySelector<HTMLElement>('[data-bottle-modal]');
  const quoteEl = document.getElementById('bottle-quote');
  const authorEl = document.getElementById('bottle-author');
  let bottleIndex = 0;

  function openBottle() {
    bottleIndex = Math.floor(Math.random() * bottles.length);
    const b = bottles[bottleIndex];
    if (quoteEl) quoteEl.textContent = b.text;
    if (authorEl) authorEl.textContent = b.author;
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
  }

  function closeBottle() {
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  }

  for (const btn of document.querySelectorAll<HTMLElement>('[data-fish]')) btn.addEventListener('click', openBottle);
  for (const btn of document.querySelectorAll<HTMLElement>('[data-close-bottle]'))
    btn.addEventListener('click', closeBottle);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeBottle();
  });
}
