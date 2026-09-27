// 元素カードの描画（画像は使わず、CSS と SVG で描く）
// ・枠のデザインはレア度で変わる（N・R・SR・SSR）
// ・習熟度（段階）が上がると枠が進化し、段階5で「マスター枠」になる
import { CONFIG } from '../config';
import type { CardProgress } from '../core/srs';
import { isMastered } from '../core/srs';
import { rarityOf } from '../data/elements';
import type { ElementData } from '../types';
import { renderBohr } from './bohr';
import { CATEGORY_CLASS, RARITY_CLASS } from './colors';
import { h } from './dom';

export interface CardOptions {
  /** full＝詳しい表示、mini＝一覧用の小さい表示 */
  size?: 'full' | 'mini';
  /** 学習の進み具合（持っていないカードなら省略） */
  progress?: CardProgress;
  /** 上に出す小さな札（NEW など） */
  tag?: string;
  /** 札を「重複」の色にする */
  tagDup?: boolean;
}

/** 段階に応じた枠のクラス（0〜1：なし、2〜3：銀、4：金、5：マスター） */
export function frameClass(progress?: CardProgress): string {
  if (!progress) return '';
  if (isMastered(progress)) return 'frame-master';
  if (progress.stage >= 4) return 'frame-gold';
  if (progress.stage >= 2) return 'frame-silver';
  return '';
}

export function renderCard(el: ElementData, opts: CardOptions = {}): HTMLElement {
  const size = opts.size ?? 'full';
  const rarity = rarityOf(el.number);
  const p = opts.progress;
  const master = p ? isMastered(p) : false;
  const classes = ['card', `card-${size}`, CATEGORY_CLASS[el.category], RARITY_CLASS[rarity], frameClass(p)].filter(Boolean);

  return h(
    'div',
    { class: classes.join(' ') },
    h(
      'div',
      { class: 'card-top' },
      h('span', { class: 'card-num' }, el.number),
      p?.everMastered && !master ? h('span', { class: 'card-star', title: '一度マスターしたカード' }, '★') : null,
      h('span', { class: 'card-rarity' }, rarity),
    ),
    opts.tag ? h('span', { class: opts.tagDup ? 'card-tag is-dup' : 'card-tag' }, opts.tag) : null,
    size === 'full'
      ? h('div', { class: 'card-visual' }, renderBohr(el, 'bohr card-bohr'), h('div', { class: 'card-symbol' }, el.symbol))
      : h('div', { class: 'card-visual' }, renderBohr(el, 'bohr card-bohr-bg'), h('div', { class: 'card-symbol' }, el.symbol)),
    h('div', { class: 'card-name' }, el.nameJa),
    size === 'full' ? h('div', { class: 'card-en' }, el.nameEn) : null,
    h('div', { class: 'card-cat' }, el.category),
    p ? stagePips(p.stage) : null,
    size === 'full'
      ? h(
          'dl',
          { class: 'card-facts' },
          fact('周期', String(el.period)),
          fact('族', String(el.group)),
          fact('状態', el.state),
          fact('電子殻', el.shells.join('-')),
        )
      : null,
    size === 'full' ? h('p', { class: 'card-use' }, el.use) : null,
    master ? h('div', { class: 'master-ribbon' }, 'MASTER') : null,
  );
}

/** 段階を●で表す（段階5でマスター） */
export function stagePips(stage: number): HTMLElement {
  const max = CONFIG.srs.masterStage;
  const pips = Array.from({ length: max }, (_, i) => h('span', { class: i < stage ? 'pip on' : 'pip' }));
  return h('div', { class: 'card-stage', title: `段階 ${stage}`, 'aria-label': `段階 ${stage}` }, ...pips);
}

function fact(label: string, value: string): HTMLElement {
  return h('div', { class: 'fact' }, h('dt', {}, label), h('dd', {}, value));
}
