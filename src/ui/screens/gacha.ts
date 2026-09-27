// ガチャ画面
// ・6時間ごとに回復する無料ガチャ（0時・6時・12時・18時）、1回、10連（SR以上1枚確定）
// ・SR以上確定までの残り回数を表示
// ・引くとレア度に応じた色の光の演出が入り、カードが1枚ずつ現れる
// ・新しく入手した元素は、その場で学習対象になる
// ・かけらがたまったら、交換画面へ進める
import { CONFIG } from '../../config';
import { formatDuration, nextFreeSlotAt } from '../../core/date';
import type { PullOutcome } from '../../core/gacha';
import { highestRarity, pullsUntilPity } from '../../core/gacha';
import { RARITY_TABLE, getElement } from '../../data/elements';
import type { PullKind } from '../../state/game';
import { canExchange, canPull, canUseFree, doPull, pullCost } from '../../state/game';
import { RARITIES } from '../../types';
import { renderCard } from '../card';
import { h, replaceChildren } from '../dom';
import { playGachaEffect } from '../effects';
import { go } from '../nav';
import { store } from '../store';

export function renderGacha(root: HTMLElement): () => void {
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
      `排出率 ${RARITIES.map((r) => `${r} ${Math.round(CONFIG.gacha.rates[r] * 100)}%`).join(' / ')}・${CONFIG.gacha.pity}回目までにSR以上確定${CONFIG.gacha.tenGuaranteeHigh ? '・10連はSR以上1枚確定' : ''}・同じレア度では未所持を優先`,
    ),
  );
  /** 演出中は二重に引けないようにする */
  let busy = false;
  refresh();
  // 無料ガチャの回復や残り時間を反映するため、30秒ごとにボタンを描き直す
  const timer = setInterval(() => {
    if (!busy) refresh();
  }, 30_000);
  return () => clearInterval(timer);

  function refresh(): void {
    const data = store.get();
    const now = new Date();
    const free = canUseFree(data, now);
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
      pullButton(
        'free',
        free ? '無料で1回引く' : `次の無料まで あと${formatDuration(nextFreeSlotAt(now).getTime() - now.getTime())}`,
        free ? '6時間ごと' : `${CONFIG.gacha.freeSlotStartHours.join('・')}時に回復`,
      ),
      pullButton('single', '1回引く', `石${pullCost('single')}`),
      pullButton('ten', '10連で引く', CONFIG.gacha.tenGuaranteeHigh ? `石${pullCost('ten')}・SR以上1枚確定` : `石${pullCost('ten')}`),
      h(
        'button',
        { class: 'btn btn-sub btn-exchange', disabled: !canExchange(data), onclick: () => go('exchange') },
        h('span', {}, 'かけらで好きな元素と交換'),
        h('span', { class: 'cost' }, `かけら${CONFIG.fragments.exchangeCost}`),
      ),
    );
  }

  function pullButton(kind: PullKind, label: string, cost: string): HTMLElement {
    const ok = canPull(store.get(), kind, new Date());
    return h(
      'button',
      { class: `btn btn-pull pull-${kind}`, disabled: !ok, onclick: () => pull(kind) },
      h('span', {}, label),
      h('span', { class: 'cost' }, cost),
    );
  }

  async function pull(kind: PullKind): Promise<void> {
    const now = new Date();
    if (busy || !canPull(store.get(), kind, now)) return;
    busy = true;
    // 先に結果を決めて保存してから演出を見せる（演出中にアプリを閉じても結果は消えない）
    const { data, outcomes } = doPull(store.get(), kind, now, RARITY_TABLE, Math.random);
    store.set(data);
    refresh();
    result.textContent = '';
    await playGachaEffect(highestRarity(outcomes));
    showResult(outcomes);
    busy = false;
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
        outcomes.map((o, i) => {
          const card = renderCard(getElement(o.number), {
            size: outcomes.length > 1 ? 'mini' : 'full',
            progress: data.cards[o.number],
            tag: o.isNew ? 'NEW' : `かけら+${o.fragments}`,
            tagDup: !o.isNew,
          });
          // 1枚ずつ順番に現れる
          card.classList.add('reveal');
          card.style.animationDelay = `${i * 0.12}s`;
          return card;
        }),
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
