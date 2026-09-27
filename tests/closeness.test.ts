// 不正解のときの「惜しさ」
import { describe, expect, it } from 'vitest';
import { categoryCloseness, elementCloseness } from '../src/core/closeness';
import { getElement } from '../src/data/elements';

const c = (chosen: number, answer: number) => elementCloseness(getElement(chosen), getElement(answer));

describe('惜しさ', () => {
  it('周期表で隣り合っていれば「超おしい」', () => {
    expect(c(27, 26)).toBe(3); // Co と Fe（横）
    expect(c(44, 26)).toBe(3); // Ru と Fe（縦）
    expect(c(60, 61)).toBe(3); // Nd と Pm（ランタノイドどうし）
  });

  it('原子番号が1違いなら、表の上で離れていても「超おしい」', () => {
    expect(c(57, 56)).toBe(3); // La と Ba
    expect(c(71, 72)).toBe(3); // Lu と Hf
  });

  it('2マス以内や同じ族なら「おしい」', () => {
    expect(c(28, 26)).toBe(2); // Ni と Fe（2マス）
    expect(c(55, 3)).toBe(2); // Cs と Li（同じ族）
  });

  it('同じ分類か同じ周期なら「ちょっとおしい」', () => {
    expect(c(30, 22)).toBe(1); // Zn と Ti（同じ遷移金属・同じ周期）
  });

  it('遠く離れていれば「ざんねん」', () => {
    expect(c(92, 1)).toBe(0); // U と H
  });

  it('下の2行（ランタノイド・アクチノイド）と本体は、見た目が近くても離れている扱い', () => {
    expect(c(117, 71)).toBe(0); // Ts と Lu
  });

  it('分類当ては、並びが隣の分類なら「おしい」', () => {
    expect(categoryCloseness('アルカリ土類金属', 'アルカリ金属')).toBe(2);
    expect(categoryCloseness('貴ガス', 'アルカリ金属')).toBe(0);
  });
});
