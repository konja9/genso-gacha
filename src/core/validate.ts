// 元素データとレア度表に誤りがないかを調べる。
// scripts/validate-data.ts（npm run validate）とテストの両方から使う。
import { CATEGORIES, MATTER_STATES, RARITIES } from '../types';

/** 問題が見つかったら、その内容を日本語の文章で返す（空の配列なら問題なし） */
export function validateElements(elements: unknown, rarity: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(elements)) return ['elements.json が配列になっていません'];

  if (elements.length !== 118) errors.push(`元素の数が ${elements.length} 件です（118件のはず）`);

  const numbers = new Set<number>();
  const symbols = new Set<string>();
  const namesJa = new Set<string>();
  const uses = new Set<string>();

  elements.forEach((raw, i) => {
    const e = raw as Record<string, unknown>;
    const where = `${i + 1}件目（${String(e.symbol ?? '?')}）`;

    // 原子番号：1〜118 が重複なく、順番どおりに並んでいるか
    if (typeof e.number !== 'number' || !Number.isInteger(e.number)) {
      errors.push(`${where}: 原子番号が整数ではありません`);
    } else {
      if (numbers.has(e.number)) errors.push(`${where}: 原子番号 ${e.number} が重複しています`);
      numbers.add(e.number);
      if (e.number !== i + 1) errors.push(`${where}: 原子番号 ${e.number} の位置が順番どおりではありません`);
    }

    // 元素記号：大文字1文字＋小文字0〜1文字で、重複がないか
    if (typeof e.symbol !== 'string' || !/^[A-Z][a-z]?$/.test(e.symbol)) {
      errors.push(`${where}: 元素記号の形が正しくありません`);
    } else {
      if (symbols.has(e.symbol)) errors.push(`${where}: 元素記号 ${e.symbol} が重複しています`);
      symbols.add(e.symbol);
    }

    if (typeof e.nameJa !== 'string' || e.nameJa === '') {
      errors.push(`${where}: 日本語名がありません`);
    } else {
      if (namesJa.has(e.nameJa)) errors.push(`${where}: 日本語名 ${e.nameJa} が重複しています`);
      namesJa.add(e.nameJa);
    }
    if (typeof e.nameEn !== 'string' || e.nameEn === '') errors.push(`${where}: 英語名がありません`);

    if (!isIntIn(e.period, 1, 7)) errors.push(`${where}: 周期は1〜7の整数にしてください`);
    if (!isIntIn(e.group, 1, 18)) errors.push(`${where}: 族は1〜18の整数にしてください`);
    if (!CATEGORIES.includes(e.category as never)) errors.push(`${where}: 分類「${String(e.category)}」は一覧にありません`);
    if (!MATTER_STATES.includes(e.state as never)) errors.push(`${where}: 状態「${String(e.state)}」は一覧にありません`);

    // 電子殻：正の整数の並びで、合計が原子番号と一致するか
    if (!Array.isArray(e.shells) || e.shells.length === 0 || !e.shells.every((s) => isIntIn(s, 1, 32))) {
      errors.push(`${where}: 電子殻の電子数は1〜32の整数の並びにしてください`);
    } else if (typeof e.number === 'number') {
      const sum = (e.shells as number[]).reduce((a, b) => a + b, 0);
      if (sum !== e.number) errors.push(`${where}: 電子殻の電子数の合計が ${sum} で、原子番号 ${e.number} と一致しません`);
    }

    // 用途の文：1文で「。」で終わり、答えになる元素名を含まず、他の元素と同じ文ではないか
    if (typeof e.use !== 'string' || e.use === '') {
      errors.push(`${where}: 用途の文がありません`);
    } else {
      if (!e.use.endsWith('。')) errors.push(`${where}: 用途の文は「。」で終わる1文にしてください`);
      if (e.use.slice(0, -1).includes('。')) errors.push(`${where}: 用途の文が2文以上になっています`);
      if (typeof e.nameJa === 'string' && e.nameJa !== '' && e.use.includes(e.nameJa)) {
        errors.push(`${where}: 用途の文に元素名「${e.nameJa}」が入っています（用途→元素の問題で答えがわかってしまう）`);
      }
      if (uses.has(e.use)) errors.push(`${where}: 用途の文が他の元素と同じです`);
      uses.add(e.use);
    }
  });

  errors.push(...validateRarity(rarity));
  return errors;
}

/** レア度表：全118種がどれか1つのレア度にちょうど1回ずつ入っているか */
export function validateRarity(rarity: unknown): string[] {
  const errors: string[] = [];
  if (typeof rarity !== 'object' || rarity === null) return ['rarity.json の形が正しくありません'];
  const table = rarity as Record<string, unknown>;
  const seen = new Map<number, string>();
  for (const r of RARITIES) {
    const list = table[r];
    if (!Array.isArray(list)) {
      errors.push(`rarity.json に ${r} の一覧がありません`);
      continue;
    }
    for (const n of list) {
      if (!isIntIn(n, 1, 118)) {
        errors.push(`rarity.json の ${r} に 1〜118 以外の値 ${String(n)} があります`);
        continue;
      }
      const prev = seen.get(n as number);
      if (prev) errors.push(`原子番号 ${n} が ${prev} と ${r} の両方に入っています`);
      seen.set(n as number, r);
    }
  }
  for (let n = 1; n <= 118; n++) {
    if (!seen.has(n)) errors.push(`原子番号 ${n} のレア度が決まっていません`);
  }
  return errors;
}

function isIntIn(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}
