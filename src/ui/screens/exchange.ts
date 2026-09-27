// かけら交換画面：かけらを使って、好きな未所持元素を1枚手に入れる
import { CONFIG } from '../../config';
import { unownedByRarity } from '../../core/gacha';
import { RARITY_TABLE, getElement } from '../../data/elements';
import { exchangeFragments } from '../../state/game';
import type { Rarity } from '../../types';
import { renderCard } from '../card';
import { CATEGORY_CLASS, RARITY_CLASS } from '../colors';
import { h, replaceChildren } from '../dom';
import { go } from '../nav';
import { store } from '../store';

/** 希少なものから並べる */
const ORDER: Rarity[] = ['SSR', 'SR', 'R', 'N'];

export function renderExchange(root: HTMLElement): void {
  render();

  function render(): void {
    const data = store.get();
    const cost = CONFIG.fragments.exchangeCost;
    const enough = data.fragments >= cost;
    const unowned = unownedByRarity(new Set(Object.keys(data.cards).map(Number)), RARITY_TABLE);
    const rest = ORDER.reduce((a, r) => a + unowned[r].length, 0);

    replaceChildren(
      root,
      h('div', { class: 'screen-head' }, h('button', { class: 'link-btn', onclick: () => go('gacha') }, '← ガチャへ'), h('h1', { class: 'screen-title' }, 'かけら交換')),
      h(
        'section',
        { class: 'panel' },
        h('p', {}, `かけら ${cost} 個で、好きな未所持元素を1枚手に入れられます。`),
        h('p', { class: 'big-number fragment-count' }, data.fragments, h('small', {}, ` / ${cost} 個`)),
        !enough ? h('p', { class: 'muted' }, 'かけらは、すでに持っている元素がガチャで出たときにもらえます。') : null,
      ),
      rest === 0
        ? h('p', { class: 'notice' }, '全118種そろっています！')
        : ORDER.filter((r) => unowned[r].length > 0).map((r) =>
            h(
              'section',
              { class: 'exchange-group' },
              h('h2', {}, h('span', { class: `rar-badge ${RARITY_CLASS[r]}` }, r), ` 未所持 ${unowned[r].length}種`),
              h(
                'div',
                { class: 'exchange-list' },
                unowned[r].map((n) => {
                  const e = getElement(n);
                  return h(
                    'button',
                    { class: `exchange-item ${CATEGORY_CLASS[e.category]} ${RARITY_CLASS[r]}`, disabled: !enough, onclick: () => pick(n) },
                    h('span', { class: 'ex-num' }, n),
                    h('span', { class: 'ex-symbol' }, e.symbol),
                    h('span', { class: 'ex-name' }, e.nameJa),
                  );
                }),
              ),
            ),
          ),
    );
  }

  function pick(n: number): void {
    const e = getElement(n);
    if (!confirm(`かけら ${CONFIG.fragments.exchangeCost} 個で「${e.nameJa}（${e.symbol}）」と交換しますか？`)) return;
    const next = exchangeFragments(store.get(), n, new Date());
    store.set(next);
    replaceChildren(
      root,
      h('h1', { class: 'screen-title' }, '交換しました！'),
      h('div', { class: 'result-single' }, renderCard(e, { progress: next.cards[n], tag: 'NEW' })),
      h(
        'div',
        { class: 'result-next' },
        h('button', { class: 'btn btn-primary', onclick: () => go('review') }, 'さっそく覚える（復習へ）'),
        h('button', { class: 'btn btn-sub', onclick: () => render() }, '続けて交換する'),
      ),
    );
  }
}
