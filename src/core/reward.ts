// 報酬（ガチャ石）の計算
// ・石は「期限の来たカード」に正解したときだけもらえる
// ・答える前の段階が高いほど多い（長い間隔を越えて思い出せたほうが価値が高い）
// ・期限前の自主練習では石は出ない
import { CONFIG } from '../config';

export type AnswerMode = 'due' | 'practice';

export function stonesForAnswer(stageBefore: number, correct: boolean, mode: AnswerMode): number {
  if (mode !== 'due' || !correct) return 0;
  const table = CONFIG.stones.rewardByStage;
  return table[Math.min(Math.max(stageBefore, 0), table.length - 1)];
}
