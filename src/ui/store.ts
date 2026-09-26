// 画面から使う進行データの入れ物。
// 変更のたびに localStorage に保存し、画面に知らせる。
import type { KeyValueStorage, SaveData } from '../state/save';
import { createInitialSave, loadSave, writeSave } from '../state/save';

/** localStorage が使えない環境（プライベートブラウズ等）では、メモリの中だけに置く */
function pickStorage(): { storage: KeyValueStorage; persistent: boolean } {
  try {
    const key = 'genso-gacha/probe';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return { storage: localStorage, persistent: true };
  } catch {
    const map = new Map<string, string>();
    return {
      storage: {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, v) => void map.set(k, v),
        removeItem: (k) => void map.delete(k),
      },
      persistent: false,
    };
  }
}

const { storage, persistent } = pickStorage();
const loaded = loadSave(storage);
let current: SaveData = loaded.data;
const listeners = new Set<() => void>();

export const store = {
  /** 保存が端末に残るか（false ならページを閉じると消える） */
  persistent,
  /** 起動時に保存データが壊れていて、はじめからにしたか */
  recovered: loaded.recovered,

  get(): SaveData {
    return current;
  },

  /** データを新しいものに置き換えて保存する */
  set(next: SaveData): void {
    current = next;
    try {
      writeSave(storage, current);
    } catch (e) {
      console.error('保存に失敗しました', e);
    }
    for (const fn of listeners) fn();
  },

  /** すべてはじめからにする */
  reset(): void {
    store.set(createInitialSave());
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
