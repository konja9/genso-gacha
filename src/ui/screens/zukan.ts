// 図鑑：周期表のレイアウトで全118種を並べる
// ・未所持はシルエット（原子番号だけ）
// ・所持済みは、枠の色＝レア度、塗りの濃さ＝習熟度（段階）。マスターは★
// ・「分類で色分け」に切り替えると、周期表の分類の並びを見られる
// ・マスをタップすると詳しい表示
import { CONFIG } from '../../config';
import { daysBetween, today } from '../../core/date';
import { gridPos } from '../../core/periodic';
import { isMastered } from '../../core/srs';
import { ELEMENTS, RARITY_TABLE, getElement, rarityOf } from '../../data/elements';
import { CATEGORIES, RARITIES } from '../../types';
import { renderCard } from '../card';
import { CATEGORY_CLASS, RARITY_CLASS } from '../colors';
import { h, replaceChildren } from '../dom';
import { displayRow } from '../minitable';
import { go } from '../nav';
import { store } from '../store';

type ColorMode = 'rarity' | 'category';
const MODE_KEY = 'genso-gacha/zukan-mode';

export function renderZukan(root: HTMLElement): void {
  let mode: ColorMode = readMode();
  const dialog = h('dialog', { class: 'zukan-dialog' });
  dialog.addEventListener('click', (ev) => {
    if (ev.target === dialog) dialog.close(); // 外側をタップで閉じる
  });
  render();

  function render(): void {
    const data = store.get();
    const owned = Object.keys(data.cards).length;
    replaceChildren(
      root,
      h('h1', { class: 'screen-title' }, '図鑑'),
      h(
        'section',
        { class: 'zukan-summary' },
        h('p', { class: 'zukan-total' }, h('strong', {}, owned), ' / 118 種'),
        h(
          'div',
          { class: 'zukan-rarity' },
          RARITIES.map((r) => {
            const have = RARITY_TABLE[r].filter((n) => data.cards[n]).length;
            return h('span', { class: `rar-badge ${RARITY_CLASS[r]}` }, `${r} ${have}/${RARITY_TABLE[r].length}`);
          }),
        ),
      ),
      h(
        'div',
        { class: 'segmented', role: 'group', 'aria-label': '色分け' },
        modeButton('rarity', 'レア度・習熟度'),
        modeButton('category', '分類'),
      ),
      table(),
      legend(),
      dialog,
    );
  }

  function modeButton(m: ColorMode, label: string): HTMLElement {
    return h(
      'button',
      {
        class: m === mode ? 'seg active' : 'seg',
        'aria-pressed': m === mode ? 'true' : 'false',
        onclick: () => {
          mode = m;
          try {
            localStorage.setItem(MODE_KEY, m);
          } catch {
            /* 保存できなくても表示は切り替える */
          }
          render();
        },
      },
      label,
    );
  }

  function table(): HTMLElement {
    const data = store.get();
    const cells = ELEMENTS.map((e) => {
      const { row, col } = gridPos(e);
      const c = data.cards[e.number];
      const style = `grid-row:${displayRow(row)};grid-column:${col}`;
      if (!c) {
        return h('button', { class: 'zukan-cell unowned', style, 'aria-label': `原子番号${e.number}（未所持）`, onclick: () => open(e.number) }, h('span', { class: 'zc-num' }, e.number));
      }
      const cls = ['zukan-cell', 'owned', mode === 'rarity' ? RARITY_CLASS[rarityOf(e.number)] : CATEGORY_CLASS[e.category], mode === 'rarity' ? `lv-${c.stage}` : 'by-cat', isMastered(c) ? 'mastered' : ''];
      return h('button', { class: cls.filter(Boolean).join(' '), style, 'aria-label': `${e.nameJa}（段階${c.stage}）`, onclick: () => open(e.number) }, h('span', { class: 'zc-sym' }, e.symbol));
    });
    // ランタノイド・アクチノイドが入る場所の目印
    const markers = [
      h('span', { class: 'zukan-marker', style: 'grid-row:6;grid-column:3' }, '57-71'),
      h('span', { class: 'zukan-marker', style: 'grid-row:7;grid-column:3' }, '89-103'),
    ];
    return h('div', { class: 'zukan-table' }, cells, markers);
  }

  function legend(): HTMLElement {
    if (mode === 'category') {
      return h('div', { class: 'zukan-legend' }, CATEGORIES.map((c) => h('span', { class: `legend-item ${CATEGORY_CLASS[c]}` }, h('i', {}), c)));
    }
    return h(
      'div',
      { class: 'zukan-legend' },
      h('span', { class: 'legend-note' }, '枠の色＝レア度、塗りの濃さ＝習熟度（段階0→5）、★＝マスター、暗いマス＝未所持'),
      h('span', { class: 'legend-ramp' }, [0, 1, 2, 3, 4, 5].map((s) => h('span', { class: `zukan-cell owned rar-r lv-${s}` }, h('span', { class: 'zc-sym' }, s)))),
    );
  }

  function open(n: number): void {
    const e = getElement(n);
    const c = store.get().cards[n];
    const close = h('button', { class: 'btn btn-sub', onclick: () => dialog.close() }, '閉じる');
    if (!c) {
      replaceChildren(
        dialog,
        h(
          'div',
          { class: `card card-full silhouette ${RARITY_CLASS[rarityOf(n)]}` },
          h('div', { class: 'card-top' }, h('span', { class: 'card-num' }, n), h('span', { class: 'card-rarity' }, rarityOf(n))),
          h('div', { class: 'silhouette-mark' }, '？'),
          h('p', { class: 'muted' }, 'まだ持っていない元素です'),
          h('p', { class: 'muted' }, `${e.period}周期・${e.group}族`),
        ),
        h('button', { class: 'btn btn-primary', onclick: () => { dialog.close(); go('gacha'); } }, 'ガチャへ'),
        close,
      );
    } else {
      const day = today();
      const days = daysBetween(day, c.due);
      replaceChildren(
        dialog,
        renderCard(e, { progress: c }),
        h(
          'dl',
          { class: 'progress-facts' },
          h('div', {}, h('dt', {}, '段階'), h('dd', {}, `${c.stage} / ${CONFIG.srs.masterStage}`)),
          h('div', {}, h('dt', {}, '次の復習'), h('dd', {}, days <= 0 ? '今日' : days === 1 ? '明日' : `${days}日後`)),
          h('div', {}, h('dt', {}, '正解'), h('dd', {}, `${c.correct} / ${c.reviews}回`)),
          h('div', {}, h('dt', {}, '入手日'), h('dd', {}, c.obtainedOn.replace(/-/g, '/'))),
        ),
        close,
      );
    }
    dialog.showModal();
  }
}

function readMode(): ColorMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'category' ? 'category' : 'rarity';
  } catch {
    return 'rarity';
  }
}
