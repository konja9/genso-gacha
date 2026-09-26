// 元素カードの描画（画像は使わず、CSS で描く）
import { CONFIG } from '../config';
import type { CardProgress } from '../core/srs';
import { isMastered } from '../core/srs';
import { rarityOf } from '../data/elements';
import type { ElementData } from '../types';
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

export function renderCard(el: ElementData, opts: CardOptions = {}): HTMLElement {
  const size = opts.size ?? 'full';
  const rarity = rarityOf(el.number);
  const stage = opts.progress?.stage;
  const classes = [
    'card',
    `card-${size}`,
    CATEGORY_CLASS[el.category],
    RARITY_CLASS[rarity],
    stage !== undefined ? `stage-${stage}` : '',
    opts.progress && isMastered(opts.progress) ? 'is-master' : '',
  ].filter(Boolean);

  return h(
    'div',
    { class: classes.join(' ') },
    h(
      'div',
      { class: 'card-top' },
      h('span', { class: 'card-num' }, el.number),
      h('span', { class: 'card-rarity' }, rarity),
    ),
    opts.tag ? h('span', { class: opts.tagDup ? 'card-tag is-dup' : 'card-tag' }, opts.tag) : null,
    h('div', { class: 'card-symbol' }, el.symbol),
    h('div', { class: 'card-name' }, el.nameJa),
    size === 'full' ? h('div', { class: 'card-en' }, el.nameEn) : null,
    h('div', { class: 'card-cat' }, el.category),
    stage !== undefined ? stagePips(stage) : null,
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
