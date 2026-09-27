// ★ゲームの調整用の数値は、すべてこのファイルにまとめてある。
// 数値を変えたら `npm test` でテストが通るか確かめること。

import type { Rarity } from './types';

/** 問題の形式 */
export type QuizFormat =
  | 'symbolToName' // 記号 → 名前
  | 'nameToSymbol' // 名前 → 記号
  | 'category' // 分類当て
  | 'useToElement' // 用途 → 元素
  | 'numberToName'; // 原子番号 → 名前

export const CONFIG = {
  /** ガチャ */
  gacha: {
    /** 排出率（合計が1になるようにする） */
    rates: { N: 0.55, R: 0.3, SR: 0.12, SSR: 0.03 } satisfies Record<Rarity, number>,
    /** 天井：この回数を続けて SR 以上が出なかったら、その回は SR 以上が確定 */
    pity: 30,
    /** 1回の値段（石） */
    costSingle: 8,
    /** 10連の値段（石） */
    costTen: 80,
    /**
     * 無料ガチャが回復する時刻（時）。この時刻から次の時刻までの間に1回引ける。
     * [0, 6, 12, 18] なら 0時・6時・12時・18時に1回ずつ回復する（1日最大4回）。
     */
    freeSlotStartHours: [0, 6, 12, 18],
  },

  /** ガチャ石 */
  stones: {
    /** 最初に持っている石 */
    initial: 100,
    /**
     * 期限の来たカードに正解したときにもらえる石。
     * 答える前の段階（0〜5）ごとの数。長い間隔を越えて思い出せたほど多い。
     */
    rewardByStage: [1, 2, 3, 5, 8, 12],
    /** 当日の確認に正解したときにもらえる石（各ステップ1回だけ） */
    recheck: 1,
  },

  /** かけら（重複したカードから変わるもの） */
  fragments: {
    /** 重複したときにもらえるかけらの数（重複したカードのレア度ごと） */
    perDuplicate: { N: 1, R: 2, SR: 3, SSR: 5 } satisfies Record<Rarity, number>,
    /** 好きな未所持元素1枚と交換するのに必要なかけらの数 */
    exchangeCost: 20,
  },

  /** 間隔反復（ライトナー方式） */
  srs: {
    /** 段階0〜5ごとの、次の復習までの日数（0＝当日） */
    intervalsDays: [0, 1, 3, 7, 14, 30],
    /**
     * 不正解のときに下がる段階の数。押し間違い1回で積み上げがすべて消えないよう、
     * 段階1まで戻すのではなく、この数だけ下げる（例：段階5→3、4→2）
     */
    wrongDrop: 2,
    /** 不正解で下がっても、この段階より下にはしない（明日また出題される） */
    wrongStage: 1,
    /** この段階に着いたらマスター */
    masterStage: 5,
    /**
     * 当日の確認のステップ（分）。新しく入手したカードの最初の問題と、不正解だった復習の後に、
     * 同じ日のうちに「10分後 → 1時間後」ともう一度出題する。確認で不正解なら同じステップを最初の間隔後にやり直す。
     */
    sameDayStepsMinutes: [10, 60],
  },

  /** 自主練習（期限前のカード。石は出ず、段階も変わらない） */
  practice: {
    /** 正解1問でもらえるかけら */
    fragmentPerCorrect: 1,
    /** 自主練習でもらえるかけらの1日の上限 */
    dailyFragmentCap: 5,
  },

  /** 出題 */
  quiz: {
    /** 選択肢の数 */
    choices: 4,
    /**
     * 段階ごとに出題する形式。ここに並べた形式を、復習のたびに順番に回す。
     * 段階が上がるほど難しい形式が加わる。
     */
    formatsByStage: [
      ['symbolToName', 'nameToSymbol'],
      ['symbolToName', 'nameToSymbol'],
      ['symbolToName', 'nameToSymbol', 'category', 'useToElement'],
      ['symbolToName', 'nameToSymbol', 'category', 'useToElement'],
      ['symbolToName', 'nameToSymbol', 'category', 'useToElement', 'numberToName'],
      ['symbolToName', 'nameToSymbol', 'category', 'useToElement', 'numberToName'],
    ] satisfies QuizFormat[][],
    /** 誤答の候補として、似ている順に上位この数から選ぶ（小さいほど紛らわしい） */
    distractorPool: 8,
    /** 自主練習1回あたりの問題数 */
    practiceSize: 10,
  },
} as const;
