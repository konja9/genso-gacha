// ゲームの操作（答える・ガチャ・かけら交換・自主練習のかけら）
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { seededRng } from '../src/core/random';
import { newCard } from '../src/core/srs';
import { RARITY_TABLE } from '../src/data/elements';
import { answerDue, answerPractice, canUseFree, doPull, exchangeFragments, practiceFragmentsLeft } from '../src/state/game';
import { createInitialSave } from '../src/state/save';

const TODAY = '2026-09-26';
const TOMORROW = '2026-09-27';
const NOON = new Date(2026, 8, 26, 12, 0);
const NEXT_NOON = new Date(2026, 8, 27, 12, 0);

function withCard(number: number, stage: number, due: string) {
  const s = createInitialSave();
  s.cards[number] = { ...newCard('2026-09-01'), stage, due };
  return s;
}

describe('復習に答える', () => {
  it('期限の来たカードに正解すると、石がもらえて段階が上がる', () => {
    const r = answerDue(withCard(26, 4, TODAY), 26, true, NOON);
    expect(r.kind).toBe('review');
    expect(r.stones).toBe(CONFIG.stones.rewardByStage[4]);
    expect(r.data.stones).toBe(CONFIG.stones.initial + CONFIG.stones.rewardByStage[4]);
    expect(r.data.cards[26].stage).toBe(5);
    expect(r.data.daily[TODAY]).toMatchObject({ dueTotal: 1, dueCorrect: 1, stonesEarned: r.stones });
  });

  it('不正解なら石は出ず、段階1に戻る', () => {
    const r = answerDue(withCard(26, 4, TODAY), 26, false, NOON);
    expect(r.stones).toBe(0);
    expect(r.data.cards[26].stage).toBe(1);
    expect(r.data.cards[26].due).toBe(TOMORROW);
  });

  it('期限前のカードは、正解しても石は出ず段階も変わらない（自主練習扱い）', () => {
    const r = answerDue(withCard(26, 2, TOMORROW), 26, true, NOON);
    expect(r.kind).toBe('practice');
    expect(r.stones).toBe(0);
    expect(r.data.cards[26].stage).toBe(2);
  });

  it('元のデータは書き換えない', () => {
    const before = withCard(26, 4, TODAY);
    answerDue(before, 26, true, NOON);
    expect(before.cards[26].stage).toBe(4);
    expect(before.stones).toBe(CONFIG.stones.initial);
  });
});

describe('自主練習', () => {
  it('石も段階も変えず、正解するとかけらがもらえる', () => {
    const r = answerPractice(withCard(26, 2, TOMORROW), 26, true, NOON);
    expect(r.stones).toBe(0);
    expect(r.fragments).toBe(CONFIG.practice.fragmentPerCorrect);
    expect(r.data.stones).toBe(CONFIG.stones.initial);
    expect(r.data.fragments).toBe(CONFIG.practice.fragmentPerCorrect);
    expect(r.data.cards[26]).toMatchObject({ stage: 2, due: TOMORROW, practiced: 1 });
    expect(r.data.daily[TODAY]).toMatchObject({ practiceTotal: 1, practiceCorrect: 1, dueTotal: 0 });
  });

  it('不正解ではかけらは出ない', () => {
    expect(answerPractice(withCard(26, 2, TOMORROW), 26, false, NOON).fragments).toBe(0);
  });

  it('かけらは1日の上限で止まり、次の日にはまたもらえる', () => {
    let s = withCard(26, 2, '2026-10-30');
    for (let i = 0; i < CONFIG.practice.dailyFragmentCap + 3; i++) s = answerPractice(s, 26, true, NOON).data;
    expect(s.fragments).toBe(CONFIG.practice.dailyFragmentCap);
    expect(practiceFragmentsLeft(s, TODAY)).toBe(0);
    expect(answerPractice(s, 26, true, NOON).fragments).toBe(0);
    expect(answerPractice(s, 26, true, NEXT_NOON).fragments).toBe(CONFIG.practice.fragmentPerCorrect);
  });
});

