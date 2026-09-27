// 出題（4択）
import { describe, expect, it } from 'vitest';
import type { QuizFormat } from '../src/config';
import { CONFIG } from '../src/config';
import { formatFor, makeQuestion, pickCategoryDistractors, pickDistractors, similarity } from '../src/core/quiz';
import { seededRng } from '../src/core/random';
import { ELEMENTS, getElement } from '../src/data/elements';
import { CATEGORIES } from '../src/types';

const ALL_FORMATS: QuizFormat[] = ['symbolToName', 'nameToSymbol', 'category', 'useToElement', 'numberToName'];

describe('出題形式', () => {
  it('段階0〜1は記号と名前の問題だけ', () => {
    for (const stage of [0, 1]) {
      const got = new Set([0, 1, 2, 3, 4, 5].map((seq) => formatFor(stage, seq)));
      expect([...got].sort()).toEqual(['nameToSymbol', 'symbolToName']);
    }
  });

  it('段階が上がると形式が増え、段階4以上で5形式すべてが出る', () => {
    const at = (stage: number) => new Set([0, 1, 2, 3, 4].map((seq) => formatFor(stage, seq)));
    expect(at(2).has('category')).toBe(true);
    expect(at(2).has('useToElement')).toBe(true);
    expect(at(2).has('numberToName')).toBe(false);
    expect([...at(4)].sort()).toEqual([...ALL_FORMATS].sort());
  });

  it('形式は回数に応じて順番に回る（同じ条件なら同じ形式）', () => {
    expect(formatFor(3, 0)).toBe(formatFor(3, 4));
    expect(formatFor(3, 0)).not.toBe(formatFor(3, 1));
  });
});

describe('問題の作り方', () => {
  it('全118元素・全形式で、4つの選択肢が重ならず、正解が1つだけ入っている', () => {
    const rng = seededRng(10);
    for (const el of ELEMENTS) {
      for (const format of ALL_FORMATS) {
        const q = makeQuestion(el, format, ELEMENTS, rng);
        expect(q.choices).toHaveLength(CONFIG.quiz.choices);
        expect(new Set(q.choices.map((c) => c.value)).size).toBe(CONFIG.quiz.choices);
        expect(new Set(q.choices.map((c) => c.label)).size).toBe(CONFIG.quiz.choices);
        const answer = format === 'category' ? el.category : el.number;
        expect(q.choices[q.answerIndex].value).toBe(answer);
        expect(q.choices.filter((c) => c.value === answer)).toHaveLength(1);
      }
    }
  });

  it('問題文に答えそのものが出ていない', () => {
    const rng = seededRng(11);
    for (const el of ELEMENTS) {
      expect(makeQuestion(el, 'symbolToName', ELEMENTS, rng).prompt).not.toContain(el.nameJa);
      expect(makeQuestion(el, 'nameToSymbol', ELEMENTS, rng).prompt).not.toBe(el.symbol);
      expect(makeQuestion(el, 'useToElement', ELEMENTS, rng).prompt).not.toContain(el.nameJa);
    }
  });

  it('名前→記号の問題では、選択肢が記号になる', () => {
    const q = makeQuestion(getElement(26), 'nameToSymbol', ELEMENTS, seededRng(12));
    expect(q.prompt).toBe('鉄');
    expect(q.choices[q.answerIndex].label).toBe('Fe');
  });
});

describe('紛らわしい誤答', () => {
  it('誤答は、似ている順の上位から選ばれる（遠い元素は選ばれない）', () => {
    const rng = seededRng(13);
    for (const el of ELEMENTS) {
      const scores = ELEMENTS.filter((e) => e.number !== el.number)
        .map((e) => similarity(el, e))
        .sort((a, b) => b - a);
      const threshold = scores[CONFIG.quiz.distractorPool - 1];
      for (const d of pickDistractors(el, 3, ELEMENTS, rng)) {
        expect(similarity(el, d)).toBeGreaterThanOrEqual(threshold);
      }
    }
  });

  it('鉄の誤答には、近くの遷移金属が選ばれる', () => {
    const picked = pickDistractors(getElement(26), 3, ELEMENTS, seededRng(14));
    for (const d of picked) {
      expect(d.category).toBe('遷移金属');
      expect(Math.abs(d.number - 26)).toBeLessThanOrEqual(10);
    }
  });

  it('分類当ての誤答は、並びの近い分類から重ならずに選ばれる', () => {
    const rng = seededRng(15);
    for (const cat of CATEGORIES) {
      const picked = pickCategoryDistractors(cat, 3, rng);
      expect(new Set(picked).size).toBe(3);
      expect(picked).not.toContain(cat);
      for (const p of picked) expect(Math.abs(CATEGORIES.indexOf(p) - CATEGORIES.indexOf(cat))).toBeLessThanOrEqual(5);
    }
  });
});
