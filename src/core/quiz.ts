// 出題（4択）
// ・どのカードを出すかは間隔反復（srs.ts）が決める。ここでは問題の中身を作る
// ・問題の形式は段階に応じて使えるものが増え、復習のたびに順番に回す（ランダムにしない）
// ・誤答の選択肢は、同じ分類・近い原子番号・周期表で近い元素から選んで紛らわしくする
import type { QuizFormat } from '../config';
import { CONFIG } from '../config';
import type { Category, ElementData } from '../types';
import { CATEGORIES } from '../types';
import { gridDistance, isFBlock } from './periodic';
import type { Rng } from './random';
import { shuffle } from './random';

export interface Choice {
  /** ボタンに出す文字 */
  label: string;
  /** 元素の選択肢なら原子番号、分類の選択肢なら分類名 */
  value: number | Category;
}

export interface Question {
  /** 出題しているカードの原子番号 */
  target: number;
  format: QuizFormat;
  /** 問いかけの文（「この元素記号の元素は？」など） */
  instruction: string;
  /** 大きく出す部分（記号、名前、原子番号、説明文） */
  prompt: string;
  choices: Choice[];
  /** 正解の選択肢の位置 */
  answerIndex: number;
}

export const FORMAT_LABEL: Record<QuizFormat, string> = {
  symbolToName: '記号→名前',
  nameToSymbol: '名前→記号',
  category: '分類当て',
  useToElement: '用途→元素',
  numberToName: '原子番号→名前',
};

/**
 * 段階と回数から形式を決める。
 * seq には「これまでに答えた回数」を渡す（復習なら reviews、自主練習なら practiced）。
 */
export function formatFor(stage: number, seq: number): QuizFormat {
  const table = CONFIG.quiz.formatsByStage;
  const list = table[Math.min(Math.max(stage, 0), table.length - 1)];
  return list[seq % list.length];
}

/** 2つの元素がどれだけ紛らわしいか（大きいほど似ている） */
export function similarity(a: ElementData, b: ElementData, format?: QuizFormat): number {
  let s = 0;
  if (a.category === b.category) s += 3;
  const dn = Math.abs(a.number - b.number);
  if (dn <= 2) s += 3;
  else if (dn <= 5) s += 2;
  else if (dn <= 10) s += 1;
  const dist = gridDistance(a, b);
  if (dist <= 1) s += 2;
  else if (dist <= 2) s += 1;
  if (a.group === b.group && !isFBlock(a) && !isFBlock(b)) s += 2;
  if (a.period === b.period) s += 1;
  // 記号を答える・記号を見て答える問題では、頭文字が同じ記号も紛らわしい（Na と Ne と N など）
  if ((format === 'nameToSymbol' || format === 'symbolToName') && a.symbol[0] === b.symbol[0]) s += 2;
  return s;
}

/** 正解によく似た元素を count 個選ぶ */
export function pickDistractors(
  target: ElementData,
  count: number,
  elements: readonly ElementData[],
  rng: Rng,
  format?: QuizFormat,
): ElementData[] {
  // 同じ点数どうしの順番が毎回同じにならないよう、先に混ぜてから点数順に並べる
  const ranked = shuffle(
    elements.filter((e) => e.number !== target.number),
    rng,
  )
    .map((e) => ({ e, score: similarity(target, e, format) }))
    .sort((a, b) => b.score - a.score);
  const pool = ranked.slice(0, Math.max(CONFIG.quiz.distractorPool, count)).map((x) => x.e);
  return shuffle(pool, rng).slice(0, count);
}

/** 分類当ての誤答：分類の並びで近いものから選ぶ */
export function pickCategoryDistractors(answer: Category, count: number, rng: Rng): Category[] {
  const idx = CATEGORIES.indexOf(answer);
  const near = shuffle(
    CATEGORIES.filter((c) => c !== answer),
    rng,
  ).sort((a, b) => Math.abs(CATEGORIES.indexOf(a) - idx) - Math.abs(CATEGORIES.indexOf(b) - idx));
  return shuffle(near.slice(0, count + 2), rng).slice(0, count);
}

/** 問題を1つ作る */
export function makeQuestion(
  target: ElementData,
  format: QuizFormat,
  elements: readonly ElementData[],
  rng: Rng,
): Question {
  const n = CONFIG.quiz.choices;

  if (format === 'category') {
    const options = shuffle([target.category, ...pickCategoryDistractors(target.category, n - 1, rng)], rng);
    return {
      target: target.number,
      format,
      instruction: 'この元素の分類は？',
      prompt: `${target.nameJa}（${target.symbol}）`,
      choices: options.map((c) => ({ label: c, value: c })),
      answerIndex: options.indexOf(target.category),
    };
  }

  const options = shuffle([target, ...pickDistractors(target, n - 1, elements, rng, format)], rng);
  const label = (e: ElementData) => (format === 'nameToSymbol' ? e.symbol : e.nameJa);
  const head: Record<Exclude<QuizFormat, 'category'>, [string, string]> = {
    symbolToName: ['この元素記号の元素は？', target.symbol],
    nameToSymbol: ['この元素の元素記号は？', target.nameJa],
    numberToName: ['この原子番号の元素は？', String(target.number)],
    useToElement: ['この説明に当てはまる元素は？', target.use],
  };
  const [instruction, prompt] = head[format];
  return {
    target: target.number,
    format,
    instruction,
    prompt,
    choices: options.map((e) => ({ label: label(e), value: e.number })),
    answerIndex: options.findIndex((e) => e.number === target.number),
  };
}
