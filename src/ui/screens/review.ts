// 復習画面（期限の来たカード・当日の確認）と自主練習の画面
// ・期限の来たカードに正解すると石がもらえる。当日の確認に正解すると石が少しもらえる
// ・自主練習では石も段階も変わらないが、正解すると1日の上限まで「かけら」がもらえる
// ・不正解のときは、選んだ元素と正解を並べて違いを見せ、周期表で近いほど「惜しい」を強く出す
// ・はじめて出題するカードは、先にカードを大きく見せてから問題に進む
// ・問題は4択のほか、周期表の位置・電子殻の図を見て答える形式と、記号を文字タイルで入力する形式がある
import { CONFIG } from '../../config';
import type { ClosenessLevel } from '../../core/closeness';
import { CLOSENESS_LABEL, categoryCloseness, elementCloseness } from '../../core/closeness';
import { daysBetween, formatDuration, toDateKey } from '../../core/date';
import { gridDistance, isFBlock } from '../../core/periodic';
import type { Question } from '../../core/quiz';
import { FORMAT_LABEL, formatFor, makeQuestion, valenceOf } from '../../core/quiz';
import { dueList, nextRecheck, practiceList } from '../../core/srs';
import { ELEMENTS, getElement } from '../../data/elements';
import type { AnswerKind, AnswerResult } from '../../state/game';
import { answerDue, answerKind, answerPractice, practiceFragmentsLeft } from '../../state/game';
import type { Category, ElementData } from '../../types';
import { renderBohr } from '../bohr';
import { renderCard, stagePips } from '../card';
import { CATEGORY_CLASS } from '../colors';
import { h, replaceChildren } from '../dom';
import type { MiniMark } from '../minitable';
import { renderMiniTable } from '../minitable';
import { go } from '../nav';
import { store } from '../store';

type Mode = 'due' | 'practice';

/** 選んだ（入力した）答え */
type Chosen =
  | { type: 'element'; number: number }
  | { type: 'category'; value: Category }
  | { type: 'valence'; value: number }
  | { type: 'symbol'; text: string };

/** 元素記号のいちばん長い文字数（入力できる文字数の上限） */
const SYMBOL_MAX = Math.max(...ELEMENTS.map((e) => e.symbol.length));

