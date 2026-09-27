// 進行データの形と、localStorage への保存・読み込み
// ・データは端末のブラウザの中（localStorage）に保存される
// ・読み込んだデータは形をチェックし、壊れていたら使わない
import { CONFIG } from '../config';
import { isDateKey } from '../core/date';
import type { CardProgress } from '../core/srs';

export const SAVE_KEY = 'genso-gacha/save';
export const SAVE_VERSION = 1;

/** 1日ごとの記録 */
export interface DailyStat {
  /** 期限の来た復習：答えた数・正解数 */
  dueTotal: number;
  dueCorrect: number;
  /** 自主練習：答えた数・正解数 */
  practiceTotal: number;
  practiceCorrect: number;
  /** その日にもらった石 */
  stonesEarned: number;
  /** その日にガチャを引いた回数 */
  pulls: number;
}

/** 進行データ全体 */
export interface SaveData {
  version: number;
  /** ガチャ石 */
  stones: number;
  /** かけら */
  fragments: number;
  /** SR以上が出ないまま続いているガチャの回数（天井用） */
  pityCount: number;
  /** 最後に無料ガチャを引いた日 */
  lastFreeGacha: string | null;
  /** 所持カード（キーは原子番号） */
  cards: Record<number, CardProgress>;
  /** 日ごとの記録（キーは日付） */
  daily: Record<string, DailyStat>;
  /** ガチャを引いた合計回数 */
  totalPulls: number;
}

/** localStorage と同じ使い方ができるもの（テストでは代わりの入れ物を使う） */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** はじめて遊ぶときのデータ */
export function createInitialSave(): SaveData {
  return {
    version: SAVE_VERSION,
    stones: CONFIG.stones.initial,
    fragments: 0,
    pityCount: 0,
    lastFreeGacha: null,
    cards: {},
    daily: {},
    totalPulls: 0,
  };
}

export function emptyDailyStat(): DailyStat {
  return { dueTotal: 0, dueCorrect: 0, practiceTotal: 0, practiceCorrect: 0, stonesEarned: 0, pulls: 0 };
}

/**
 * 外から来たデータ（保存済みデータや読み込んだバックアップ）の形を確かめて SaveData にする。
 * 形がおかしければ理由つきでエラーを投げる。
 */
export function normalizeSave(raw: unknown): SaveData {
  if (!isObject(raw)) throw new Error('データの形が正しくありません');
  if (raw.version !== SAVE_VERSION) throw new Error(`対応していないデータの版です（${String(raw.version)}）`);

  const stones = nonNegInt(raw.stones, '石の数');
  const fragments = nonNegInt(raw.fragments, 'かけらの数');
  const pityCount = nonNegInt(raw.pityCount, '天井の回数');
  const totalPulls = nonNegInt(raw.totalPulls, 'ガチャの合計回数');
  if (raw.lastFreeGacha !== null && !isDateKey(raw.lastFreeGacha)) throw new Error('無料ガチャの日付が正しくありません');

  if (!isObject(raw.cards)) throw new Error('カードのデータがありません');
  const cards: Record<number, CardProgress> = {};
  for (const [key, c] of Object.entries(raw.cards)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 1 || n > 118) throw new Error(`原子番号 ${key} のカードは存在しません`);
    cards[n] = normalizeCard(c, key);
  }

  if (!isObject(raw.daily)) throw new Error('日ごとの記録がありません');
  const daily: Record<string, DailyStat> = {};
  for (const [key, d] of Object.entries(raw.daily)) {
    if (!isDateKey(key) || !isObject(d)) throw new Error(`${key} の記録が正しくありません`);
    daily[key] = {
      dueTotal: nonNegInt(d.dueTotal, '記録'),
      dueCorrect: nonNegInt(d.dueCorrect, '記録'),
      practiceTotal: nonNegInt(d.practiceTotal, '記録'),
      practiceCorrect: nonNegInt(d.practiceCorrect, '記録'),
      stonesEarned: nonNegInt(d.stonesEarned, '記録'),
      pulls: nonNegInt(d.pulls, '記録'),
    };
  }

  return {
    version: SAVE_VERSION,
    stones,
    fragments,
    pityCount,
    lastFreeGacha: raw.lastFreeGacha as string | null,
    cards,
    daily,
    totalPulls,
  };
}

function normalizeCard(c: unknown, key: string): CardProgress {
  const where = `原子番号 ${key} のカード`;
  if (!isObject(c)) throw new Error(`${where}の形が正しくありません`);
  const stage = nonNegInt(c.stage, `${where}の段階`);
  if (stage > CONFIG.srs.masterStage) throw new Error(`${where}の段階が大きすぎます`);
  if (!isDateKey(c.due) || !isDateKey(c.obtainedOn)) throw new Error(`${where}の日付が正しくありません`);
  if (typeof c.everMastered !== 'boolean') throw new Error(`${where}のマスター記録が正しくありません`);
  return {
    stage,
    due: c.due,
    obtainedOn: c.obtainedOn,
    reviews: nonNegInt(c.reviews, `${where}の回数`),
    correct: nonNegInt(c.correct, `${where}の回数`),
    practiced: nonNegInt(c.practiced, `${where}の回数`),
    everMastered: c.everMastered,
  };
}

/** 保存済みのデータを読み込む。なければ（または壊れていれば）はじめからのデータを返す */
export function loadSave(storage: KeyValueStorage): { data: SaveData; recovered: boolean } {
  const text = storage.getItem(SAVE_KEY);
  if (text === null) return { data: createInitialSave(), recovered: false };
  try {
    return { data: normalizeSave(JSON.parse(text)), recovered: false };
  } catch {
    // 壊れたデータは消さずに別の名前で残しておく（あとで調べられるように）
    storage.setItem(`${SAVE_KEY}/broken-${Date.now()}`, text);
    return { data: createInitialSave(), recovered: true };
  }
}

export function writeSave(storage: KeyValueStorage, data: SaveData): void {
  storage.setItem(SAVE_KEY, JSON.stringify(data));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonNegInt(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new Error(`${what}が正しくありません`);
  return v;
}
