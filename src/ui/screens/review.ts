// 復習画面（期限の来たカード）と自主練習の画面
// ・期限の来たカードに正解すると石がもらえる。自主練習では石も段階も変わらない
// ・不正解のときは、選んだ元素と正解を並べて違いを見せ、周期表で近いほど「惜しい」を強く出す
import { CONFIG } from '../../config';
import type { ClosenessLevel } from '../../core/closeness';
import { CLOSENESS_LABEL, categoryCloseness, elementCloseness } from '../../core/closeness';
import { daysBetween, today } from '../../core/date';
import { gridDistance, isFBlock } from '../../core/periodic';
import type { Question } from '../../core/quiz';
import { FORMAT_LABEL, formatFor, makeQuestion } from '../../core/quiz';
import { dueList, practiceList } from '../../core/srs';
import { ELEMENTS, getElement } from '../../data/elements';
import type { AnswerResult } from '../../state/game';
import { answerDue, answerPractice } from '../../state/game';
import type { Category, ElementData } from '../../types';
import { stagePips } from '../card';
import { CATEGORY_CLASS } from '../colors';
import { h, replaceChildren } from '../dom';
import { go } from '../nav';
import { store } from '../store';

type Mode = 'due' | 'practice';

export function renderReview(root: HTMLElement, mode: Mode): void {
  const day = today();
  const data = store.get();
  const queue = mode === 'due' ? dueList(data.cards, day) : practiceList(data.cards, day, CONFIG.quiz.practiceSize);
  const box = h('div', { class: 'review' });
  root.append(box);

  if (queue.length === 0) {
    replaceChildren(box, emptyState(mode));
    return;
  }

  let index = 0;
  let correctCount = 0;
  let stonesTotal = 0;
  showQuestion();

  function showQuestion(): void {
    const number = queue[index];
    const card = store.get().cards[number];
    const el = getElement(number);
    const seq = mode === 'due' ? card.reviews : card.practiced;
    const q = makeQuestion(el, formatFor(card.stage, seq), ELEMENTS, Math.random);

    const feedback = h('div', { class: 'feedback-area', 'aria-live': 'polite' });
    const buttons = q.choices.map((c, i) =>
      h('button', { class: 'choice', onclick: () => answer(i) }, c.label),
    );

    replaceChildren(
      box,
      h(
        'div',
        { class: 'review-head' },
        h('span', { class: mode === 'due' ? 'mode-tag due' : 'mode-tag practice' }, mode === 'due' ? '復習' : '自主練習'),
        h('span', { class: 'progress-text' }, `${index + 1} / ${queue.length}`),
        h('button', { class: 'link-btn', onclick: () => go('home') }, 'やめる'),
      ),
      h('div', { class: 'progress-bar' }, h('span', { style: `width:${(index / queue.length) * 100}%` })),
      h(
        'section',
        { class: `question fmt-${q.format}` },
        h('div', { class: 'q-meta' }, h('span', { class: 'fmt-label' }, FORMAT_LABEL[q.format]), stagePips(card.stage)),
        h('p', { class: 'q-instruction' }, q.instruction),
        h('p', { class: 'q-prompt' }, q.prompt),
      ),
      h('div', { class: q.format === 'nameToSymbol' ? 'choices grid' : 'choices' }, buttons),
      feedback,
    );

    function answer(i: number): void {
      const correct = i === q.answerIndex;
      buttons.forEach((b, j) => {
        b.disabled = true;
        if (j === q.answerIndex) b.classList.add('is-answer');
        if (j === i && !correct) b.classList.add('is-wrong');
      });
      const now = today();
      const result = mode === 'due' ? answerDue(store.get(), number, correct, now) : answerPractice(store.get(), number, correct, now);
      store.set(result.data);
      if (correct) correctCount++;
      stonesTotal += result.stones;

      const isLast = index === queue.length - 1;
      const next = h(
        'button',
        {
          class: 'btn btn-primary next-btn',
          onclick: () => {
            if (isLast) showSummary();
            else {
              index++;
              showQuestion();
            }
          },
        },
        isLast ? '結果を見る' : '次へ',
      );
      replaceChildren(
        feedback,
        correct ? correctFeedback(el, result, now) : wrongFeedback(q, i, el, result, now),
        next,
      );
      next.focus({ preventScroll: true });
      feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function showSummary(): void {
    const total = queue.length;
    const rest = mode === 'practice' ? practiceList(store.get().cards, today(), 1).length : 0;
    replaceChildren(
      box,
      h(
        'section',
        { class: 'panel summary' },
        h('h2', {}, mode === 'due' ? '今日の復習、おつかれさま！' : '自主練習おつかれさま！'),
        h('p', { class: 'big-number' }, correctCount, h('small', {}, ` / ${total} 問正解`)),
        mode === 'due'
          ? h('p', { class: 'reward-line' }, `ガチャ石 +${stonesTotal}`)
          : h('p', { class: 'muted' }, '自主練習では石は出ず、段階も変わりません。'),
        h(
          'div',
          { class: 'summary-actions' },
          mode === 'due' ? h('button', { class: 'btn btn-gacha', onclick: () => go('gacha') }, 'ガチャへ') : null,
          mode === 'practice' && rest > 0
            ? h('button', { class: 'btn btn-sub', onclick: () => go('practice') }, 'もう一度練習する')
            : null,
          h('button', { class: 'btn btn-sub', onclick: () => go('home') }, 'ホームへ'),
        ),
      ),
    );
  }
}

function emptyState(mode: Mode): HTMLElement {
  const data = store.get();
  const hasCards = Object.keys(data.cards).length > 0;
  if (mode === 'practice') {
    return h(
      'section',
      { class: 'panel' },
      h('h2', {}, '練習できるカードがありません'),
      h('p', { class: 'muted' }, '期限の来ていないカードがあると、自主練習できます。'),
      h('button', { class: 'btn btn-sub', onclick: () => go('home') }, 'ホームへ'),
    );
  }
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, hasCards ? '今日の復習はすべて完了！' : 'まだカードがありません'),
    h(
      'p',
      { class: 'muted' },
      hasCards ? '期限前のカードは自主練習できます（石は出ません）。' : 'ガチャで元素を手に入れると、復習できるようになります。',
    ),
    hasCards
      ? h('button', { class: 'btn btn-sub', onclick: () => go('practice') }, '自主練習する')
      : h('button', { class: 'btn btn-primary', onclick: () => go('gacha') }, 'ガチャへ'),
  );
}

