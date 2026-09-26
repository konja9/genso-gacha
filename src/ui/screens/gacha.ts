// ガチャ画面（最小版）
// ・1日1回の無料ガチャ、1回、10連
// ・SR以上確定までの残り回数を表示
// ・新しく入手した元素は、その場で学習対象になる
import { CONFIG } from '../../config';
import { today } from '../../core/date';
import type { PullOutcome } from '../../core/gacha';
import { pullsUntilPity } from '../../core/gacha';
import { RARITY_TABLE, getElement } from '../../data/elements';
import type { PullKind } from '../../state/game';
import { canPull, canUseFree, doPull, pullCost } from '../../state/game';
import { RARITIES } from '../../types';
import { renderCard } from '../card';
import { h, replaceChildren } from '../dom';
import { go } from '../nav';
import { store } from '../store';

export function renderGacha(root: HTMLElement): void {
  const status = h('section', { class: 'gacha-status' });
  const actions = h('section', { class: 'gacha-actions' });
  const result = h('section', { class: 'gacha-result', 'aria-live': 'polite' });

  replaceChildren(
    root,
    h('h1', { class: 'screen-title' }, 'ガチャ'),
    status,
    actions,
    result,
    h(
      'p',
      { class: 'rates muted' },
      `排出率 ${RARITIES.map((r) => `${r} ${Math.round(CONFIG.gacha.rates[r] * 100)}%`).join(' / ')}・${CONFIG.gacha.pity}回目までにSR以上確定・同じレア度では未所持を優先`,
    ),
  );
  refresh();

  function refresh(): void {
    const data = store.get();
    const day = today();
    replaceChildren(
      status,
      h('div', { class: 'stat stat-stone' }, h('span', { class: 'stat-value' }, data.stones), h('span', { class: 'stat-label' }, 'ガチャ石')),
      h('div', { class: 'stat stat-fragment' }, h('span', { class: 'stat-value' }, data.fragments), h('span', { class: 'stat-label' }, 'かけら')),
      h(
        'div',
        { class: 'stat stat-pity' },
        h('span', { class: 'stat-value' }, pullsUntilPity(data.pityCount)),
        h('span', { class: 'stat-label' }, 'SR以上確定まで'),
      ),
    );
    const complete = Object.keys(data.cards).length >= 118;
    replaceChildren(
      actions,
      complete ? h('p', { class: 'notice' }, '全118種そろいました！ これからは重複してかけらになります。') : null,
      pullButton('free', canUseFree(data, day) ? '無料で1回引く' : '今日の無料ガチャは引きました', '1日1回'),
      pullButton('single', '1回引く', `石${pullCost('single')}`),
      pullButton('ten', '10連で引く', `石${pullCost('ten')}`),
    );
  }

  function pullButton(kind: PullKind, label: string, cost: string): HTMLElement {
    const ok = canPull(store.get(), kind, today());
    return h(
      'button',
      { class: `btn btn-pull pull-${kind}`, disabled: !ok, onclick: () => pull(kind) },
      h('span', {}, label),
      h('span', { class: 'cost' }, cost),
    );
  }

  function pull(kind: PullKind): void {
    const day = today();
    if (!canPull(store.get(), kind, day)) return;
    const { data, outcomes } = doPull(store.get(), kind, day, RARITY_TABLE, Math.random);
    store.set(data);
    showResult(outcomes);
    refresh();
  }

  function showResult(outcomes: PullOutcome[]): void {
    const data = store.get();
    const newCount = outcomes.filter((o) => o.isNew).length;
    const fragments = outcomes.reduce((a, o) => a + o.fragments, 0);
    replaceChildren(
      result,
      h(
        'p',
        { class: 'result-line' },
        newCount > 0 ? `新しい元素 ${newCount} 種！` : '新しい元素はありませんでした',
        fragments > 0 ? `（重複ぶん かけら +${fragments}）` : '',
      ),
      h(
        'div',
        { class: outcomes.length > 1 ? 'result-grid' : 'result-single' },
        outcomes.map((o) =>
          renderCard(getElement(o.number), {
            size: outcomes.length > 1 ? 'mini' : 'full',
            progress: data.cards[o.number],
            tag: o.isNew ? 'NEW' : `かけら+${o.fragments}`,
            tagDup: !o.isNew,
          }),
        ),
      ),
      newCount > 0
        ? h(
            'div',
            { class: 'result-next' },
            h('p', { class: 'muted' }, '入手した元素は今日から復習の対象です。カードをよく見てから、さっそく思い出してみよう。'),
            h('button', { class: 'btn btn-primary', onclick: () => go('review') }, 'さっそく覚える（復習へ）'),
          )
        : null,
    );
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
