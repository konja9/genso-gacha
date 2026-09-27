// 演出（ガチャの光など）
import type { Rarity } from '../types';
import { h } from './dom';

/** 動きを減らす設定の端末では、演出を省く */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * ガチャを引いたときの光の演出。
 * いちばん高いレア度で光の色が変わる（N＝白、R＝青、SR＝金、SSR＝虹）。
 * SR 以上のときは、はじめ白く光ってから色が変わる「昇格」の演出が入る。
 * 画面をタップすると飛ばせる。
 */
export function playGachaEffect(best: Rarity): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    const upgrade = best === 'SR' || best === 'SSR';
    const duration = upgrade ? 2600 : 1600;
    const sparks = Array.from({ length: 14 }, (_, i) =>
      h('span', { class: 'spark', style: `--a:${(360 / 14) * i}deg;--d:${(i % 3) * 0.12}s` }),
    );
    const overlay = h(
      'div',
      { class: `gacha-fx fx-${best.toLowerCase()}${upgrade ? ' fx-upgrade' : ''}`, role: 'presentation' },
      h('div', { class: 'fx-rays' }),
      h('div', { class: 'fx-orb' }),
      h('div', { class: 'fx-sparks' }, sparks),
      h('div', { class: 'fx-flash' }),
      h('p', { class: 'fx-skip' }, 'タップでスキップ'),
    );
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      overlay.classList.add('fx-out');
      setTimeout(() => overlay.remove(), 250);
      resolve();
    };
    overlay.addEventListener('click', finish);
    document.body.append(overlay);
    setTimeout(finish, duration);
  });
}
