// ゲームの操作（答える・ガチャを引く・かけらを交換する）
// どの関数も、元のデータは変えずに「操作した後の新しいデータ」を返す。
import { CONFIG } from '../config';
import type { PullOutcome } from '../core/gacha';
import { pullMany } from '../core/gacha';
import type { Rng } from '../core/random';
import { stonesForAnswer } from '../core/reward';
import { applyReview, isDue, newCard } from '../core/srs';
import type { RarityTable } from '../types';
import type { DailyStat, SaveData } from './save';
import { emptyDailyStat } from './save';

export interface AnswerResult {
  data: SaveData;
  /** もらえた石 */
  stones: number;
  stageBefore: number;
  stageAfter: number;
  /** 石と段階が動く「期限の来た復習」として扱われたか（false なら自主練習扱い） */
  counted: boolean;
}

/**
 * 期限の来たカードに答える。
 * 正解なら段階が1つ上がって石がもらえ、不正解なら段階1に戻る。
 * 期限がまだ来ていないカードだった場合は、自主練習と同じ扱い（石も段階も変わらない）。
 */
export function answerDue(data: SaveData, number: number, correct: boolean, today: string): AnswerResult {
  const card = data.cards[number];
  if (!card) throw new Error(`原子番号 ${number} のカードを持っていません`);
  if (!isDue(card, today)) return answerPractice(data, number, correct, today);

  const next = structuredClone(data);
  const updated = applyReview(card, correct, today);
  const stones = stonesForAnswer(card.stage, correct, 'due');
  next.cards[number] = updated;
  next.stones += stones;
  bumpDaily(next, today, (d) => {
    d.dueTotal += 1;
    d.dueCorrect += correct ? 1 : 0;
    d.stonesEarned += stones;
  });
  return { data: next, stones, stageBefore: card.stage, stageAfter: updated.stage, counted: true };
}

/** 自主練習で答える。石は出ず、段階も変わらない（回数と正答率だけ記録する） */
export function answerPractice(data: SaveData, number: number, correct: boolean, today: string): AnswerResult {
  const card = data.cards[number];
  if (!card) throw new Error(`原子番号 ${number} のカードを持っていません`);
  const next = structuredClone(data);
  next.cards[number] = { ...card, practiced: card.practiced + 1 };
  bumpDaily(next, today, (d) => {
    d.practiceTotal += 1;
    d.practiceCorrect += correct ? 1 : 0;
  });
  return { data: next, stones: 0, stageBefore: card.stage, stageAfter: card.stage, counted: false };
}

export type PullKind = 'free' | 'single' | 'ten';

export const PULL_COUNT: Record<PullKind, number> = { free: 1, single: 1, ten: 10 };

export function pullCost(kind: PullKind): number {
  if (kind === 'free') return 0;
  return kind === 'ten' ? CONFIG.gacha.costTen : CONFIG.gacha.costSingle;
}

/** 今日の無料ガチャがまだ残っているか */
export function canUseFree(data: SaveData, today: string): boolean {
  return data.lastFreeGacha !== today;
}

/** そのガチャを今引けるか */
export function canPull(data: SaveData, kind: PullKind, today: string): boolean {
  if (kind === 'free') return canUseFree(data, today);
  return data.stones >= pullCost(kind);
}

/**
 * ガチャを引く。
 * 新しく入手した元素は、その時点で学習対象（段階0・今日が期限）になる。
 * 重複した元素はかけらに変わる。
 */
export function doPull(
  data: SaveData,
  kind: PullKind,
  today: string,
  table: RarityTable,
  rng: Rng,
): { data: SaveData; outcomes: PullOutcome[] } {
  if (!canPull(data, kind, today)) {
    throw new Error(kind === 'free' ? '今日の無料ガチャはもう引きました' : '石が足りません');
  }
  const next = structuredClone(data);
  const count = PULL_COUNT[kind];
  next.stones -= pullCost(kind);
  if (kind === 'free') next.lastFreeGacha = today;

  const owned = new Set(Object.keys(next.cards).map(Number));
  const { outcomes, pityCount } = pullMany(count, owned, next.pityCount, table, rng);
  for (const o of outcomes) {
    if (o.isNew) next.cards[o.number] = newCard(today);
    next.fragments += o.fragments;
  }
  next.pityCount = pityCount;
  next.totalPulls += count;
  bumpDaily(next, today, (d) => {
    d.pulls += count;
  });
  return { data: next, outcomes };
}

/** かけらを交換できるか */
export function canExchange(data: SaveData): boolean {
  return data.fragments >= CONFIG.fragments.exchangeCost && Object.keys(data.cards).length < 118;
}

/** かけらを使って、好きな未所持元素を1枚入手する */
export function exchangeFragments(data: SaveData, number: number, today: string): SaveData {
  if (data.cards[number]) throw new Error('すでに持っている元素です');
  if (number < 1 || number > 118) throw new Error('その原子番号の元素はありません');
  if (data.fragments < CONFIG.fragments.exchangeCost) throw new Error('かけらが足りません');
  const next = structuredClone(data);
  next.fragments -= CONFIG.fragments.exchangeCost;
  next.cards[number] = newCard(today);
  return next;
}

function bumpDaily(data: SaveData, today: string, fn: (d: DailyStat) => void): void {
  const d = data.daily[today] ?? emptyDailyStat();
  fn(d);
  data.daily[today] = d;
}
