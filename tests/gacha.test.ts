// ガチャの確率・天井・未所持優先・かけら
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { isHighRarity, pickElement, pullMany, pullsUntilPity, rollRarity } from '../src/core/gacha';
import { seededRng } from '../src/core/random';
import { RARITY_TABLE } from '../src/data/elements';
import type { Rarity } from '../src/types';

describe('排出率', () => {
  it('天井に関係なく引いたとき、各レア度が設定どおりの割合で出る（±0.5%）', () => {
    const rng = seededRng(1);
    const count: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0 };
    const trials = 200_000;
    for (let i = 0; i < trials; i++) count[rollRarity(0, rng).rarity]++;
    for (const r of ['N', 'R', 'SR', 'SSR'] as Rarity[]) {
      expect(Math.abs(count[r] / trials - CONFIG.gacha.rates[r])).toBeLessThan(0.005);
    }
  });

  it('排出率の合計が100%になっている', () => {
    const { N, R, SR, SSR } = CONFIG.gacha.rates;
    expect(N + R + SR + SSR).toBeCloseTo(1, 10);
  });
});

describe('天井', () => {
  it('SR以上が29回続けて出なければ、30回目は必ずSR以上', () => {
    const rng = seededRng(2);
    for (let i = 0; i < 1000; i++) {
      const { rarity, pityTriggered } = rollRarity(CONFIG.gacha.pity - 1, rng);
      expect(isHighRarity(rarity)).toBe(true);
      expect(pityTriggered).toBe(true);
    }
  });

  it('天井で確定したときの SR と SSR の割合は 12:3（SSR 20%）', () => {
    const rng = seededRng(3);
    let ssr = 0;
    const trials = 50_000;
    for (let i = 0; i < trials; i++) if (rollRarity(CONFIG.gacha.pity - 1, rng).rarity === 'SSR') ssr++;
    expect(Math.abs(ssr / trials - 0.2)).toBeLessThan(0.01);
  });

  it('いつも N が出る乱数でも、30回目で SR 以上になり、そこから数え直す', () => {
    const alwaysN = () => 0.1;
    const { outcomes, pityCount } = pullMany(60, new Set(), 0, RARITY_TABLE, alwaysN);
    const highAt = outcomes.map((o, i) => (isHighRarity(o.rarity) ? i + 1 : 0)).filter(Boolean);
    expect(highAt).toEqual([30, 60]);
    expect(pityCount).toBe(0);
  });

  it('たくさん引いても、SR以上が出ない回が30回以上続くことはない', () => {
    const rng = seededRng(4);
    const { outcomes } = pullMany(20_000, new Set(), 0, RARITY_TABLE, rng);
    let run = 0;
    let longest = 0;
    for (const o of outcomes) {
      run = isHighRarity(o.rarity) ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThanOrEqual(CONFIG.gacha.pity - 1);
  });

  it('あと何回で確定かを数えられる', () => {
    expect(pullsUntilPity(0)).toBe(30);
    expect(pullsUntilPity(29)).toBe(1);
  });
});

describe('未所持優先とかけら', () => {
  it('同じレア度に未所持があれば、必ず未所持から出る', () => {
    const lastN = RARITY_TABLE.N[RARITY_TABLE.N.length - 1];
    const owned = new Set(RARITY_TABLE.N.filter((n) => n !== lastN));
    const rng = seededRng(5);
    for (let i = 0; i < 100; i++) {
      expect(pickElement('N', owned, RARITY_TABLE, rng)).toEqual({ number: lastN, isNew: true });
    }
  });

  it('同じレア度を全部持っていたら重複になり、レア度に応じたかけらに変わる', () => {
    const owned = new Set([...RARITY_TABLE.N, ...RARITY_TABLE.R, ...RARITY_TABLE.SR, ...RARITY_TABLE.SSR]);
    const { outcomes } = pullMany(200, owned, 0, RARITY_TABLE, seededRng(6));
    for (const o of outcomes) {
      expect(o.isNew).toBe(false);
      expect(o.fragments).toBe(CONFIG.fragments.perDuplicate[o.rarity]);
    }
  });

  it('新しく入手したときはかけらにならない', () => {
    const { outcomes } = pullMany(10, new Set(), 0, RARITY_TABLE, seededRng(7));
    for (const o of outcomes) {
      expect(o.isNew).toBe(true);
      expect(o.fragments).toBe(0);
    }
  });

  it('10連の中で同じ元素が「新規」として2回出ることはない', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { outcomes } = pullMany(10, new Set(), 0, RARITY_TABLE, seededRng(seed));
      const news = outcomes.filter((o) => o.isNew).map((o) => o.number);
      expect(new Set(news).size).toBe(news.length);
    }
  });

  it('出た元素のレア度は、レア度表どおり', () => {
    const { outcomes } = pullMany(500, new Set(), 0, RARITY_TABLE, seededRng(8));
    for (const o of outcomes) expect(RARITY_TABLE[o.rarity]).toContain(o.number);
  });
});
