// 分類ごとの色（CSS のクラス名）とレア度の表示
import type { Category, Rarity } from '../types';

/** 分類ごとのクラス名。色そのものは styles/base.css の --cat-… で決めている */
export const CATEGORY_CLASS: Record<Category, string> = {
  アルカリ金属: 'cat-alkali',
  アルカリ土類金属: 'cat-alkaline-earth',
  遷移金属: 'cat-transition',
  典型金属: 'cat-post-transition',
  半金属: 'cat-metalloid',
  非金属: 'cat-nonmetal',
  ハロゲン: 'cat-halogen',
  貴ガス: 'cat-noble-gas',
  ランタノイド: 'cat-lanthanoid',
  アクチノイド: 'cat-actinoid',
};

export const RARITY_CLASS: Record<Rarity, string> = {
  N: 'rar-n',
  R: 'rar-r',
  SR: 'rar-sr',
  SSR: 'rar-ssr',
};
