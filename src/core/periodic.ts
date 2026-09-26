// 周期表の上での位置
// 表示は一般的な18列の周期表。ランタノイドとアクチノイドは本体の下に別の2行（8・9行目）で並べる。
import type { ElementData } from '../types';

export interface GridPos {
  /** 行（1〜7が本体、8がランタノイド、9がアクチノイド） */
  row: number;
  /** 列（1〜18） */
  col: number;
}

export const LANTHANOID_ROW = 8;
export const ACTINOID_ROW = 9;

/** f ブロック（ランタノイド・アクチノイド）か */
export function isFBlock(e: ElementData): boolean {
  return e.category === 'ランタノイド' || e.category === 'アクチノイド';
}

/** 周期表の中で表示する位置 */
export function gridPos(e: ElementData): GridPos {
  if (e.category === 'ランタノイド') return { row: LANTHANOID_ROW, col: 3 + (e.number - 57) };
  if (e.category === 'アクチノイド') return { row: ACTINOID_ROW, col: 3 + (e.number - 89) };
  return { row: e.period, col: e.group };
}

/**
 * 周期表の上での距離（縦・横・斜めに1マス動くのを1とする）。
 * 本体と下の2行は見た目の上でつながっていないので、片方だけが f ブロックのときは距離を出さない（Infinity）。
 */
export function gridDistance(a: ElementData, b: ElementData): number {
  if (isFBlock(a) !== isFBlock(b)) return Infinity;
  const pa = gridPos(a);
  const pb = gridPos(b);
  return Math.max(Math.abs(pa.row - pb.row), Math.abs(pa.col - pb.col));
}
