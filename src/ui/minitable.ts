// 小さな周期表。不正解のとき、選んだ元素と正解の位置を見せる
import { ACTINOID_ROW, LANTHANOID_ROW, gridPos } from '../core/periodic';
import { ELEMENTS } from '../data/elements';
import { h } from './dom';

/** 表示上の行（ランタノイドとアクチノイドの前に1行すき間を空ける） */
export function displayRow(row: number): number {
  return row === LANTHANOID_ROW || row === ACTINOID_ROW ? row + 1 : row;
}

export function renderMiniTable(marks: { number: number; kind: 'chosen' | 'answer' }[]): HTMLElement {
  const kindOf = new Map(marks.map((m) => [m.number, m.kind]));
  return h(
    'div',
    { class: 'minitable', role: 'img', 'aria-label': '周期表の上の位置' },
    ELEMENTS.map((e) => {
      const { row, col } = gridPos(e);
      const kind = kindOf.get(e.number);
      return h('span', {
        class: kind ? `mt-cell mt-${kind}` : 'mt-cell',
        style: `grid-row:${displayRow(row)};grid-column:${col}`,
        title: kind ? `${e.symbol}（${kind === 'answer' ? '正解' : '選んだ元素'}）` : e.symbol,
      });
    }),
  );
}
