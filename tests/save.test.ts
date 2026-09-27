// 保存・読み込み・バックアップ
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { newCard } from '../src/core/srs';
import { backupFileName, exportBackup, importBackup } from '../src/state/backup';
import type { KeyValueStorage, SaveData } from '../src/state/save';
import { SAVE_KEY, createInitialSave, loadSave, normalizeSave, writeSave } from '../src/state/save';

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function sampleSave(): SaveData {
  const s = createInitialSave();
  s.stones = 42;
  s.fragments = 7;
  s.cards[26] = { ...newCard('2026-09-20'), stage: 3, due: '2026-09-30', reviews: 5, correct: 4 };
  s.daily['2026-09-26'] = { dueTotal: 3, dueCorrect: 2, practiceTotal: 1, practiceCorrect: 1, stonesEarned: 5, pulls: 1 };
  return s;
}

describe('保存と読み込み', () => {
  it('はじめて遊ぶときは、決められた数の石を持っていてカードはない', () => {
    const { data, recovered } = loadSave(memoryStorage());
    expect(data.stones).toBe(CONFIG.stones.initial);
    expect(data.cards).toEqual({});
    expect(recovered).toBe(false);
  });

  it('保存したデータをそのまま読み込める', () => {
    const storage = memoryStorage();
    writeSave(storage, sampleSave());
    expect(loadSave(storage).data).toEqual(sampleSave());
  });

  it('保存データが壊れていたら、はじめからのデータにして、壊れたデータは別に残す', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{壊れた');
    const { data, recovered } = loadSave(storage);
    expect(recovered).toBe(true);
    expect(data).toEqual(createInitialSave());
    expect([...storage.map.keys()].some((k) => k.startsWith(`${SAVE_KEY}/broken-`))).toBe(true);
  });

  it('おかしな値の入ったデータは受け付けない', () => {
    const bad = (patch: (s: Record<string, unknown>) => void) => {
      const s = structuredClone(sampleSave()) as unknown as Record<string, unknown>;
      patch(s);
      return () => normalizeSave(s);
    };
    expect(bad((s) => (s.stones = -1))).toThrow('石の数');
    expect(bad((s) => ((s.cards as Record<string, unknown>)['200'] = newCard('2026-09-26')))).toThrow('存在しません');
    expect(bad((s) => ((s.cards as Record<string, { stage: number }>)['26'].stage = 9))).toThrow('段階');
    expect(bad((s) => (s.version = 99))).toThrow('版');
  });
});

describe('バックアップ', () => {
  it('書き出したものを読み込むと元に戻る', () => {
    const text = exportBackup(sampleSave(), new Date('2026-09-26T12:00:00Z'));
    expect(importBackup(text)).toEqual(sampleSave());
  });

  it('JSON でないファイルや、別のアプリのファイルは読み込まない', () => {
    expect(() => importBackup('こんにちは')).toThrow('JSON');
    expect(() => importBackup('{"app":"other","data":{}}')).toThrow('バックアップファイルではありません');
  });

  it('ファイル名に日付が入る', () => {
    expect(backupFileName('2026-09-26')).toBe('genso-gacha-backup-2026-09-26.json');
  });
});
