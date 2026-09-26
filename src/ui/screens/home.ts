// ホーム画面：今日の復習数、石の数、ガチャへの入口
import { CONFIG } from '../../config';
import { daysBetween, today } from '../../core/date';
import { dueList, isMastered, practiceList } from '../../core/srs';
import { canUseFree } from '../../state/game';
import { h, replaceChildren } from '../dom';
import { go } from '../nav';
import { store } from '../store';

export function renderHome(root: HTMLElement): void {
  const data = store.get();
  const day = today();
  const cards = Object.values(data.cards);
  const due = dueList(data.cards, day).length;
  const owned = cards.length;
  const mastered = cards.filter(isMastered).length;
  const free = canUseFree(data, day);
  const canPractice = practiceList(data.cards, day, 1).length > 0;

  replaceChildren(
    root,
    h('header', { class: 'home-head' }, h('h1', { class: 'title' }, '元素ガチャ'), h('p', { class: 'subtitle' }, '集めて、思い出して、覚える')),

    !store.persistent
      ? h('p', { class: 'notice warn' }, 'この環境では進行データを保存できません。ページを閉じると記録が消えます。')
      : null,
    store.recovered ? h('p', { class: 'notice warn' }, '保存データが読み込めなかったため、はじめからにしました。') : null,

    owned === 0 ? firstRun() : reviewPanel(due, data.cards, day),

    h(
      'section',
      { class: 'stats-row' },
      stat('ガチャ石', data.stones, 'stone'),
      stat('かけら', data.fragments, 'fragment'),
      stat('所持', `${owned}/118`, 'owned'),
      stat('マスター', mastered, 'master'),
    ),

    h(
      'section',
      { class: 'home-actions' },
      h(
        'button',
        { class: 'btn btn-gacha', onclick: () => go('gacha') },
        h('span', {}, 'ガチャを引く'),
        free ? h('span', { class: 'pill' }, '無料1回あり') : null,
      ),
      canPractice
        ? h('button', { class: 'btn btn-sub', onclick: () => go('practice') }, '自主練習（石は出ません）')
        : null,
    ),
  );
}

function firstRun(): HTMLElement {
  return h(
    'section',
    { class: 'panel panel-first' },
    h('h2', {}, 'まずはガチャで元素を手に入れよう'),
    h(
      'p',
      {},
      `最初に石を${CONFIG.stones.initial}個持っています。入手した元素はすぐに復習の対象になり、期限が来たカードに正解すると石がもらえます。`,
    ),
    h('button', { class: 'btn btn-primary', onclick: () => go('gacha') }, 'ガチャへ'),
  );
}

function reviewPanel(due: number, cards: ReturnType<typeof store.get>['cards'], day: string): HTMLElement {
  if (due > 0) {
    return h(
      'section',
      { class: 'panel panel-due' },
      h('p', { class: 'panel-label' }, '今日の復習'),
      h('p', { class: 'big-number' }, due, h('small', {}, '枚')),
      h('button', { class: 'btn btn-primary', onclick: () => go('review') }, '復習をはじめる'),
    );
  }
  // 次に期限が来る日と枚数
  const dues = Object.values(cards).map((c) => c.due).sort();
  const next = dues[0];
  const nextCount = dues.filter((d) => d === next).length;
  const days = next ? daysBetween(day, next) : 0;
  return h(
    'section',
    { class: 'panel panel-done' },
    h('p', { class: 'panel-label' }, '今日の復習'),
    h('p', { class: 'done-text' }, 'すべて完了！'),
    next ? h('p', { class: 'muted' }, `次の復習：${days === 1 ? '明日' : `${days}日後`}に${nextCount}枚`) : null,
  );
}

function stat(label: string, value: string | number, kind: string): HTMLElement {
  return h('div', { class: `stat stat-${kind}` }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}
