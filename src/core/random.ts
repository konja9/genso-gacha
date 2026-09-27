// 乱数まわり。テストでは種（シード）を決めて毎回同じ結果になるようにする。

/** 0以上1未満の数を返す関数 */
export type Rng = () => number;

/** 種から決まった順番で乱数を出す（mulberry32 という簡単な方式） */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 配列から1つ選ぶ */
export function pickOne<T>(list: readonly T[], rng: Rng): T {
  if (list.length === 0) throw new Error('空の配列からは選べません');
  return list[Math.floor(rng() * list.length)];
}

/** 配列を混ぜた新しい配列を返す（元の配列は変えない） */
export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
