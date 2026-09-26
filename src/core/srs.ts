// 間隔反復（ライトナー方式）
// ・段階は0〜5。段階ごとに次の復習までの日数が決まっている（当日・1日・3日・7日・14日・30日）
// ・正解で1段階上がり、不正解で段階1に戻る
// ・出題するのは復習期限が来たカードだけ
import { CONFIG } from '../config';
import { addDays } from './date';

/** 1枚のカードの学習の進み具合 */
export interface CardProgress {
  /** 段階（0〜5） */
  stage: number;
  /** 次の復習の期限（この日以降に出題される） */
  due: string;
  /** 入手した日 */
  obtainedOn: string;
  /** 期限の来た復習に答えた回数 */
  reviews: number;
  /** そのうち正解した回数 */
  correct: number;
  /** 自主練習で答えた回数 */
  practiced: number;
  /** 一度でもマスター（段階5）に着いたことがあるか */
  everMastered: boolean;
}

/** 新しく入手したカード：段階0で、その日のうちに出題される */
export function newCard(today: string): CardProgress {
  return { stage: 0, due: today, obtainedOn: today, reviews: 0, correct: 0, practiced: 0, everMastered: false };
}

/** 復習の期限が来ているか */
export function isDue(card: CardProgress, today: string): boolean {
  return card.due <= today;
}

/** 期限の来た復習に答えた後のカードを返す（元のカードは変えない） */
export function applyReview(card: CardProgress, correct: boolean, today: string): CardProgress {
  const { intervalsDays, wrongStage, masterStage } = CONFIG.srs;
  const stage = correct ? Math.min(card.stage + 1, masterStage) : wrongStage;
  return {
    ...card,
    stage,
    due: addDays(today, intervalsDays[stage]),
    reviews: card.reviews + 1,
    correct: card.correct + (correct ? 1 : 0),
    everMastered: card.everMastered || stage >= masterStage,
  };
}

/** マスター枠かどうか（いまの段階で判定する。不正解で戻ると枠も戻る） */
export function isMastered(card: CardProgress): boolean {
  return card.stage >= CONFIG.srs.masterStage;
}

/**
 * 期限の来たカードの原子番号を、出題する順に並べて返す。
 * 順番：期限の古い順 → 段階の低い順 → 原子番号順（ランダムにはしない）
 */
export function dueList(cards: Readonly<Record<number, CardProgress>>, today: string): number[] {
  return Object.entries(cards)
    .filter(([, c]) => isDue(c, today))
    .sort(([na, a], [nb, b]) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.stage - b.stage || Number(na) - Number(nb)))
    .map(([n]) => Number(n));
}

/**
 * 自主練習に出すカード。期限がまだ来ていないカードから、
 * 段階の低い順 → 期限の近い順 → 原子番号順に選ぶ。
 */
export function practiceList(cards: Readonly<Record<number, CardProgress>>, today: string, size: number): number[] {
  return Object.entries(cards)
    .filter(([, c]) => !isDue(c, today))
    .sort(([na, a], [nb, b]) => a.stage - b.stage || (a.due < b.due ? -1 : a.due > b.due ? 1 : Number(na) - Number(nb)))
    .slice(0, size)
    .map(([n]) => Number(n));
}
