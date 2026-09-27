// 小さな周期表。不正解のとき、選んだ元素と正解の位置を見せる。位置当ての問題でも使う
import { ACTINOID_ROW, LANTHANOID_ROW, gridPos } from '../core/periodic';
import { ELEMENTS } from '../data/elements';
import { h } from './dom';

/** 表示上の行（ランタノイドとアクチノイドの前に1行すき間を空ける） */
export function displayRow(row: number): number {
  return row === LANTHANOID_ROW || row === ACTINOID_ROW ? row + 1 : row;
}

export type MiniMark = { number: number; kind: 'chosen' | 'answer' | 'target' };

/**
 * marks の元素に色をつけた周期表。
 * quiz を true にすると（位置当ての問題）、マスに元素記号の手がかりを付けない。
 */
export function renderMiniTable(marks: MiniMark[], quiz = false): HTMLElement {
  const kindOf = new Map(marks.map((m) => [m.number, m.kind]));
  return h(
    'div',
    { class: 'minitable', role: 'img', 'aria-label': quiz ? '周期表の中の1マスが光っています' : '周期表の上の位置' },
    ELEMENTS.map((e) => {
      const { row, col } = gridPos(e);
      const kind = kindOf.get(e.number);
      return h('span', {
        class: kind ? `mt-cell mt-${kind}` : 'mt-cell',
        style: `grid-row:${displayRow(row)};grid-column:${col}`,
        title: quiz ? undefined : kind === 'answer' ? `${e.symbol}（正解）` : kind === 'chosen' ? `${e.symbol}（選んだ元素）` : e.symbol,
      });
    }),
  );
}
