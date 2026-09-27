// 記録画面：正答率の推移と、段階ごとの枚数
// グラフはライブラリを使わず SVG で描く。点や棒をタップすると数値が出る。
import { CONFIG } from '../../config';
import { today } from '../../core/date';
import type { AccuracyPoint } from '../../core/stats';
import { accuracySeries, stageCounts, streakDays, totals } from '../../core/stats';
import { isMastered } from '../../core/srs';
import { h, replaceChildren, svg } from '../dom';
import { go } from '../nav';
import { store } from '../store';

const DAYS = 30;
const INTERVAL_LABEL = ['当日', '1日', '3日', '7日', '14日', '30日'];

export function renderStats(root: HTMLElement): void {
  const data = store.get();
  const day = today();
  const t = totals(data.daily);
  const series = accuracySeries(data.daily, day, DAYS);
  const counts = stageCounts(data.cards);
  const mastered = Object.values(data.cards).filter(isMastered).length;
  const rate = t.dueTotal > 0 ? Math.round((t.dueCorrect / t.dueTotal) * 100) : null;

  replaceChildren(
    root,
    h('h1', { class: 'screen-title' }, '記録'),
    h(
      'section',
      { class: 'stats-row' },
      tile(`${streakDays(data.daily, day)}日`, '連続復習'),
      tile(rate === null ? '—' : `${rate}%`, '累計正答率'),
      tile(t.dueTotal, '復習した数'),
      tile(mastered, 'マスター'),
    ),
    h(
      'section',
      { class: 'panel chart-panel' },
      h('h2', {}, `期限の復習の正答率（${DAYS}日間）`),
      series.some((p) => p.rate !== null)
        ? [accuracyChart(series), accuracyTable(series)]
        : h('p', { class: 'muted' }, 'まだ記録がありません。復習をするとここに表示されます。'),
    ),
    h(
      'section',
      { class: 'panel chart-panel' },
      h('h2', {}, '段階ごとの枚数'),
      Object.keys(data.cards).length > 0 ? stageChart(counts) : h('p', { class: 'muted' }, 'まだカードがありません。'),
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'これまで'),
      h(
        'p',
        { class: 'muted' },
        `復習した日 ${t.days}日・期限の復習 ${t.dueCorrect}/${t.dueTotal}問正解・自主練習 ${t.practiceCorrect}/${t.practiceTotal}問正解・もらった石 ${t.stonesEarned}個・ガチャ ${data.totalPulls}回`,
      ),
    ),
    h('button', { class: 'btn btn-sub', onclick: () => go('settings') }, '設定（バックアップ・リセット）'),
  );
}

function tile(value: string | number, label: string): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}

