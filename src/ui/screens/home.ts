// ホーム画面：いま解ける問題の数、石の数、ガチャへの入口、次に遊べるもの
// 開いている間は30秒ごとに描き直し、当日の確認や無料ガチャの回復を反映する。
import { CONFIG } from '../../config';
import { daysBetween, formatDuration, nextFreeSlotAt, toDateKey } from '../../core/date';
import { dueList, isMastered, nextRecheck, practiceList } from '../../core/srs';
import { canUseFree, practiceFragmentsLeft } from '../../state/game';
import { h, replaceChildren } from '../dom';
import { go } from '../nav';
import { store } from '../store';

export function renderHome(root: HTMLElement): () => void {
  draw(root);
  const timer = setInterval(() => draw(root), 30_000);
  return () => clearInterval(timer);
}

function draw(root: HTMLElement): void {
  const data = store.get();
  const now = new Date();
  const day = toDateKey(now);
  const cards = Object.values(data.cards);
  const due = dueList(data.cards, now).length;
  const owned = cards.length;
  const mastered = cards.filter(isMastered).length;
  const free = canUseFree(data, now);
  const canPractice = practiceList(data.cards, now, 1).length > 0;
  const fragLeft = practiceFragmentsLeft(data, day);

  replaceChildren(
    root,
    h(
      'header',
      { class: 'home-head' },
      h('div', {}, h('h1', { class: 'title' }, '元素ガチャ'), h('p', { class: 'subtitle' }, '集めて、思い出して、覚える')),
      h('button', { class: 'icon-btn', 'aria-label': '設定', onclick: () => go('settings') }, '⚙'),
    ),

    !store.persistent
      ? h('p', { class: 'notice warn' }, 'この環境では進行データを保存できません。ページを閉じると記録が消えます。')
      : null,
    store.recovered ? h('p', { class: 'notice warn' }, '保存データが読み込めなかったため、はじめからにしました。') : null,

    owned === 0 ? firstRun() : reviewPanel(due, data.cards, now),

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
        h('span', { class: 'pill' }, free ? '無料1回あり' : `無料まで ${formatDuration(nextFreeSlotAt(now).getTime() - now.getTime())}`),
      ),
      canPractice
        ? h(
            'button',
            { class: 'btn btn-sub', onclick: () => go('practice') },
            h('span', {}, '自主練習'),
            h('span', { class: 'pill pill-fragment' }, fragLeft > 0 ? `かけら 今日あと${fragLeft}個` : 'かけらは今日の上限'),
          )
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

function reviewPanel(due: number, cards: ReturnType<typeof store.get>['cards'], now: Date): HTMLElement {
  if (due > 0) {
    return h(
      'section',
      { class: 'panel panel-due' },
      h('p', { class: 'panel-label' }, 'いま解ける問題'),
      h('p', { class: 'big-number' }, due, h('small', {}, '枚')),
      h('button', { class: 'btn btn-primary', onclick: () => go('review') }, '復習をはじめる'),
    );
  }
  // 今日の確認が残っていれば、その時刻を。なければ次に期限が来る日と枚数を出す
  const recheck = nextRecheck(cards, now);
  const day = toDateKey(now);
  const dues = Object.values(cards).map((c) => c.due).sort();
  const next = dues[0];
  const nextCount = dues.filter((d) => d === next).length;
  const days = next ? daysBetween(day, next) : 0;
  return h(
    'section',
    { class: 'panel panel-done' },
    h('p', { class: 'panel-label' }, 'いま解ける問題'),
    h('p', { class: 'done-text' }, 'すべて完了！'),
    recheck
      ? h('p', { class: 'next-recheck' }, `次の確認：あと${formatDuration(recheck.at - now.getTime())}（今日の残り${recheck.count}枚）`)
      : null,
    next ? h('p', { class: 'muted' }, `次の復習：${days === 1 ? '明日' : `${days}日後`}に${nextCount}枚`) : null,
  );
}

function stat(label: string, value: string | number, kind: string): HTMLElement {
  return h('div', { class: `stat stat-${kind}` }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}
