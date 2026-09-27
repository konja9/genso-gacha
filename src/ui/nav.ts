// 画面の移動。各画面からはここの go() を呼ぶ。

export type Route = 'home' | 'review' | 'practice' | 'gacha' | 'exchange' | 'zukan' | 'stats' | 'settings';

export const ROUTES: readonly Route[] = ['home', 'review', 'practice', 'gacha', 'exchange', 'zukan', 'stats', 'settings'];

/** 今の URL から画面を決める（知らないものはホーム） */
export function currentRoute(): Route {
  const r = location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(r) ? r : 'home';
}

/** 画面を移動する。同じ画面へ移動したときは描き直す */
export function go(route: Route): void {
  if (currentRoute() === route) window.dispatchEvent(new Event('app:rerender'));
  else location.hash = `#/${route}`;
}