/** 正答率の折れ線グラフ。復習しなかった日は線を切る */
function accuracyChart(series: AccuracyPoint[]): HTMLElement {
  const W = 320;
  const H = 170;
  const L = 34; // 左の目盛りの幅
  const R = 8;
  const T = 10;
  const B = 24; // 下の日付の高さ
  const x = (i: number) => L + ((W - L - R) * i) / (series.length - 1);
  const y = (rate: number) => T + (H - T - B) * (1 - rate);

  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': '日ごとの正答率の折れ線グラフ' });
  // 目盛り線（0%・50%・100%）
  for (const v of [0, 0.5, 1]) {
    chart.appendChild(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }));
    const label = svg('text', { x: L - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
    label.textContent = `${v * 100}%`;
    chart.appendChild(label);
  }
  // 日付（最初・真ん中・最後）
  for (const i of [0, Math.floor((series.length - 1) / 2), series.length - 1]) {
    const label = svg('text', { x: x(i), y: H - 6, class: 'tick', 'text-anchor': i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle' });
    label.textContent = md(series[i].date);
    chart.appendChild(label);
  }
  // 線（続いている区間ごとに描く）
  let seg: string[] = [];
  const flush = () => {
    if (seg.length > 1) chart.appendChild(svg('polyline', { points: seg.join(' '), class: 'line' }));
    seg = [];
  };
  series.forEach((p, i) => {
    if (p.rate === null) flush();
    else seg.push(`${x(i)},${y(p.rate)}`);
  });
  flush();

  const tip = h('div', { class: 'chart-tip', hidden: true });
  const cursor = svg('line', { x1: 0, x2: 0, y1: T, y2: H - B, class: 'cursor', visibility: 'hidden' });
  chart.appendChild(cursor);
  series.forEach((p, i) => {
    if (p.rate === null) return;
    chart.appendChild(svg('circle', { cx: x(i), cy: y(p.rate), r: 3, class: 'dot' }));
  });
  // 日ごとの当たり判定（点より広い）。タップや指を乗せると数値を出す
  const colW = (W - L - R) / (series.length - 1);
  series.forEach((p, i) => {
    const hit = svg('rect', { x: x(i) - colW / 2, y: T, width: colW, height: H - T - B, class: 'hit' });
    const show = () => {
      cursor.setAttribute('x1', String(x(i)));
      cursor.setAttribute('x2', String(x(i)));
      cursor.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.textContent = p.rate === null ? `${md(p.date)}：復習なし` : `${md(p.date)}：${p.correct}/${p.total}問 正解（${Math.round(p.rate * 100)}%）`;
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('click', show);
    chart.appendChild(hit);
  });
  return h('div', { class: 'chart-wrap' }, chart, tip);
}

/** 同じ内容を数値の表で見られるようにする */
function accuracyTable(series: AccuracyPoint[]): HTMLElement {
  const rows = series.filter((p) => p.rate !== null).reverse();
  return h(
    'details',
    { class: 'chart-table' },
    h('summary', {}, '数値で見る'),
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, h('th', {}, '日付'), h('th', {}, '正解/問題'), h('th', {}, '正答率'))),
      h('tbody', {}, rows.map((p) => h('tr', {}, h('td', {}, md(p.date)), h('td', {}, `${p.correct}/${p.total}`), h('td', {}, `${Math.round((p.rate ?? 0) * 100)}%`)))),
    ),
  );
}

/** 段階ごとの枚数の棒グラフ（棒の上に枚数を書く） */
function stageChart(counts: number[]): HTMLElement {
  const W = 320;
  const H = 170;
  const T = 18;
  const B = 36;
  const max = Math.max(...counts, 1);
  const slot = W / counts.length;
  const barW = Math.min(34, slot - 12);
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `段階ごとの枚数：${counts.map((c, i) => `段階${i} ${c}枚`).join('、')}` });
  chart.appendChild(svg('line', { x1: 0, x2: W, y1: H - B, y2: H - B, class: 'axis' }));
  counts.forEach((c, i) => {
    const cx = slot * i + slot / 2;
    const bh = ((H - T - B) * c) / max;
    if (c > 0) {
      // 上だけ角を丸めた棒
      const r = Math.min(4, bh);
      const x0 = cx - barW / 2;
      const y0 = H - B - bh;
      chart.appendChild(
        svg('path', {
          d: `M${x0},${H - B} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + barW - r} Q${x0 + barW},${y0} ${x0 + barW},${y0 + r} V${H - B} Z`,
          class: i === CONFIG.srs.masterStage ? 'bar master' : 'bar',
        }),
      );
    }
    const v = svg('text', { x: cx, y: H - B - bh - 5, class: 'value', 'text-anchor': 'middle' });
    v.textContent = String(c);
    chart.appendChild(v);
    const l1 = svg('text', { x: cx, y: H - B + 15, class: 'tick', 'text-anchor': 'middle' });
    l1.textContent = i === CONFIG.srs.masterStage ? '5★' : String(i);
    const l2 = svg('text', { x: cx, y: H - B + 29, class: 'tick small', 'text-anchor': 'middle' });
    l2.textContent = INTERVAL_LABEL[i];
    chart.append(l1, l2);
  });
  return h('div', { class: 'chart-wrap' }, chart, h('p', { class: 'muted chart-note' }, '下の段の数字は段階、その下は次の復習までの間隔です'));
}

function md(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}
