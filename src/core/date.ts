// 日付の計算。復習の期限や無料ガチャは「端末の時刻での日付」で区切る（0時に切り替わる）。
// 日付は "2026-09-26" のような文字列で扱う。文字列のまま大小を比べても日付の前後と一致する。

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

function parse(key: string): [number, number, number] {
  if (!isDateKey(key)) throw new Error(`日付の形が正しくありません: ${key}`);
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}