describe('ガチャを引く', () => {
  it('入手した元素は、その時点で段階0・今日が期限の学習対象になる', () => {
    const { data, outcomes } = doPull(createInitialSave(), 'single', NOON, RARITY_TABLE, seededRng(1));
    const n = outcomes[0].number;
    expect(data.cards[n]).toMatchObject({ stage: 0, due: TODAY, obtainedOn: TODAY, recheck: null });
    expect(data.stones).toBe(CONFIG.stones.initial - CONFIG.gacha.costSingle);
  });

  it('入手してすぐ正解すると石がもらえる（段階0の報酬）', () => {
    const pulled = doPull(createInitialSave(), 'single', NOON, RARITY_TABLE, seededRng(1));
    const n = pulled.outcomes[0].number;
    const r = answerDue(pulled.data, n, true, NOON);
    expect(r.stones).toBe(CONFIG.stones.rewardByStage[0]);
    expect(r.data.cards[n].due).toBe(TOMORROW);
  });

  it('10連は10枚引けて、石が決まった数だけ減る', () => {
    const { data, outcomes } = doPull(createInitialSave(), 'ten', NOON, RARITY_TABLE, seededRng(2));
    expect(outcomes).toHaveLength(10);
    expect(Object.keys(data.cards)).toHaveLength(10);
    expect(data.stones).toBe(CONFIG.stones.initial - CONFIG.gacha.costTen);
    expect(data.totalPulls).toBe(10);
  });

  it('石が足りなければ引けない', () => {
    const s = createInitialSave();
    s.stones = CONFIG.gacha.costSingle - 1;
    expect(() => doPull(s, 'single', NOON, RARITY_TABLE, seededRng(3))).toThrow('石が足りません');
  });

  it('重複した分はかけらになり、天井の回数も引き継がれる', () => {
    const s = createInitialSave();
    for (const n of RARITY_TABLE.N) s.cards[n] = newCard(TODAY);
    s.stones = 10_000;
    let data = s;
    let fragments = 0;
    for (let i = 0; i < 20; i++) {
      const r = doPull(data, 'ten', NOON, RARITY_TABLE, seededRng(100 + i));
      fragments += r.outcomes.reduce((a, o) => a + o.fragments, 0);
      data = r.data;
    }
    expect(data.fragments).toBe(fragments);
    expect(data.fragments).toBeGreaterThan(0);
    expect(data.pityCount).toBeLessThan(CONFIG.gacha.pity);
  });
});

describe('無料ガチャ（6時間ごと）', () => {
  const t = (h: number, m = 0, d = 26) => new Date(2026, 8, d, h, m);

  it('同じ枠では1回だけ。石は減らない', () => {
    const first = doPull(createInitialSave(), 'free', t(12, 5), RARITY_TABLE, seededRng(4));
    expect(first.data.stones).toBe(CONFIG.stones.initial);
    expect(first.data.lastFreeGacha).toBe('2026-09-26@12');
    expect(canUseFree(first.data, t(17, 59))).toBe(false);
    expect(() => doPull(first.data, 'free', t(17, 59), RARITY_TABLE, seededRng(5))).toThrow('無料ガチャ');
  });

  it('枠の切り替わり（6時・12時・18時・0時）でまた引ける', () => {
    const used = doPull(createInitialSave(), 'free', t(5, 59), RARITY_TABLE, seededRng(6)).data;
    expect(canUseFree(used, t(5, 59))).toBe(false);
    expect(canUseFree(used, t(6, 0))).toBe(true);
    const evening = doPull(createInitialSave(), 'free', t(23, 0), RARITY_TABLE, seededRng(7)).data;
    expect(canUseFree(evening, t(0, 30, 27))).toBe(true);
  });

  it('前の版の「日付だけ」の記録が残っていても、新しい枠では引ける', () => {
    const s = createInitialSave();
    s.lastFreeGacha = TODAY;
    expect(canUseFree(s, t(12))).toBe(true);
  });

  it('1日に最大4回（枠の数）まで無料で引ける', () => {
    let s = createInitialSave();
    let count = 0;
    for (let h = 0; h < 24; h++) {
      if (canUseFree(s, t(h))) {
        s = doPull(s, 'free', t(h), RARITY_TABLE, seededRng(h)).data;
        count++;
      }
    }
    expect(count).toBe(CONFIG.gacha.freeSlotStartHours.length);
  });
});

describe('かけらの交換', () => {
  it('かけらが決まった数あれば、好きな未所持元素と交換できる', () => {
    const s = createInitialSave();
    s.fragments = CONFIG.fragments.exchangeCost + 3;
    const next = exchangeFragments(s, 118, NOON);
    expect(next.fragments).toBe(3);
    expect(next.cards[118]).toMatchObject({ stage: 0, due: TODAY });
  });

  it('かけらが足りない・すでに持っている元素なら交換できない', () => {
    const s = createInitialSave();
    s.fragments = CONFIG.fragments.exchangeCost - 1;
    expect(() => exchangeFragments(s, 118, NOON)).toThrow('かけらが足りません');
    s.fragments = CONFIG.fragments.exchangeCost;
    s.cards[1] = newCard(TODAY);
    expect(() => exchangeFragments(s, 1, NOON)).toThrow('すでに持っている');
  });
});
