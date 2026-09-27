// 記録画面のための集計
import { CONFIG } from '../config';
import { addDays } from './date';
import type { CardProgress } from './srs';

/** 日ごとの記録のうち、集計に使う部分 */
export interface DailyLike {
  dueTotal: number;
  dueCorrect: number;
  practiceTotal: number;
  practiceCorrect: number;
  stonesEarned: number;
}

export interface AccuracyPoint {
  date: string;
  total: number;
  correct: number;
  /** 正答率（0〜1）。その日に復習していなければ null */
  rate: number | null;
}

/** 最後の日（end）までの days 日間の、期限の来た復習の正答率 */
export function accuracySeries(daily: Readonly<Record<string, DailyLike>>, end: string, days: number): AccuracyPoint[] {
  const out: AccuracyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const d = daily[date];
    const total = d?.dueTotal ?? 0;
    const correct = d?.dueCorrect ?? 0;
    out.push({ date, total, correct, rate: total > 0 ? correct / total : null });
  }
  return out;
}

/** 段階0〜5ごとのカードの枚数 */
export function stageCounts(cards: Readonly<Record<number, CardProgress>>): number[] {
  const counts = Array.from({ length: CONFIG.srs.masterStage + 1 }, () => 0);
  for (const c of Object.values(cards)) counts[c.stage]++;
  return counts;
}

/**
 * 連続で復習した日数。今日まだ復習していなくても、昨日まで続いていればその日数を返す。
 */
export function streakDays(daily: Readonly<Record<string, DailyLike>>, today: string): number {
  let day = (daily[today]?.dueTotal ?? 0) > 0 ? today : addDays(today, -1);
  let n = 0;
  while ((daily[day]?.dueTotal ?? 0) > 0) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** これまでの合計 */
export function totals(daily: Readonly<Record<string, DailyLike>>): DailyLike & { days: number } {
  const t = { dueTotal: 0, dueCorrect: 0, practiceTotal: 0, practiceCorrect: 0, stonesEarned: 0, days: 0 };
  for (const d of Object.values(daily)) {
    t.dueTotal += d.dueTotal;
    t.dueCorrect += d.dueCorrect;
    t.practiceTotal += d.practiceTotal;
    t.practiceCorrect += d.practiceCorrect;
    t.stonesEarned += d.stonesEarned;
    if (d.dueTotal > 0) t.days++;
  }
  return t;
}