/** 正解したとき */
function correctFeedback(el: ElementData, result: AnswerResult, now: string): HTMLElement {
  const card = store.get().cards[el.number];
  return h(
    'div',
    { class: 'feedback ok' },
    h('p', { class: 'fb-title' }, '正解！'),
    result.counted
      ? h(
          'p',
          { class: 'fb-reward' },
          h('span', { class: 'stone-gain' }, `+${result.stones} 石`),
          h('span', { class: 'muted' }, `段階 ${result.stageBefore} → ${result.stageAfter}・${nextText(now, card.due)}`),
        )
      : h('p', { class: 'muted' }, '自主練習なので石は出ません'),
    answerSummary(el),
  );
}

/** 不正解のとき：選んだものと正解を並べて見せる */
function wrongFeedback(q: Question, chosenIndex: number, answer: ElementData, result: AnswerResult, now: string): HTMLElement {
  const chosenValue = q.choices[chosenIndex].value;
  let level: ClosenessLevel;
  let compare: HTMLElement;
  if (typeof chosenValue === 'string') {
    // 分類当て
    level = categoryCloseness(chosenValue as Category, answer.category);
    compare = h(
      'div',
      { class: 'compare-cats' },
      h('div', {}, h('span', { class: 'muted' }, 'あなたの答え'), catChip(chosenValue as Category)),
      h('div', {}, h('span', { class: 'muted' }, '正解'), catChip(answer.category)),
    );
  } else {
    const chosen = getElement(chosenValue);
    level = elementCloseness(chosen, answer);
    compare = compareTable(chosen, answer);
  }
  return h(
    'div',
    { class: `feedback ng close-${level}` },
    h('p', { class: 'fb-title' }, CLOSENESS_LABEL[level]),
    typeof chosenValue === 'number' ? h('p', { class: 'relation' }, relationText(getElement(chosenValue), answer)) : null,
    compare,
    result.counted
      ? h('p', { class: 'muted' }, `段階 ${result.stageBefore} → ${result.stageAfter}・${nextText(now, store.get().cards[answer.number].due)}`)
      : h('p', { class: 'muted' }, '自主練習なので段階は変わりません'),
    answerSummary(answer),
  );
}

