// 元素データとレア度表の検証
import { describe, expect, it } from 'vitest';
import elements from '../data/elements.json';
import rarity from '../data/rarity.json';
import { validateElements, validateRarity } from '../src/core/validate';

const clone = <T>(v: T): T => structuredClone(v);

describe('元素データ', () => {
  it('いまのデータに問題がない', () => {
    expect(validateElements(elements, rarity)).toEqual([]);
  });

  it('118件そろっていないと見つけられる', () => {
    const errors = validateElements(clone(elements).slice(0, 117), rarity);
    expect(errors.some((e) => e.includes('117 件'))).toBe(true);
  });

  it('記号の重複を見つけられる', () => {
    const data = clone(elements);
    data[1].symbol = 'H';
    expect(validateElements(data, rarity).some((e) => e.includes('H が重複'))).toBe(true);
  });

  it('原子番号の重複を見つけられる', () => {
    const data = clone(elements);
    data[2].number = 2;
    expect(validateElements(data, rarity).some((e) => e.includes('原子番号 2 が重複'))).toBe(true);
  });

  it('電子殻の合計が原子番号と違うと見つけられる', () => {
    const data = clone(elements);
    data[25].shells = [2, 8, 14, 3]; // 鉄（26）なのに合計27
    expect(validateElements(data, rarity).some((e) => e.includes('合計が 27'))).toBe(true);
  });

  it('用途の文に答えの元素名が入っていると見つけられる', () => {
    const data = clone(elements);
    data[0].use = '水素は燃料電池車の燃料になる。';
    expect(validateElements(data, rarity).some((e) => e.includes('元素名「水素」'))).toBe(true);
  });

  it('すべての用途の文が1文で、元素どうしで重なっていない', () => {
    const uses = elements.map((e) => e.use);
    expect(new Set(uses).size).toBe(118);
    for (const u of uses) expect(u.slice(0, -1)).not.toContain('。');
  });
});

describe('レア度表', () => {
  it('N・R・SR・SSR の合計が118で、案どおりの枚数', () => {
    expect([rarity.N.length, rarity.R.length, rarity.SR.length, rarity.SSR.length]).toEqual([20, 25, 43, 30]);
  });

  it('入っていない元素や、2か所に入っている元素を見つけられる', () => {
    const bad = clone(rarity);
    bad.N = bad.N.filter((n) => n !== 1); // 水素をどこにも入れない
    bad.R.push(2); // ヘリウムを N と R の両方に入れる
    const errors = validateRarity(bad);
    expect(errors).toContain('原子番号 1 のレア度が決まっていません');
    expect(errors.some((e) => e.includes('原子番号 2 が N と R の両方'))).toBe(true);
  });
});
