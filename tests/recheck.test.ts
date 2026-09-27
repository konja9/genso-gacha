// 当日の確認（新しいカードや不正解の後、同じ日の10分後・1時間後にもう一度出す）
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import type { CardProgress } from '../src/core/srs';
import { applyRecheck, applyReview, dueList, isRecheckDue, newCard, nextRecheck, practiceList } from '../src/core/srs';
import { answerDue } from '../src/state/game';
import { createInitialSave } from '../src/state/save';

const T0 = new Date(2026, 8, 26, 12, 0); // 9/26 12:00
const min = (m: number) => new Date(T0.getTime() + m * 60_000);
const [STEP1, STEP2] = CONFIG.srs.sameDayStepsMinutes;

describe('当日の確認', () => {
  it('新しいカードの最初の問題に答えると、正解でも不正解でも10分後に確認が入る', () => {
    for (const correct of [true, false]) {
      const c = applyReview(newCard('2026-09-26'), correct, T0);
      expect(c.recheck).toEqual({ day: '2026-09-26', step: 0, at: min(STEP1).getTime() });
    }
  });

  it('段階1以上の復習は、正解なら確認なし、不正解なら確認が入る', () => {
    const base: CardProgress = { ...newCard('2026-09-01'), stage: 3, due: '2026-09-26' };
    expect(applyReview(base, true, T0).recheck).toBeNull();
    expect(applyReview(base, false, T0).recheck?.step).toBe(0);
  });

  it('10分たつ前は出題されず、10分たつと出題される', () => {
    const c = applyReview(newCard('2026-09-26'), true, T0);
    expect(isRecheckDue(c, min(STEP1 - 1))).toBe(false);
    expect(isRecheckDue(c, min(STEP1))).toBe(true);
    expect(dueList({ 1: c }, min(STEP1 - 1))).toEqual([]);
    expect(dueList({ 1: c }, min(STEP1))).toEqual([1]);
  });

  it('正解すると次は1時間後、2つ目に正解すると今日の確認は完了', () => {
    let c = applyReview(newCard('2026-09-26'), true, T0);
    c = applyRecheck(c, true, min(STEP1));
    expect(c.recheck).toMatchObject({ step: 1, at: min(STEP1 + STEP2).getTime() });
    c = applyRecheck(c, true, min(STEP1 + STEP2));
    expect(c.recheck).toBeNull();
  });

  it('確認で不正解なら、同じステップを10分後にやり直す', () => {
    let c = applyReview(newCard('2026-09-26'), true, T0);
    c = applyRecheck(c, true, min(STEP1)); // ステップ2へ
    c = applyRecheck(c, false, min(STEP1 + STEP2));
    expect(c.recheck).toMatchObject({ step: 1, at: min(STEP1 + STEP2 + STEP1).getTime() });
  });

  it('確認では段階と日付単位の期限は変わらない', () => {
    const c = applyReview(newCard('2026-09-26'), true, T0);
    const after = applyRecheck(c, false, min(STEP1));
    expect(after.stage).toBe(c.stage);
    expect(after.due).toBe(c.due);
  });

  it('日付が変わると、やり残した確認は出題されない', () => {
    const c = applyReview(newCard('2026-09-26'), true, T0);
    const nextDay = new Date(2026, 8, 27, 12, 0);
    expect(isRecheckDue(c, nextDay)).toBe(false);
    expect(nextRecheck({ 1: c }, nextDay)).toBeNull();
  });

  it('日付単位の復習が先、確認は時刻の早い順に並ぶ', () => {
    const dayDue: CardProgress = { ...newCard('2026-09-01'), stage: 2, due: '2026-09-26' };
    const early = { ...applyReview(newCard('2026-09-26'), true, min(0)) };
    const late = { ...applyReview(newCard('2026-09-26'), true, min(3)) };
    expect(dueList({ 5: late, 9: early, 30: dayDue }, min(60))).toEqual([30, 9, 5]);
  });

  it('次の確認の時刻と残りの枚数を返す', () => {
    const a = applyReview(newCard('2026-09-26'), true, min(0));
    const b = applyReview(newCard('2026-09-26'), false, min(2));
    expect(nextRecheck({ 1: a, 2: b }, min(1))).toEqual({ at: min(STEP1).getTime(), count: 2 });
  });

  it('確認が残っているカードは自主練習に出さない', () => {
    const c = applyReview(newCard('2026-09-26'), true, T0);
    expect(practiceList({ 1: c }, min(1), 10)).toEqual([]);
    const done = applyRecheck(applyRecheck(c, true, min(STEP1)), true, min(STEP1 + STEP2));
    expect(practiceList({ 1: done }, min(STEP1 + STEP2 + 1), 10)).toEqual([1]);
  });
});

describe('当日の確認の石', () => {
  function withNewCard() {
    const s = createInitialSave();
    s.cards[1] = newCard('2026-09-26');
    return s;
  }

  it('確認に正解すると石がもらえ、段階の報酬とは別に数えられる', () => {
    let s = answerDue(withNewCard(), 1, true, T0).data; // 最初の問題（段階0→1）
    const before = s.stones;
    const r = answerDue(s, 1, true, min(STEP1));
    expect(r.kind).toBe('recheck');
    expect(r.stones).toBe(CONFIG.stones.recheck);
    expect(r.data.stones).toBe(before + CONFIG.stones.recheck);
    expect(r.data.daily['2026-09-26']).toMatchObject({ recheckTotal: 1, recheckCorrect: 1 });
    s = r.data;
    expect(s.cards[1].stage).toBe(1);
  });

  it('わざと間違えても、1日にもらえる確認の石は増えない', () => {
    // 正直に2つ正解した場合
    let honest = answerDue(withNewCard(), 1, true, T0).data;
    honest = answerDue(honest, 1, true, min(STEP1)).data;
    honest = answerDue(honest, 1, true, min(STEP1 + STEP2)).data;
    // 途中でわざと間違えた場合
    let t = STEP1;
    let cheat = answerDue(withNewCard(), 1, true, T0).data;
    cheat = answerDue(cheat, 1, false, min(t)).data;
    t += STEP1;
    cheat = answerDue(cheat, 1, true, min(t)).data;
    t += STEP2;
    cheat = answerDue(cheat, 1, false, min(t)).data;
    t += STEP1;
    cheat = answerDue(cheat, 1, true, min(t)).data;
    expect(cheat.cards[1].recheck).toBeNull();
    expect(cheat.stones).toBe(honest.stones);
  });

  it('確認の時刻がまだなら、自主練習と同じ扱い（石なし）', () => {
    const s = answerDue(withNewCard(), 1, true, T0).data;
    const r = answerDue(s, 1, true, min(1));
    expect(r.kind).toBe('practice');
    expect(r.stones).toBe(0);
  });
});
