// 記録画面の集計
import { describe, expect, it } from 'vitest';
import { newCard } from '../src/core/srs';
import { accuracySeries, stageCounts, streakDays, totals } from '../src/core/stats';
import { highestRarity, unownedByRarity } from '../src/core/gacha';
import { RARITY_TABLE } from '../src/data/elements';

const d = (dueTotal: number, dueCorrect: number) => ({ dueTotal, dueCorrect, practiceTotal: 0, practiceCorrect: 0, stonesEarned: dueCorrect });

describe('記録の集計', () => {
  const daily = { '2026-09-24': d(10, 8), '2026-09-25': d(4, 1), '2026-09-27': d(5, 5) };

  it('日ごとの正答率を、復習しなかった日は空（null）にして並べる', () => {
    const s = accuracySeries(daily, '2026-09-27', 4);
    expect(s.map((p) => p.date)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
    expect(s.map((p) => p.rate)).toEqual([0.8, 0.25, null, 1]);
  });

  it('段階ごとの枚数を数える', () => {
    const cards = { 1: { ...newCard('2026-09-01'), stage: 5 }, 2: newCard('2026-09-01'), 3: { ...newCard('2026-09-01'), stage: 5 } };
    expect(stageCounts(cards)).toEqual([1, 0, 0, 0, 0, 2]);
  });

  it('連続で復習した日数を数える（今日がまだでも昨日までを数える）', () => {
    expect(streakDays(daily, '2026-09-27')).toBe(1);
    expect(streakDays({ '2026-09-25': d(1, 1), '2026-09-26': d(1, 1) }, '2026-09-27')).toBe(2);
    expect(streakDays({}, '2026-09-27')).toBe(0);
  });

  it('合計を出す', () => {
    expect(totals(daily)).toMatchObject({ dueTotal: 19, dueCorrect: 14, days: 3 });
  });
});

describe('ガチャ結果の補助', () => {
  it('結果の中でいちばん高いレア度を返す', () => {
    expect(highestRarity([{ rarity: 'N' }, { rarity: 'SR' }, { rarity: 'R' }])).toBe('SR');
    expect(highestRarity([{ rarity: 'N' }])).toBe('N');
  });

  it('未所持の元素をレア度ごとに返す', () => {
    const owned = new Set(RARITY_TABLE.N);
    const u = unownedByRarity(owned, RARITY_TABLE);
    expect(u.N).toEqual([]);
    expect(u.SSR).toHaveLength(30);
  });
});