export function renderReview(root: HTMLElement, mode: Mode): void {
  const start = new Date();
  const data = store.get();
  const queue = mode === 'due' ? dueList(data.cards, start) : practiceList(data.cards, start, CONFIG.quiz.practiceSize);
  const box = h('div', { class: 'review' });
  root.append(box);

  if (queue.length === 0) {
    replaceChildren(box, emptyState(mode));
    return;
  }

  let index = 0;
  let correctCount = 0;
  let stonesTotal = 0;
  let fragmentsTotal = 0;
  showQuestion();

  /** 上の帯（モード・何問目か・やめる）と進み具合のバー */
  function head(): HTMLElement[] {
    return [
      h(
        'div',
        { class: 'review-head' },
        h('span', { class: mode === 'due' ? 'mode-tag due' : 'mode-tag practice' }, mode === 'due' ? '復習' : '自主練習'),
        h('span', { class: 'progress-text' }, `${index + 1} / ${queue.length}`),
        h('button', { class: 'link-btn', onclick: () => go('home') }, 'やめる'),
      ),
      h('div', { class: 'progress-bar' }, h('span', { style: `width:${(index / queue.length) * 100}%` })),
    ];
  }

  /** はじめて出題するカード（まだ一度も答えていない新しいカード）か */
  function isFirstMeeting(number: number, kind: AnswerKind): boolean {
    const card = store.get().cards[number];
    return kind === 'review' && card.stage === 0 && card.reviews === 0;
  }

  /** はじめて出会うカードを大きく見せる。「問題へ」で出題に進む */
  function showIntro(number: number): void {
    const el = getElement(number);
    const toQuestion = h('button', { class: 'btn btn-primary', onclick: () => showQuestion(true) }, '覚えた！問題へ');
    replaceChildren(
      box,
      ...head(),
      h(
        'section',
        { class: 'intro' },
        h('p', { class: 'intro-lead' }, 'はじめて出会う元素です。記号と名前をよく見てから問題に進もう。'),
        renderCard(el, { progress: store.get().cards[number], tag: 'NEW' }),
        toQuestion,
      ),
    );
    toQuestion.focus({ preventScroll: true });
  }

  function showQuestion(introDone = false): void {
    const number = queue[index];
    const card = store.get().cards[number];
    const el = getElement(number);
    const kind: AnswerKind = mode === 'due' ? answerKind(store.get(), number, new Date()) : 'practice';
    if (!introDone && isFirstMeeting(number, kind)) {
      showIntro(number);
      return;
    }
    const recheckStep = kind === 'recheck' && card.recheck ? card.recheck.step : 0;
    // 形式は回数で順番に回す。確認は、直前の復習の次の形式から始める（同じ形式が続かないように）
    const seq = kind === 'review' ? card.reviews : kind === 'recheck' ? card.reviews + recheckStep : card.practiced;
    const q = makeQuestion(el, formatFor(card.stage, seq, el), ELEMENTS, Math.random);
    const steps = CONFIG.srs.sameDayStepsMinutes.length;

    const feedback = h('div', { class: 'feedback-area', 'aria-live': 'polite' });
    const buttons = q.choices.map((c, i) =>
      h('button', { class: 'choice', onclick: () => answerChoice(i) }, c.label),
    );
    const input = q.format === 'symbolInput' ? inputPad() : null;

    replaceChildren(
      box,
      ...head(),
      h(
        'section',
        { class: `question fmt-${q.format}` },
        h(
          'div',
          { class: 'q-meta' },
          h('span', { class: 'fmt-label' }, FORMAT_LABEL[q.format]),
          kind === 'recheck' ? h('span', { class: 'recheck-tag' }, `当日の確認 ${recheckStep + 1}/${steps}`) : null,
          stagePips(card.stage),
        ),
        h('p', { class: 'q-instruction' }, q.instruction),
        promptView(q),
      ),
      input ? input.root : h('div', { class: q.format === 'nameToSymbol' || q.format === 'valence' ? 'choices grid' : 'choices' }, buttons),
      feedback,
    );

    /** 4択の答え */
    function answerChoice(i: number): void {
      const correct = i === q.answerIndex;
      buttons.forEach((b, j) => {
        b.disabled = true;
        if (j === q.answerIndex) b.classList.add('is-answer');
        if (j === i && !correct) b.classList.add('is-wrong');
      });
      const value = q.choices[i].value;
      const chosen: Chosen =
        q.format === 'category'
          ? { type: 'category', value: value as Category }
          : q.format === 'valence'
            ? { type: 'valence', value: value as number }
            : { type: 'element', number: value as number };
      settle(correct, chosen);
    }

    /**
     * 記号を入力する欄：文字タイルを押して記号を作り、「決定」で答える。
     * 使ったタイルは押せなくなり、「1文字消す」で戻る。
     */
    function inputPad(): { root: HTMLElement } {
      let typed = '';
      const shown = h('p', { class: 'input-display', 'aria-live': 'polite' });
      const tiles = q.tiles.map((t) => {
        const b = h('button', { class: 'tile' }, t);
        b.addEventListener('click', () => type(t, b));
        return b;
      });
      const back = h('button', { class: 'btn btn-sub', onclick: erase }, '1文字消す');
      const submit = h('button', { class: 'btn btn-primary', onclick: () => finish() }, '決定');
      const root = h('div', { class: 'input-pad' }, shown, h('div', { class: 'tiles' }, tiles), h('div', { class: 'input-actions' }, back, submit));
      update();
      return { root };

      function type(t: string, b: HTMLButtonElement): void {
        if (typed.length >= SYMBOL_MAX) return;
        typed += t;
        b.disabled = true;
        update();
      }
      function erase(): void {
        if (!typed) return;
        const last = typed[typed.length - 1];
        typed = typed.slice(0, -1);
        const b = tiles.find((x) => x.textContent === last && x.disabled);
        if (b) b.disabled = false;
        update();
      }
      function update(): void {
        replaceChildren(shown, typed || h('span', { class: 'input-placeholder' }, '？'));
        back.disabled = typed === '';
        submit.disabled = typed === '';
      }
      function finish(): void {
        const correct = typed === q.answerText;
        [...tiles, back, submit].forEach((b) => (b.disabled = true));
        shown.classList.add(correct ? 'is-answer' : 'is-wrong');
        if (!correct) shown.append(h('span', { class: 'input-correct' }, `正解は ${q.answerText}`));
        settle(correct, { type: 'symbol', text: typed });
      }
    }

    /** 答えを記録して、正解・不正解の説明と「次へ」を出す */
    function settle(correct: boolean, chosen: Chosen): void {
      const now = new Date();
      const result = mode === 'due' ? answerDue(store.get(), number, correct, now) : answerPractice(store.get(), number, correct, now);
      store.set(result.data);
      if (correct) correctCount++;
      stonesTotal += result.stones;
      fragmentsTotal += result.fragments;

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
        correct ? correctFeedback(q, el, result, now, recheckStep) : wrongFeedback(chosen, el, result, now),
        next,
      );
      next.focus({ preventScroll: true });
      feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function showSummary(): void {
    const total = queue.length;
    const now = new Date();
    const rest = mode === 'practice' ? practiceList(store.get().cards, now, 1).length : 0;
    const recheck = nextRecheck(store.get().cards, now);
    const fragLeft = practiceFragmentsLeft(store.get(), toDateKey(now));
    replaceChildren(
      box,
      h(
        'section',
        { class: 'panel summary' },
        h('h2', {}, mode === 'due' ? '復習おつかれさま！' : '自主練習おつかれさま！'),
        h('p', { class: 'big-number' }, correctCount, h('small', {}, ` / ${total} 問正解`)),
        mode === 'due'
          ? h('p', { class: 'reward-line' }, `ガチャ石 +${stonesTotal}`)
          : h('p', { class: 'reward-line fragment' }, `かけら +${fragmentsTotal}`),
        mode === 'practice'
          ? h('p', { class: 'muted' }, fragLeft > 0 ? `自主練習のかけらは今日あと${fragLeft}個もらえます。` : '自主練習のかけらは今日の上限に達しました。')
          : null,
        recheck
          ? h('p', { class: 'next-recheck' }, `次の確認：あと${formatDuration(recheck.at - now.getTime())}（${recheck.count}枚）。時間をおいてまた開いてください。`)
          : null,
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
  const now = new Date();
  const hasCards = Object.keys(data.cards).length > 0;
  if (mode === 'practice') {
    return h(
      'section',
      { class: 'panel' },
      h('h2', {}, '練習できるカードがありません'),
      h('p', { class: 'muted' }, '期限の来ていないカード（今日の確認が残っているものを除く）があると、自主練習できます。'),
      h('button', { class: 'btn btn-sub', onclick: () => go('home') }, 'ホームへ'),
    );
  }
  const recheck = nextRecheck(data.cards, now);
  const canPractice = practiceList(data.cards, now, 1).length > 0;
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, hasCards ? 'いま解ける問題はありません' : 'まだカードがありません'),
    recheck ? h('p', { class: 'next-recheck' }, `次の確認：あと${formatDuration(recheck.at - now.getTime())}（${recheck.count}枚）`) : null,
    h(
      'p',
      { class: 'muted' },
      hasCards
        ? '期限前のカードは自主練習できます（石は出ませんが、正解するとかけらがもらえます）。'
        : 'ガチャで元素を手に入れると、復習できるようになります。',
    ),
    !hasCards
      ? h('button', { class: 'btn btn-primary', onclick: () => go('gacha') }, 'ガチャへ')
      : canPractice
        ? h('button', { class: 'btn btn-sub', onclick: () => go('practice') }, '自主練習する')
        : null,
  );
}

/** 問題の大きく出す部分：文字・周期表の位置・電子殻の図 */
function promptView(q: Question): HTMLElement {
  if (q.display === 'position') return h('div', { class: 'q-position' }, renderMiniTable([{ number: q.target, kind: 'target' }], true));
  if (q.display === 'bohr') return h('div', { class: 'q-bohr' }, renderBohr(getElement(q.target), 'bohr q-bohr-svg'));
  return h('p', { class: 'q-prompt' }, q.prompt);
}

/** 価電子の説明（電子殻の電子の数から） */
function valenceNote(el: ElementData): string {
  const outer = el.shells[el.shells.length - 1];
  const tail =
    el.group === 18
      ? `いちばん外側に${outer}個ありますが、貴ガスは安定で結合しにくいため、価電子は0個として数えます。`
      : `いちばん外側の電子殻に${outer}個あるので、価電子は${valenceOf(el)}個です。`;
  return `${el.nameJa}の電子殻は ${el.shells.join('-')}。${tail}`;
}

/** 正解したとき */
function correctFeedback(q: Question, el: ElementData, result: AnswerResult, now: Date, recheckStep: number): HTMLElement {
  return h(
    'div',
    { class: 'feedback ok' },
    h('p', { class: 'fb-title' }, '正解！'),
    h(
      'p',
      { class: 'fb-reward' },
      result.stones > 0 ? h('span', { class: 'stone-gain' }, `+${result.stones} 石`) : null,
      result.fragments > 0 ? h('span', { class: 'stone-gain fragment' }, `+${result.fragments} かけら`) : null,
      h('span', { class: 'muted' }, outcomeText(el.number, result, now, true, recheckStep)),
    ),
    q.format === 'valence' ? h('p', { class: 'valence-note' }, valenceNote(el)) : null,
    answerSummary(el),
  );
}

/**
 * 答えた後に、段階や次の出題がどうなったかをひとことで。
 * 例：「段階 0 → 1・明日また出ます・10分後にもう一度確認」「確認 1/2 クリア・次は1時間後」
 * はじめての出題で不正解のときは「覚えはじめ」、段階が変わらないときは「段階 1 のまま」とする。
 */
function outcomeText(number: number, result: AnswerResult, now: Date, correct: boolean, recheckStep: number): string {
  const card = store.get().cards[number];
  const steps = CONFIG.srs.sameDayStepsMinutes.length;
  const later = card.recheck ? formatDuration(card.recheck.at - now.getTime()) : '';
  if (result.kind === 'review') {
    const stage =
      result.stageBefore === 0 && !correct
        ? '覚えはじめ'
        : result.stageBefore === result.stageAfter
          ? `段階 ${result.stageAfter} のまま`
          : `段階 ${result.stageBefore} → ${result.stageAfter}`;
    const parts = [stage, nextText(toDateKey(now), card.due)];
    if (card.recheck) parts.push(`${later}後にもう一度確認`);
    return parts.join('・');
  }
  if (result.kind === 'recheck') {
    if (!correct) return `${later}後にもう一度確認します`;
    return card.recheck ? `当日の確認 ${recheckStep + 1}/${steps} クリア・次は${later}後` : '今日の確認クリア！';
  }
  if (!correct) return '自主練習なので段階は変わりません';
  const left = practiceFragmentsLeft(store.get(), toDateKey(now));
  return result.fragments > 0 ? `自主練習のかけら 今日あと${left}個` : '自主練習のかけらは今日の上限です';
}

/**
 * 不正解のとき：選んだものと正解を並べて見せる。
 * 元素を選んだ（または実在する記号を入力した）ときは、比較表と周期表の位置で違いを見せる。
 */
function wrongFeedback(chosen: Chosen, answer: ElementData, result: AnswerResult, now: Date): HTMLElement {
  let level: ClosenessLevel = 0;
  let relation: string | null = null;
  let compare: HTMLElement;
  const chosenEl =
    chosen.type === 'element' ? getElement(chosen.number) : chosen.type === 'symbol' ? (ELEMENTS.find((e) => e.symbol === chosen.text) ?? null) : null;
  const marks: MiniMark[] = [{ number: answer.number, kind: 'answer' }];
  if (chosenEl) marks.unshift({ number: chosenEl.number, kind: 'chosen' });

  if (chosen.type === 'category') {
    level = categoryCloseness(chosen.value, answer.category);
    compare = compareChips(catChip(chosen.value), catChip(answer.category));
  } else if (chosen.type === 'valence') {
    const d = Math.abs(chosen.value - (valenceOf(answer) ?? 0));
    level = d === 1 ? 2 : d === 2 ? 1 : 0;
    compare = h(
      'div',
      { class: 'valence-compare' },
      compareChips(plainChip(`${chosen.value}個`), plainChip(`${valenceOf(answer)}個`)),
      h('p', { class: 'valence-note' }, valenceNote(answer)),
    );
  } else if (chosenEl) {
    level = elementCloseness(chosenEl, answer);
    relation = relationText(chosenEl, answer);
    compare = compareTable(chosenEl, answer);
  } else {
    // 実在しない記号を入力したとき
    relation = `「${chosen.type === 'symbol' ? chosen.text : ''}」という記号の元素はありません`;
    compare = compareChips(plainChip(chosen.type === 'symbol' ? chosen.text : ''), plainChip(answer.symbol));
  }
  return h(
    'div',
    { class: `feedback ng close-${level}` },
    h('p', { class: 'fb-title' }, CLOSENESS_LABEL[level]),
    relation ? h('p', { class: 'relation' }, relation) : null,
    compare,
    h(
      'div',
      { class: 'minitable-wrap' },
      renderMiniTable(marks),
      h(
        'p',
        { class: 'mt-legend' },
        chosenEl ? h('span', { class: 'mt-key mt-chosen' }) : null,
        chosenEl ? '選んだ元素 ' : null,
        h('span', { class: 'mt-key mt-answer' }),
        '正解',
      ),
    ),
    h('p', { class: 'muted' }, outcomeText(answer.number, result, now, false, 0)),
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

function plainChip(text: string): HTMLElement {
  return h('span', { class: 'cat-chip plain' }, text);
}

/** 「あなたの答え」と「正解」を左右に並べる */
function compareChips(mine: HTMLElement, right: HTMLElement): HTMLElement {
  return h(
    'div',
    { class: 'compare-cats' },
    h('div', {}, h('span', { class: 'muted' }, 'あなたの答え'), mine),
    h('div', {}, h('span', { class: 'muted' }, '正解'), right),
  );
}
