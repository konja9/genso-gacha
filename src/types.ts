// アプリ全体で使うデータの形（型）をまとめたファイル

/** 元素の分類（10種類） */
export type Category =
  | 'アルカリ金属'
  | 'アルカリ土類金属'
  | '遷移金属'
  | '典型金属'
  | '半金属'
  | '非金属'
  | 'ハロゲン'
  | '貴ガス'
  | 'ランタノイド'
  | 'アクチノイド';

/**
 * 分類の一覧。周期表の左から右へおおよそ並ぶ順にしてある。
 * 「分類当て」問題で、隣どうしの分類を紛らわしい選択肢として使う。
 */
export const CATEGORIES: readonly Category[] = [
  'アルカリ金属',
  'アルカリ土類金属',
  'ランタノイド',
  'アクチノイド',
  '遷移金属',
  '典型金属',
  '半金属',
  '非金属',
  'ハロゲン',
  '貴ガス',
];

/** 常温（25℃）での状態。超重元素など確かめられていないものは「不明」 */
export type MatterState = '固体' | '液体' | '気体' | '不明';
export const MATTER_STATES: readonly MatterState[] = ['固体', '液体', '気体', '不明'];

/** data/elements.json の1元素ぶんのデータ */
export interface ElementData {
  /** 原子番号 */
  number: number;
  /** 元素記号 */
  symbol: string;
  /** 日本語名 */
  nameJa: string;
  /** 英語名 */
  nameEn: string;
  /** 周期（1〜7） */
  period: number;
  /** 族（1〜18）。ランタノイド・アクチノイドは3族として扱う */
  group: number;
  category: Category;
  state: MatterState;
  /** 内側の電子殻（K殻、L殻、M殻…）から順に並べた電子の数 */
  shells: number[];
  /** 身近な用途などの説明（1文）。超重元素は名前の由来 */
  use: string;
}

/** レア度 */
export type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export const RARITIES: readonly Rarity[] = ['N', 'R', 'SR', 'SSR'];

/** data/rarity.json の形：レア度ごとの原子番号の一覧 */
export type RarityTable = Record<Rarity, number[]>;
