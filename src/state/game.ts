// ゲームの操作（答える・ガチャを引く・かけらを交換する）
// どの関数も、元のデータは変えずに「操作した後の新しいデータ」を返す。
// 時刻は now（Date）で受け取り、日付は端末の時刻から求める。
import { CONFIG } from '../config';
import { freeSlotKey, toDateKey } from '../core/date';
import type { PullOutcome } from '../core/gacha';
import { pullMany } from '../core/gacha';
import type { Rng } from '../core/random';
import { stonesForAnswer } from '../core/reward';
import { applyRecheck, applyReview, isDue, isRecheckDue, newCard } from '../core/srs';
import type { RarityTable } from '../types';
import type { DailyStat, SaveData } from './save';
import { emptyDailyStat } from './save';

/** 答えた問題の種類：日付単位の復習・当日の確認・自主練習 */
export type AnswerKind = 'review' | 'recheck' | 'practice';

export interface AnswerResult {
  data: SaveData;
  kind: AnswerKind;
  /** もらえた石 */
  stones: number;
  /** もらえたかけら（自主練習） */
  fragments: number;
  stageBefore: number;
  stageAfter: number;
}

/** いまこのカードに答えると、どの種類の問題として扱われるか */
export function answerKind(data: SaveData, number: number, now: Date): AnswerKind {
  const card = data.cards[number];
  if (!card) throw new Error(`原子番号 ${number} のカードを持っていません`);
  if (isDue(card, toDateKey(now))) return 'review';
  if (isRecheckDue(card, now)) return 'recheck';
  return 'practice';
}

/**
 * 期限の来た問題に答える。
 * ・日付単位の復習：正解なら段階が1つ上がって石がもらえ、不正解なら段階1に戻る
 * ・当日の確認：正解なら石が少しもらえて次のステップへ。段階は変わらない
 * ・どちらの期限も来ていなければ、自主練習と同じ扱い
 */
export function answerDue(data: SaveData, number: number, correct: boolean, now: Date): AnswerResult {
  const kind = answerKind(data, number, now);
  if (kind === 'practice') return answerPractice(data, number, correct, now);

  const card = data.cards[number];
  const today = toDateKey(now);
  const next = structuredClone(data);
  let stones: number;
  if (kind === 'review') {
    stones = stonesForAnswer(card.stage, correct, 'due');
    next.cards[number] = applyReview(card, correct, now);
    bumpDaily(next, today, (d) => {
      d.dueTotal += 1;
      d.dueCorrect += correct ? 1 : 0;
      d.stonesEarned += stones;
    });
  } else {
    // 確認は各ステップを正解で通過したときだけ石が出る（不正解のやり直しでは出ない）
    stones = correct ? CONFIG.stones.recheck : 0;
    next.cards[number] = applyRecheck(card, correct, now);
    bumpDaily(next, today, (d) => {
      d.recheckTotal += 1;
      d.recheckCorrect += correct ? 1 : 0;
      d.stonesEarned += stones;
    });
  }
  next.stones += stones;
  return { data: next, kind, stones, fragments: 0, stageBefore: card.stage, stageAfter: next.cards[number].stage };
}

/** 今日、自主練習でもらえるかけらの残り */
export function practiceFragmentsLeft(data: SaveData, today: string): number {
  return Math.max(0, CONFIG.practice.dailyFragmentCap - (data.daily[today]?.practiceFragments ?? 0));
}

/**
 * 自主練習で答える。石は出ず、段階も変わらない。
 * 正解すると、1日の上限まで「かけら」がもらえる。
 */
export function answerPractice(data: SaveData, number: number, correct: boolean, now: Date): AnswerResult {
  const card = data.cards[number];
  if (!card) throw new Error(`原子番号 ${number} のカードを持っていません`);
  const today = toDateKey(now);
  const fragments = correct ? Math.min(CONFIG.practice.fragmentPerCorrect, practiceFragmentsLeft(data, today)) : 0;
  const next = structuredClone(data);
  next.cards[number] = { ...card, practiced: card.practiced + 1 };
  next.fragments += fragments;
  bumpDaily(next, today, (d) => {
    d.practiceTotal += 1;
    d.practiceCorrect += correct ? 1 : 0;
    d.practiceFragments += fragments;
  });
  return { data: next, kind: 'practice', stones: 0, fragments, stageBefore: card.stage, stageAfter: card.stage };
}

export type PullKind = 'free' | 'single' | 'ten';

export const PULL_COUNT: Record<PullKind, number> = { free: 1, single: 1, ten: 10 };

export function pullCost(kind: PullKind): number {
  if (kind === 'free') return 0;
  return kind === 'ten' ? CONFIG.gacha.costTen : CONFIG.gacha.costSingle;
}

/** いまの枠の無料ガチャがまだ残っているか（0時・6時・12時・18時に回復） */
export function canUseFree(data: SaveData, now: Date): boolean {
  return data.lastFreeGacha !== freeSlotKey(now);
}

/** そのガチャを今引けるか */
export function canPull(data: SaveData, kind: PullKind, now: Date): boolean {
  if (kind === 'free') return canUseFree(data, now);
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
  now: Date,
  table: RarityTable,
  rng: Rng,
): { data: SaveData; outcomes: PullOutcome[] } {
  if (!canPull(data, kind, now)) {
    throw new Error(kind === 'free' ? 'この時間の無料ガチャはもう引きました' : '石が足りません');
  }
  const today = toDateKey(now);
  const next = structuredClone(data);
  const count = PULL_COUNT[kind];
  next.stones -= pullCost(kind);
  if (kind === 'free') next.lastFreeGacha = freeSlotKey(now);

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
export function exchangeFragments(data: SaveData, number: number, now: Date): SaveData {
  if (data.cards[number]) throw new Error('すでに持っている元素です');
  if (number < 1 || number > 118) throw new Error('その原子番号の元素はありません');
  if (data.fragments < CONFIG.fragments.exchangeCost) throw new Error('かけらが足りません');
  const next = structuredClone(data);
  next.fragments -= CONFIG.fragments.exchangeCost;
  next.cards[number] = newCard(toDateKey(now));
  return next;
}

function bumpDaily(data: SaveData, today: string, fn: (d: DailyStat) => void): void {
  const d = data.daily[today] ?? emptyDailyStat();
  fn(d);
  data.daily[today] = d;
}
