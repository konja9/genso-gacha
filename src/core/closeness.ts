// 不正解のときの「惜しさ」
// 周期表の上で近い元素を選んだほど、惜しさのレベルが高くなる（演出が強くなる）。
import type { Category, ElementData } from '../types';
import { CATEGORIES } from '../types';
import { gridDistance, isFBlock } from './periodic';

/** 0＝ざんねん、1＝ちょっとおしい、2＝おしい、3＝超おしい */
export type ClosenessLevel = 0 | 1 | 2 | 3;

export const CLOSENESS_LABEL: Record<ClosenessLevel, string> = {
  0: 'ざんねん',
  1: 'ちょっとおしい',
  2: 'おしい！',
  3: '超おしい！！',
};

/**
 * 選んだ元素と正解の元素の近さ。
 * ・3：周期表で隣り合っている、または原子番号が1違い
 * ・2：周期表で2マス以内、または原子番号が3以内、または同じ族（fブロックどうしを除く）
 * ・1：同じ分類、または同じ周期
 * ・0：それ以外
 */
export function elementCloseness(chosen: ElementData, answer: ElementData): ClosenessLevel {
  const dist = gridDistance(chosen, answer);
  const dn = Math.abs(chosen.number - answer.number);
  if (dist <= 1 || dn === 1) return 3;
  const sameGroup = chosen.group === answer.group && !isFBlock(chosen) && !isFBlock(answer);
  if (dist <= 2 || dn <= 3 || sameGroup) return 2;
  if (chosen.category === answer.category || chosen.period === answer.period) return 1;
  return 0;
}

/**
 * 分類当て問題の近さ。分類の並び（周期表の左から右へのおおよその順）で隣なら「おしい」。
 */
export function categoryCloseness(chosen: Category, answer: Category): ClosenessLevel {
  const d = Math.abs(CATEGORIES.indexOf(chosen) - CATEGORIES.indexOf(answer));
  if (d === 1) return 2;
  if (d === 2) return 1;
  return 0;
}
