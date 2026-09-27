// 日付の計算。復習の期限や無料ガチャは「端末の時刻での日付」で区切る（0時に切り替わる）。
// 日付は "2026-09-26" のような文字列で扱う。文字列のまま大小を比べても日付の前後と一致する。
import { CONFIG } from '../config';

/** Date を端末の時刻での "YYYY-MM-DD" に変える */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今日の日付 */
export function today(): string {
  return toDateKey(new Date());
}

/** "YYYY-MM-DD" に日数を足す */
export function addDays(key: string, days: number): string {
  const [y, m, d] = parse(key);
  return toDateKey(new Date(y, m - 1, d + days));
}

/** from から to まで何日あるか（to が後なら正の数） */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parse(from);
  const [y2, m2, d2] = parse(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** "YYYY-MM-DD" の形になっているか */
export function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * 無料ガチャの「枠」を表す文字列（例：2026-09-27@12）。
 * config.ts の freeSlotStartHours の時刻で枠が切り替わり、枠ごとに1回無料で引ける。
 */
export function freeSlotKey(now: Date): string {
  const hours = CONFIG.gacha.freeSlotStartHours;
  let start: number = hours[0];
  for (const h of hours) if (now.getHours() >= h) start = h;
  return `${toDateKey(now)}@${String(start).padStart(2, '0')}`;
}

/** 次に無料ガチャが回復する時刻 */
export function nextFreeSlotAt(now: Date): Date {
  const hours = CONFIG.gacha.freeSlotStartHours;
  const next = hours.find((h) => h > now.getHours());
  if (next !== undefined) return new Date(now.getFullYear(), now.getMonth(), now.getDate(), next);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours[0]);
}

/** 残り時間を「2時間15分」「8分」のように書く */
export function formatDuration(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function parse(key: string): [number, number, number] {
  if (!isDateKey(key)) throw new Error(`日付の形が正しくありません: ${key}`);
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}
