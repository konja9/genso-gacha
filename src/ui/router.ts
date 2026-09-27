// 画面の切り替え。URL の # の後ろ（#/gacha など）で画面を決める。
// GitHub Pages でもページの再読み込みで迷子にならないよう、# を使う方式にしている。
import { dueList } from '../core/srs';
import { today } from '../core/date';
import { h, replaceChildren } from './dom';
import { store } from './store';
import { renderHome } from './screens/home';
import { renderReview } from './screens/review';
import { renderGacha } from './screens/gacha';
import { renderSettings } from './screens/settings';
import { renderExchange } from './screens/exchange';
import { renderZukan } from './screens/zukan';
import { renderStats } from './screens/stats';
import type { Route } from './nav';
import { currentRoute } from './nav';

/** 画面を描く関数。後片付けが必要なら関数を返す */
export type Screen = (root: HTMLElement) => void | (() => void);

const SCREENS: Record<Route, Screen> = {
  home: renderHome,
  review: (root) => renderReview(root, 'due'),
  practice: (root) => renderReview(root, 'practice'),
  gacha: renderGacha,
  exchange: renderExchange,
  zukan: renderZukan,
  stats: renderStats,
  settings: renderSettings,
};

/** 下のタブ（practice は「復習」、exchange は「ガチャ」、settings は「記録」タブの仲間として扱う） */
const TABS: { route: Route; label: string; icon: string }[] = [
  { route: 'home', label: 'ホーム', icon: '⌂' },
  { route: 'review', label: '復習', icon: '✎' },
  { route: 'gacha', label: 'ガチャ', icon: '✦' },
  { route: 'zukan', label: '図鑑', icon: '▦' },
  { route: 'stats', label: '記録', icon: '↗' },
];

let main: HTMLElement;
let nav: HTMLElement;
let cleanup: (() => void) | void;

function render(): void {
  if (cleanup) cleanup();
  const route = currentRoute();
  main.textContent = '';
  main.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  cleanup = SCREENS[route](main);
  renderNav();
}

function renderNav(): void {
  const route = currentRoute();
  const parent: Partial<Record<Route, Route>> = { practice: 'review', exchange: 'gacha', settings: 'stats' };
  const active = parent[route] ?? route;
  const due = dueList(store.get().cards, today()).length;
  replaceChildren(
    nav,
    TABS.map((t) =>
      h(
        'a',
        { href: `#/${t.route}`, class: t.route === active ? 'tab active' : 'tab', 'aria-current': t.route === active ? 'page' : undefined },
        h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, t.icon),
        h('span', { class: 'tab-label' }, t.label),
        t.route === 'review' && due > 0 ? h('span', { class: 'tab-badge' }, due) : null,
      ),
    ),
  );
}

export function startRouter(app: HTMLElement): void {
  main = h('main', { class: 'screen' });
  nav = h('nav', { class: 'tabbar', 'aria-label': '画面の切り替え' });
  app.append(main, nav);
  window.addEventListener('hashchange', render);
  window.addEventListener('app:rerender', render);
  store.subscribe(renderNav);
  // 日付が変わった後にアプリへ戻ってきたとき、ホームとガチャの表示を新しくする
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const r = currentRoute();
    if (r === 'home' || r === 'gacha') render();
    else renderNav();
  });
  render();
}
