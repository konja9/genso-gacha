// 出題（4択と、記号の入力）
// ・どのカードを出すかは間隔反復（srs.ts）が決める。ここでは問題の中身を作る
// ・問題の形式は段階に応じて使えるものが増え、復習のたびに順番に回す（ランダムにしない）
// ・誤答の選択肢は、同じ分類・近い原子番号・周期表で近い元素から選んで紛らわしくする
// ・記号の入力では、正解の文字に紛らわしい文字（似た記号の文字、Co に対する O など）を混ぜたタイルから選ぶ
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
  /** 元素の選択肢なら原子番号、分類の選択肢なら分類名、価電子の選択肢なら個数 */
  value: number | Category;
}

/** 大きく出す部分の見せ方：文字・周期表の位置・電子殻の図 */
export type PromptDisplay = 'text' | 'position' | 'bohr';

export interface Question {
  /** 出題しているカードの原子番号 */
  target: number;
  format: QuizFormat;
  /** 問いかけの文（「この元素記号の元素は？」など） */
  instruction: string;
  /** 大きく出す部分（記号、名前、原子番号、説明文）。位置・電子殻の図の問題では空 */
  prompt: string;
  display: PromptDisplay;
  /** 4択の選択肢（記号を入力する問題では空） */
  choices: Choice[];
  /** 正解の選択肢の位置（記号を入力する問題では -1） */
  answerIndex: number;
  /** 記号を入力する問題の文字タイル（ほかの形式では空） */
  tiles: string[];
  /** 記号を入力する問題の正解（ほかの形式では空） */
  answerText: string;
}

export const FORMAT_LABEL: Record<QuizFormat, string> = {
  symbolToName: '記号→名前',
  nameToSymbol: '名前→記号',
  category: '分類当て',
  useToElement: '用途→元素',
  numberToName: '原子番号→名前',
  position: '位置→元素',
  valence: '価電子',
  bohrToElement: '電子殻→元素',
  symbolInput: '記号を入力',
};

/** 典型元素（1・2族と13〜18族）か。12族は遷移金属、ランタノイド・アクチノイドは3族として扱う */
export function isMainGroup(e: ElementData): boolean {
  return e.group <= 2 || e.group >= 13;
}

/**
 * 価電子の数。典型元素では、1・2族は族の数、13〜17族は族の数から10を引いた数、貴ガスは0。
 * 典型元素でなければ null。
 */
export function valenceOf(e: ElementData): number | null {
  if (!isMainGroup(e)) return null;
  if (e.group === 18) return 0;
  return e.group <= 2 ? e.group : e.group - 10;
}

/**
 * その元素でこの形式を出せるか。
 * ・価電子：典型元素で、性質が確かめられている元素（原子番号103まで）
 * ・電子殻の図：電子を数えられる大きさまで（config の bohrMaxNumber）
 */
export function formatApplies(format: QuizFormat, e: ElementData): boolean {
  if (format === 'valence') return valenceOf(e) !== null && e.number <= 103;
  if (format === 'bohrToElement') return e.number <= CONFIG.quiz.bohrMaxNumber;
  return true;
}

/** その段階・その元素で出せる形式の一覧（元素を省くと config の一覧そのまま） */
export function formatsFor(stage: number, el?: ElementData): QuizFormat[] {
  const table = CONFIG.quiz.formatsByStage;
  const list: QuizFormat[] = table[Math.min(Math.max(stage, 0), table.length - 1)];
  return el ? list.filter((f) => formatApplies(f, el)) : list;
}

/**
 * 段階と回数から形式を決める。
 * seq には「これまでに答えた回数」を渡す（復習なら reviews、自主練習なら practiced）。
 * 元素を渡すと、その元素で出せる形式だけから選び、回し始めの位置を原子番号でずらす
 * （同じ日に同じ段階のカードが並んでも、形式がそろいすぎないように）。
 */
