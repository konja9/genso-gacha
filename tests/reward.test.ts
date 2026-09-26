// 報酬（ガチャ石）
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { stonesForAnswer } from '../src/core/reward';

describe('ガチャ石', () => {
  it('期限の来たカードに正解すると、答える前の段階が高いほど多くもらえる', () => {
    const got = [0, 1, 2, 3, 4, 5].map((s) => stonesForAnswer(s, true, 'due'));
    expect(got).toEqual([...CONFIG.stones.rewardByStage]);
    for (let i = 1; i < got.length; i++) expect(got[i]).toBeGreaterThan(got[i - 1]);
  });

  it('不正解では石は出ない', () => {
    for (const s of [0, 1, 2, 3, 4, 5]) expect(stonesForAnswer(s, false, 'due')).toBe(0);
  });

  it('自主練習では正解しても石は出ない', () => {
    for (const s of [0, 1, 2, 3, 4, 5]) expect(stonesForAnswer(s, true, 'practice')).toBe(0);
  });
});
