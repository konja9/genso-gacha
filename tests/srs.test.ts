// 間隔反復（ライトナー方式）
import { describe, expect, it } from 'vitest';
import type { CardProgress } from '../src/core/srs';
import { applyReview, dueList, isDue, isMastered, newCard, practiceList } from '../src/core/srs';

const TODAY = '2026-09-26';
/** 2026-09-26 の昼12時 */
const NOON = new Date(2026, 8, 26, 12, 0);
/** 日付 "YYYY-MM-DD" の昼12時 */
const at = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0);
};

describe('ライトナー方式', () => {
  it('新しいカードは段階0で、その日のうちに期限が来る', () => {
    const c = newCard(TODAY);
    expect(c.stage).toBe(0);
    expect(isDue(c, TODAY)).toBe(true);
  });

  it('正解するたびに1段階ずつ上がり、間隔は 1・3・7・14・30 日になる', () => {
    let c = newCard(TODAY);
    let day = TODAY;
    const expected: [number, string][] = [
      [1, '2026-09-27'],
      [2, '2026-09-30'],
      [3, '2026-10-07'],
      [4, '2026-10-21'],
      [5, '2026-11-20'],
    ];
    for (const [stage, due] of expected) {
      c = applyReview(c, true, at(day));
      expect(c.stage).toBe(stage);
      expect(c.due).toBe(due);
      day = c.due;
    }
  });

  it('段階5で正解しても段階5のままで、30日後に期限が来る', () => {
    const c: CardProgress = { ...newCard(TODAY), stage: 5 };
    const next = applyReview(c, true, NOON);
    expect(next.stage).toBe(5);
    expect(next.due).toBe('2026-10-26');
  });

  it('不正解ならどの段階からでも段階1に戻り、翌日に期限が来る', () => {
    for (const stage of [0, 1, 2, 3, 4, 5]) {
      const next = applyReview({ ...newCard(TODAY), stage }, false, NOON);
      expect(next.stage).toBe(1);
      expect(next.due).toBe('2026-09-27');
    }
  });

  it('答えた回数と正解数を数える', () => {
    let c = newCard(TODAY);
    c = applyReview(c, true, NOON);
    c = applyReview(c, false, NOON);
    expect(c.reviews).toBe(2);
    expect(c.correct).toBe(1);
  });

  it('マスター枠は今の段階で決まり、一度マスターした記録は残る', () => {
    const master = applyReview({ ...newCard(TODAY), stage: 4 }, true, NOON);
    expect(isMastered(master)).toBe(true);
    expect(master.everMastered).toBe(true);
    const dropped = applyReview(master, false, NOON);
    expect(isMastered(dropped)).toBe(false);
    expect(dropped.everMastered).toBe(true);
  });

  it('元のカードは書き換えない', () => {
    const c = newCard(TODAY);
    applyReview(c, true, NOON);
    expect(c.stage).toBe(0);
  });
});

describe('出題するカードの選び方', () => {
  const cards: Record<number, CardProgress> = {
    26: { ...newCard('2026-09-01'), stage: 3, due: '2026-09-20' },
    8: { ...newCard('2026-09-01'), stage: 1, due: '2026-09-20' },
    1: { ...newCard(TODAY), stage: 0, due: TODAY },
    79: { ...newCard('2026-09-01'), stage: 2, due: '2026-09-27' }, // まだ期限前
    6: { ...newCard('2026-09-01'), stage: 4, due: '2026-09-25' },
  };

  it('期限の来たカードだけを、期限の古い順→段階の低い順に並べる', () => {
    expect(dueList(cards, NOON)).toEqual([8, 26, 6, 1]);
  });

  it('期限前のカードは出題しない', () => {
    expect(dueList(cards, NOON)).not.toContain(79);
  });

  it('自主練習は期限前のカードから選ぶ', () => {
    expect(practiceList(cards, NOON, 10)).toEqual([79]);
  });
});