export function formatFor(stage: number, seq: number, el?: ElementData): QuizFormat {
  const list = formatsFor(stage, el);
  return list[(seq + (el?.number ?? 0)) % list.length];
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
  if ((format === 'nameToSymbol' || format === 'symbolToName' || format === 'symbolInput') && a.symbol[0] === b.symbol[0]) s += 2;
  // 位置の問題では、周期表で隣り合う元素がいちばん紛らわしい
  if (format === 'position' && dist <= 1) s += 3;
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

/**
 * 価電子の誤答：正解に近い個数から選ぶ。貴ガス（0個）には、最外殻の電子の数とまちがえやすい
 * 8個（ヘリウムは2個）を必ず入れる。
 */
export function pickValenceDistractors(target: ElementData, count: number, rng: Rng): number[] {
  const answer = valenceOf(target) ?? 0;
  const must = answer === 0 ? [target.shells[target.shells.length - 1]] : [];
  const near = shuffle(
    Array.from({ length: 9 }, (_, i) => i).filter((v) => v !== answer && !must.includes(v)),
    rng,
  ).sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer));
  return [...must, ...shuffle(near.slice(0, count + 1), rng)].slice(0, count);
}

/**
 * 記号を入力する問題の文字タイル。正解の文字に、紛らわしい文字を混ぜて size 個にする。
 * 紛らわしい文字：2文字目を大文字にしたもの（Co に対する O）、似た元素の記号の文字、足りなければほかの記号の文字。
 */
export function makeTiles(target: ElementData, elements: readonly ElementData[], rng: Rng, size = CONFIG.quiz.inputTiles): string[] {
  const tiles = new Set<string>(target.symbol);
  if (target.symbol.length > 1) tiles.add(target.symbol[1].toUpperCase());
  const similar = pickDistractors(target, CONFIG.quiz.distractorPool, elements, rng, 'symbolInput');
  const others = shuffle(elements, rng);
  for (const e of [...similar, ...others]) {
    for (const ch of e.symbol) if (tiles.size < size) tiles.add(ch);
    if (tiles.size >= size) break;
  }
  return shuffle([...tiles], rng);
}

/** 問題を1つ作る */
export function makeQuestion(
  target: ElementData,
  format: QuizFormat,
  elements: readonly ElementData[],
  rng: Rng,
): Question {
  const n = CONFIG.quiz.choices;
  const base = { target: target.number, format, display: 'text' as PromptDisplay, tiles: [] as string[], answerText: '' };

  if (format === 'category') {
    const options = shuffle([target.category, ...pickCategoryDistractors(target.category, n - 1, rng)], rng);
    return {
      ...base,
      instruction: 'この元素の分類は？',
      prompt: `${target.nameJa}（${target.symbol}）`,
      choices: options.map((c) => ({ label: c, value: c })),
      answerIndex: options.indexOf(target.category),
    };
  }

  if (format === 'valence') {
    const answer = valenceOf(target);
    if (answer === null) throw new Error(`${target.nameJa} は典型元素ではないので、価電子の問題は出せません`);
    const options = shuffle([answer, ...pickValenceDistractors(target, n - 1, rng)], rng);
    return {
      ...base,
      instruction: 'この元素の価電子の数は？',
      prompt: `${target.nameJa}（${target.symbol}）`,
      choices: options.map((v) => ({ label: `${v}個`, value: v })),
      answerIndex: options.indexOf(answer),
    };
  }

  if (format === 'symbolInput') {
    return {
      ...base,
      instruction: 'この元素の元素記号を、文字を選んで入力しよう',
      prompt: target.nameJa,
      choices: [],
      answerIndex: -1,
      tiles: makeTiles(target, elements, rng),
      answerText: target.symbol,
    };
  }

  const options = shuffle([target, ...pickDistractors(target, n - 1, elements, rng, format)], rng);
  const label = (e: ElementData) => (format === 'nameToSymbol' ? e.symbol : e.nameJa);
  const head: Record<Exclude<QuizFormat, 'category' | 'valence' | 'symbolInput'>, [string, string, PromptDisplay]> = {
    symbolToName: ['この元素記号の元素は？', target.symbol, 'text'],
    nameToSymbol: ['この元素の元素記号は？', target.nameJa, 'text'],
    numberToName: ['この原子番号の元素は？', String(target.number), 'text'],
    useToElement: ['この説明に当てはまる元素は？', target.use, 'text'],
    position: ['周期表のこの位置にある元素は？', '', 'position'],
    bohrToElement: ['この電子殻の図の元素は？（電子の数を数えよう）', '', 'bohr'],
  };
  const [instruction, prompt, display] = head[format];
  return {
    ...base,
    display,
    instruction,
    prompt,
    choices: options.map((e) => ({ label: label(e), value: e.number })),
    answerIndex: options.findIndex((e) => e.number === target.number),
  };
}
