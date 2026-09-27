// 出題（4択と、記号の入力）
import { describe, expect, it } from 'vitest';
import type { QuizFormat } from '../src/config';
import { CONFIG } from '../src/config';
import {
  formatApplies,
  formatFor,
  formatsFor,
  isMainGroup,
  makeQuestion,
  makeTiles,
  pickCategoryDistractors,
  pickDistractors,
  pickValenceDistractors,
  similarity,
  valenceOf,
} from '../src/core/quiz';
import { seededRng } from '../src/core/random';
import { ELEMENTS, getElement } from '../src/data/elements';
import { CATEGORIES } from '../src/types';

const ALL_FORMATS: QuizFormat[] = [
  'symbolToName',
  'nameToSymbol',
  'category',
  'useToElement',
  'numberToName',
  'position',
  'valence',
  'bohrToElement',
  'symbolInput',
];
/** 4択の形式（記号の入力以外） */
const CHOICE_FORMATS = ALL_FORMATS.filter((f) => f !== 'symbolInput');

describe('出題形式', () => {
  it('段階0〜1は記号と名前の問題だけ', () => {
    for (const stage of [0, 1]) {
      const got = new Set([0, 1, 2, 3, 4, 5].map((seq) => formatFor(stage, seq)));
      expect([...got].sort()).toEqual(['nameToSymbol', 'symbolToName']);
    }
  });

  it('段階2〜3で分類・用途・位置・価電子・電子殻の図が加わる', () => {
    const at = new Set(formatsFor(2));
    for (const f of ['category', 'useToElement', 'position', 'valence', 'bohrToElement'] as const) expect(at.has(f)).toBe(true);
    expect(at.has('numberToName')).toBe(false);
    expect(at.has('symbolInput')).toBe(false);
  });

  it('段階4以上では、名前→記号の4択のかわりに記号の入力が出る', () => {
    for (const stage of [4, 5]) {
      const at = new Set(formatsFor(stage));
      expect(at.has('symbolInput')).toBe(true);
      expect(at.has('nameToSymbol')).toBe(false);
      expect(at.has('numberToName')).toBe(true);
    }
  });

  it('形式は回数に応じて順番に回る（同じ条件なら同じ形式）', () => {
    const len = formatsFor(3).length;
    expect(formatFor(3, 0)).toBe(formatFor(3, len));
    expect(formatFor(3, 0)).not.toBe(formatFor(3, 1));
  });

  it('元素を渡すと、その元素で出せる形式だけから選ぶ', () => {
    for (const el of ELEMENTS) {
      for (let seq = 0; seq < 10; seq++) expect(formatApplies(formatFor(4, seq, el), el)).toBe(true);
    }
  });

  it('元素を渡すと、同じ回数でも原子番号によって形式がばらける', () => {
    const got = new Set(ELEMENTS.slice(0, 20).map((el) => formatFor(3, 2, el)));
    expect(got.size).toBeGreaterThan(3);
  });

  it('価電子は典型元素（原子番号103まで）だけ、電子殻の図は原子番号20までだけ', () => {
    expect(formatApplies('valence', getElement(11))).toBe(true); // Na
    expect(formatApplies('valence', getElement(26))).toBe(false); // Fe（遷移金属）
    expect(formatApplies('valence', getElement(30))).toBe(false); // Zn（12族は遷移金属として扱う）
    expect(formatApplies('valence', getElement(117))).toBe(false); // Ts（性質が確かめられていない）
    expect(formatApplies('bohrToElement', getElement(20))).toBe(true);
    expect(formatApplies('bohrToElement', getElement(21))).toBe(false);
  });
});

describe('価電子', () => {
  it('代表的な元素の価電子の数', () => {
    const expected: Record<number, number> = { 1: 1, 2: 0, 6: 4, 7: 5, 8: 6, 10: 0, 11: 1, 12: 2, 13: 3, 17: 7, 18: 0, 20: 2, 35: 7, 54: 0 };
    for (const [n, v] of Object.entries(expected)) expect(valenceOf(getElement(Number(n)))).toBe(v);
    expect(valenceOf(getElement(26))).toBeNull();
  });

  it('貴ガス以外の典型元素では、いちばん外側の電子殻の電子の数と一致する（元素データの確認）', () => {
    for (const el of ELEMENTS.filter((e) => isMainGroup(e) && e.group !== 18 && e.number <= 103)) {
      expect(valenceOf(el)).toBe(el.shells[el.shells.length - 1]);
    }
  });

  it('貴ガスの誤答には、最外殻の電子の数（ヘリウムは2、ほかは8）が必ず入る', () => {
    const rng = seededRng(20);
    expect(pickValenceDistractors(getElement(2), 3, rng)).toContain(2);
    for (const n of [10, 18, 36, 54, 86]) expect(pickValenceDistractors(getElement(n), 3, rng)).toContain(8);
  });
});

describe('記号を入力する問題', () => {
  it('全118元素で、タイルに正解の文字がすべて入り、重なりなく決まった数だけある', () => {
    const rng = seededRng(21);
    for (const el of ELEMENTS) {
      const tiles = makeTiles(el, ELEMENTS, rng);
      expect(tiles).toHaveLength(CONFIG.quiz.inputTiles);
      expect(new Set(tiles).size).toBe(tiles.length);
      for (const ch of el.symbol) expect(tiles).toContain(ch);
    }
  });

  it('2文字の記号では、2文字目の大文字も紛らわしいタイルとして入る（Co に対する O）', () => {
    expect(makeTiles(getElement(27), ELEMENTS, seededRng(22))).toContain('O');
  });

  it('問題は名前を出し、正解は記号そのもの', () => {
    const q = makeQuestion(getElement(11), 'symbolInput', ELEMENTS, seededRng(23));
    expect(q.prompt).toBe('ナトリウム');
    expect(q.answerText).toBe('Na');
    expect(q.choices).toHaveLength(0);
    expect(q.answerIndex).toBe(-1);
  });
});

describe('問題の作り方', () => {
  it('全118元素・出せる全形式で、4つの選択肢が重ならず、正解が1つだけ入っている', () => {
    const rng = seededRng(10);
    for (const el of ELEMENTS) {
      for (const format of CHOICE_FORMATS.filter((f) => formatApplies(f, el))) {
        const q = makeQuestion(el, format, ELEMENTS, rng);
        expect(q.choices).toHaveLength(CONFIG.quiz.choices);
        expect(new Set(q.choices.map((c) => c.value)).size).toBe(CONFIG.quiz.choices);
        expect(new Set(q.choices.map((c) => c.label)).size).toBe(CONFIG.quiz.choices);
        const answer = format === 'category' ? el.category : format === 'valence' ? valenceOf(el) : el.number;
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
      const pos = makeQuestion(el, 'position', ELEMENTS, rng);
      expect(pos.display).toBe('position');
      expect(pos.prompt).toBe('');
    }
    const bohr = makeQuestion(getElement(11), 'bohrToElement', ELEMENTS, rng);
    expect(bohr.display).toBe('bohr');
    expect(bohr.prompt).toBe('');
  });

  it('位置の問題の誤答には、周期表で隣り合う元素が入りやすい', () => {
    const rng = seededRng(24);
    let near = 0;
    for (let i = 0; i < 50; i++) {
      const q = makeQuestion(getElement(26), 'position', ELEMENTS, rng); // 鉄
      near += q.choices.filter((c) => c.value !== 26 && [25, 27, 44, 43, 45].includes(c.value as number)).length;
    }
    expect(near / 50).toBeGreaterThan(1.5);
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
