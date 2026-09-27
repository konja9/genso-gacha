// ガチャの抽選
// ・レア度を排出率で決める（N 55% / R 30% / SR 12% / SSR 3% などは config.ts）
// ・天井：SR以上が出ないまま規定回数目になったら、その回はSR以上が確定
// ・同じレア度の中では、未所持の元素を優先して出す
// ・すでに持っている元素が出たら「かけら」に変わる
import { CONFIG } from '../config';
import type { Rarity, RarityTable } from '../types';
import { RARITIES } from '../types';
import type { Rng } from './random';
import { pickOne } from './random';

/** 1回ぶんの結果 */
export interface PullOutcome {
  number: number;
  rarity: Rarity;
  /** 初めて入手したか */
  isNew: boolean;
  /** 重複してかけらに変わった数（新規なら0） */
  fragments: number;
  /** 天井で確定したSR以上か */
  pityTriggered: boolean;
}

/** SR以上か */
export function isHighRarity(r: Rarity): boolean {
  return r === 'SR' || r === 'SSR';
}

/**
 * レア度を決める。
 * pityCount は「SR以上が出ないまま続いた回数」。天井の1つ手前まで来ていたら SR 以上を確定させる。
 * 確定のときの SR と SSR の割合は、元の排出率の比（12:3）のまま。
 */
export function rollRarity(pityCount: number, rng: Rng): { rarity: Rarity; pityTriggered: boolean } {
  const { rates, pity } = CONFIG.gacha;
  if (pityCount >= pity - 1) {
    const r = rng() * (rates.SR + rates.SSR);
    return { rarity: r < rates.SSR ? 'SSR' : 'SR', pityTriggered: true };
  }
  const r = rng();
  let acc = 0;
  for (const rarity of RARITIES) {
    acc += rates[rarity];
    if (r < acc) return { rarity, pityTriggered: false };
  }
  // 小数の誤差で合計がわずかに1を下回ったときのための保険
  return { rarity: 'N', pityTriggered: false };
}

/** 天井の数え方：SR以上が出たら0に戻り、それ以外なら1増える */
export function nextPityCount(pityCount: number, rarity: Rarity): number {
  return isHighRarity(rarity) ? 0 : pityCount + 1;
}

/** あと何回引けば SR 以上が確定するか（次の1回が確定なら1） */
export function pullsUntilPity(pityCount: number): number {
  return Math.max(CONFIG.gacha.pity - pityCount, 1);
}

/** 決まったレア度の中から元素を選ぶ。未所持があれば必ず未所持から選ぶ */
export function pickElement(
  rarity: Rarity,
  owned: ReadonlySet<number>,
  table: RarityTable,
  rng: Rng,
): { number: number; isNew: boolean } {
  const pool = table[rarity];
  const unowned = pool.filter((n) => !owned.has(n));
  if (unowned.length > 0) return { number: pickOne(unowned, rng), isNew: true };
  return { number: pickOne(pool, rng), isNew: false };
}

/**
 * count 回続けて引く。10連でも1回ずつ順番に引き、途中で手に入れた元素は所持扱いにする
 * （同じ10連の中で同じ未所持元素が2回出ることはない）。
 */
export function pullMany(
  count: number,
  owned: ReadonlySet<number>,
  pityCount: number,
  table: RarityTable,
  rng: Rng,
): { outcomes: PullOutcome[]; pityCount: number } {
  const have = new Set(owned);
  const outcomes: PullOutcome[] = [];
  let pity = pityCount;
  for (let i = 0; i < count; i++) {
    const { rarity, pityTriggered } = rollRarity(pity, rng);
    const { number, isNew } = pickElement(rarity, have, table, rng);
    have.add(number);
    pity = nextPityCount(pity, rarity);
    outcomes.push({
      number,
      rarity,
      isNew,
      fragments: isNew ? 0 : CONFIG.fragments.perDuplicate[rarity],
      pityTriggered,
    });
  }
  return { outcomes, pityCount: pity };
}

/** 結果の中でいちばん高いレア度（ガチャの光の色を決めるのに使う） */
export function highestRarity(outcomes: readonly { rarity: Rarity }[]): Rarity {
  let best: Rarity = 'N';
  for (const o of outcomes) if (RARITIES.indexOf(o.rarity) > RARITIES.indexOf(best)) best = o.rarity;
  return best;
}

/** まだ持っていない元素を、レア度ごとに原子番号順で返す（かけら交換の候補） */
export function unownedByRarity(owned: ReadonlySet<number>, table: RarityTable): Record<Rarity, number[]> {
  const out = {} as Record<Rarity, number[]>;
  for (const r of RARITIES) out[r] = table[r].filter((n) => !owned.has(n)).sort((a, b) => a - b);
  return out;
}
