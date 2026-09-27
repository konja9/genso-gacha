// 間隔反復（ライトナー方式）＋当日の確認
// ・段階は0〜5。段階ごとに次の復習までの日数が決まっている（当日・1日・3日・7日・14日・30日）
// ・正解で1段階上がり、不正解で段階1に戻る
// ・出題するのは復習期限が来たカードだけ
// ・新しく入手したカードの最初の問題と、不正解だった復習の後は、同じ日のうちに
//   「10分後 → 1時間後」ともう一度確認する（当日の確認）。確認では段階は変わらない
import { CONFIG } from '../config';
import { addDays, toDateKey } from './date';

/** 当日の確認の予定 */
export interface Recheck {
  /** 確認を作った日。日付が変わったら無効になる */
  day: string;
  /** 何番目のステップか（0から数える） */
  step: number;
  /** この時刻（ミリ秒）以降に出題する */
  at: number;
}

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
  /** 当日の確認の予定（なければ null） */
  recheck: Recheck | null;
}

const MINUTE = 60_000;

/** 新しく入手したカード：段階0で、その日のうちに出題される */
export function newCard(today: string): CardProgress {
  return { stage: 0, due: today, obtainedOn: today, reviews: 0, correct: 0, practiced: 0, everMastered: false, recheck: null };
}

/** 日付単位の復習の期限が来ているか */
export function isDue(card: CardProgress, today: string): boolean {
  return card.due <= today;
}

/** 今日有効な確認の予定（日付が変わった古い予定は無視する） */
export function activeRecheck(card: CardProgress, today: string): Recheck | null {
  return card.recheck && card.recheck.day === today ? card.recheck : null;
}

/** 当日の確認の時刻が来ているか（日付単位の期限が来ているカードは、そちらを優先する） */
export function isRecheckDue(card: CardProgress, now: Date): boolean {
  const today = toDateKey(now);
  const r = activeRecheck(card, today);
  return !!r && !isDue(card, today) && r.at <= now.getTime();
}

/** 当日の確認の最初のステップを作る */
export function startRecheck(now: Date): Recheck {
  return { day: toDateKey(now), step: 0, at: now.getTime() + CONFIG.srs.sameDayStepsMinutes[0] * MINUTE };
}

/**
 * 期限の来た復習に答えた後のカードを返す（元のカードは変えない）。
 * 新しいカード（段階0）の最初の問題と、不正解のときは、当日の確認を始める。
 */
export function applyReview(card: CardProgress, correct: boolean, now: Date): CardProgress {
  const { intervalsDays, wrongStage, masterStage } = CONFIG.srs;
  const stage = correct ? Math.min(card.stage + 1, masterStage) : wrongStage;
  return {
    ...card,
    stage,
    due: addDays(toDateKey(now), intervalsDays[stage]),
    reviews: card.reviews + 1,
    correct: card.correct + (correct ? 1 : 0),
    everMastered: card.everMastered || stage >= masterStage,
    recheck: card.stage === 0 || !correct ? startRecheck(now) : null,
  };
}

/**
 * 当日の確認に答えた後のカードを返す。段階と日付単位の期限は変えない。
 * ・正解：次のステップへ（最後のステップなら確認は完了）
 * ・不正解：同じステップを、最初のステップの間隔の後にやり直す
 */
export function applyRecheck(card: CardProgress, correct: boolean, now: Date): CardProgress {
  const r = card.recheck;
  if (!r) return card;
  const steps = CONFIG.srs.sameDayStepsMinutes;
  if (!correct) return { ...card, recheck: { ...r, at: now.getTime() + steps[0] * MINUTE } };
  const step = r.step + 1;
  return { ...card, recheck: step < steps.length ? { day: r.day, step, at: now.getTime() + steps[step] * MINUTE } : null };
}

/** マスター枠かどうか（いまの段階で判定する。不正解で戻ると枠も戻る） */
export function isMastered(card: CardProgress): boolean {
  return card.stage >= CONFIG.srs.masterStage;
}

/**
 * いま出題するカードの原子番号を、出題する順に並べて返す。
 * 順番：日付単位の期限が来たもの（期限の古い順 → 段階の低い順 → 原子番号順）
 *      → 当日の確認（時刻の早い順 → 原子番号順）。ランダムにはしない。
 */
export function dueList(cards: Readonly<Record<number, CardProgress>>, now: Date): number[] {
  const today = toDateKey(now);
  const entries = Object.entries(cards).map(([n, c]) => [Number(n), c] as const);
  const dayDue = entries
    .filter(([, c]) => isDue(c, today))
    .sort(([na, a], [nb, b]) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.stage - b.stage || na - nb));
  const rechecks = entries
    .filter(([, c]) => isRecheckDue(c, now))
    .sort(([na, a], [nb, b]) => a.recheck!.at - b.recheck!.at || na - nb);
  return [...dayDue, ...rechecks].map(([n]) => n);
}

/** まだ時刻が来ていない今日の確認：いちばん早い時刻と、残りの枚数 */
export function nextRecheck(cards: Readonly<Record<number, CardProgress>>, now: Date): { at: number; count: number } | null {
  const today = toDateKey(now);
  const pending = Object.values(cards)
    .map((c) => (isDue(c, today) ? null : activeRecheck(c, today)))
    .filter((r): r is Recheck => !!r && r.at > now.getTime());
  if (pending.length === 0) return null;
  return { at: Math.min(...pending.map((r) => r.at)), count: pending.length };
}

/**
 * 自主練習に出すカード。期限がまだ来ておらず、今日の確認も残っていないカードから、
 * 段階の低い順 → 期限の近い順 → 原子番号順に選ぶ。
 */
export function practiceList(cards: Readonly<Record<number, CardProgress>>, now: Date, size: number): number[] {
  const today = toDateKey(now);
  return Object.entries(cards)
    .filter(([, c]) => !isDue(c, today) && !activeRecheck(c, today))
    .sort(([na, a], [nb, b]) => a.stage - b.stage || (a.due < b.due ? -1 : a.due > b.due ? 1 : Number(na) - Number(nb)))
    .slice(0, size)
    .map(([n]) => Number(n));
}
