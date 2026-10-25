type PageLoadState = { main: HTMLElement | null; listening: boolean };

type PageLoadGlobal = {
  __fengyuPageLoadStates?: Record<string, PageLoadState>;
};

/**
 * 页面/组件脚本在 ClientRouter 换页后重新执行初始化。
 * 以新的 <main> 元素作为“这次导航”的标记；同一个 main 上重复调用只执行一次。
 */
export function onPageLoad(key: string, init: (main: HTMLElement) => void): void {
  const global = window as unknown as PageLoadGlobal;
  const states = (global.__fengyuPageLoadStates ??= {});
  const state = (states[key] ??= { main: null, listening: false });

  const run = (): void => {
    const main = document.querySelector<HTMLElement>('main');
    if (!main || main === state.main) return;
    state.main = main;
    init(main);
  };

  run();
  if (!state.listening) {
    state.listening = true;
    document.addEventListener('astro:page-load', run);
  }
}
