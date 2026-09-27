// 元素データとレア度表を読み込み、使いやすい形にして配るファイル
import elementsJson from '../../data/elements.json';
import rarityJson from '../../data/rarity.json';
import type { ElementData, Rarity, RarityTable } from '../types';
import { RARITIES } from '../types';

/** 全118元素（原子番号順） */
export const ELEMENTS: readonly ElementData[] = elementsJson as ElementData[];

/** レア度ごとの原子番号の一覧 */
export const RARITY_TABLE: RarityTable = {
  N: rarityJson.N,
  R: rarityJson.R,
  SR: rarityJson.SR,
  SSR: rarityJson.SSR,
};

const byNumber = new Map<number, ElementData>(ELEMENTS.map((e) => [e.number, e]));
const rarityByNumber = new Map<number, Rarity>();
for (const r of RARITIES) for (const n of RARITY_TABLE[r]) rarityByNumber.set(n, r);

/** 原子番号から元素を取り出す */
export function getElement(number: number): ElementData {
  const e = byNumber.get(number);
  if (!e) throw new Error(`原子番号 ${number} の元素が見つかりません`);
  return e;
}

/** 原子番号からレア度を調べる */
export function rarityOf(number: number): Rarity {
  const r = rarityByNumber.get(number);
  if (!r) throw new Error(`原子番号 ${number} のレア度が決まっていません`);
  return r;
}
