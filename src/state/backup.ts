// バックアップ（JSON ファイルへの書き出し・読み込み）
import type { SaveData } from './save';
import { normalizeSave } from './save';

const APP_ID = 'genso-gacha';

/** バックアップ用の文字列を作る */
export function exportBackup(data: SaveData, exportedAt: Date): string {
  return JSON.stringify({ app: APP_ID, exportedAt: exportedAt.toISOString(), data }, null, 2);
}

/** バックアップのファイル名（例：genso-gacha-backup-2026-09-26.json） */
export function backupFileName(dateKey: string): string {
  return `${APP_ID}-backup-${dateKey}.json`;
}

/** バックアップの文字列を読み込む。おかしければ理由つきでエラーを投げる */
export function importBackup(text: string): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON として読み込めませんでした');
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { app?: unknown }).app !== APP_ID) {
    throw new Error('元素ガチャのバックアップファイルではありません');
  }
  return normalizeSave((parsed as { data: unknown }).data);
}
