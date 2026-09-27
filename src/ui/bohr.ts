// 電子殻の図（ボーア模型風）を SVG で描く
import { bohrLayout } from '../core/bohr';
import type { ElementData } from '../types';
import { svg } from './dom';

export function renderBohr(el: ElementData, className = 'bohr'): SVGSVGElement {
  const layout = bohrLayout(el.shells);
  const root = svg('svg', {
    viewBox: '0 0 100 100',
    class: className,
    role: 'img',
    'aria-label': `電子殻：${el.shells.join('-')}`,
  });
  layout.rings.forEach((ring, i) => {
    // 殻の円と電子をひとまとめにして、殻ごとに回転させる（CSS のアニメーション）
    const g = svg('g', { class: `bohr-ring ${i % 2 === 0 ? 'cw' : 'ccw'}`, style: `animation-duration:${18 + i * 7}s` });
    g.appendChild(svg('circle', { cx: 50, cy: 50, r: ring.r, class: 'bohr-orbit' }));
    for (const p of ring.electrons) g.appendChild(svg('circle', { cx: p.x, cy: p.y, r: layout.dotR, class: 'bohr-electron' }));
    root.appendChild(g);
  });
  root.appendChild(svg('circle', { cx: 50, cy: 50, r: layout.nucleusR, class: 'bohr-nucleus' }));
  return root;
}
