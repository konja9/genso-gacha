import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, toDateKey } from '../src/core/date';

describe('日付', () => {
  it('端末の時刻の日付を YYYY-MM-DD にする', () => {
    expect(toDateKey(new Date(2026, 8, 26, 23, 59))).toBe('2026-09-26');
    expect(toDateKey(new Date(2026, 8, 27, 0, 0))).toBe('2026-09-27');
  });

  it('月末・年末・うるう年をまたいで日数を足せる', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-25', 7)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
  });

  it('2つの日付の差を数えられる', () => {
    expect(daysBetween('2026-09-26', '2026-10-26')).toBe(30);
    expect(daysBetween('2026-09-26', '2026-09-20')).toBe(-6);
  });
});