/** 次に出る日の説明 */
function nextText(now: string, due: string): string {
  const days = daysBetween(now, due);
  return days <= 0 ? '今日また出ます' : days === 1 ? '明日また出ます' : `次は${days}日後`;
}

/** 選んだ元素と正解の関係をひとことで */
function relationText(chosen: ElementData, answer: ElementData): string {
  const parts: string[] = [];
  const dist = gridDistance(chosen, answer);
  if (dist === 1) parts.push('周期表で隣どうし');
  else if (dist === 2) parts.push('周期表で2マス先');
  if (chosen.group === answer.group && !isFBlock(chosen) && !isFBlock(answer)) parts.push('同じ族（縦の列）');
  if (chosen.period === answer.period) parts.push('同じ周期（横の行）');
  if (chosen.category === answer.category) parts.push(`どちらも${answer.category}`);
  const dn = Math.abs(chosen.number - answer.number);
  if (dn <= 3) parts.push(`原子番号が${dn}違い`);
  return parts.length > 0 ? parts.join('・') : '周期表の上では離れた元素です';
}

/** 選んだ元素と正解の比較表 */
function compareTable(chosen: ElementData, answer: ElementData): HTMLElement {
  const rows: [string, string, string][] = [
    ['記号', chosen.symbol, answer.symbol],
    ['名前', chosen.nameJa, answer.nameJa],
    ['原子番号', String(chosen.number), String(answer.number)],
    ['周期', String(chosen.period), String(answer.period)],
    ['族', String(chosen.group), String(answer.group)],
    ['分類', chosen.category, answer.category],
    ['状態', chosen.state, answer.state],
  ];
  return h(
    'table',
    { class: 'compare' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'col-chosen' }, '選んだ元素'), h('th', { class: 'col-answer' }, '正解'))),
    h(
      'tbody',
      {},
      rows.map(([label, a, b]) =>
        h('tr', { class: a === b ? 'same' : 'diff' }, h('th', {}, label), h('td', { class: 'col-chosen' }, a), h('td', { class: 'col-answer' }, b)),
      ),
    ),
  );
}

/** 正解の元素の要点（記号・名前・原子番号・分類・用途） */
function answerSummary(el: ElementData): HTMLElement {
  return h(
    'div',
    { class: `answer-summary ${CATEGORY_CLASS[el.category]}` },
    h('div', { class: 'as-symbol' }, el.symbol),
    h(
      'div',
      { class: 'as-body' },
      h('p', { class: 'as-name' }, `${el.number}. ${el.nameJa}`, h('span', { class: 'as-en' }, el.nameEn)),
      h('p', { class: 'as-cat' }, `${el.category}・${el.period}周期 ${el.group}族`),
      h('p', { class: 'as-use' }, el.use),
    ),
  );
}

function catChip(c: Category): HTMLElement {
  return h('span', { class: `cat-chip ${CATEGORY_CLASS[c]}` }, c);
}
