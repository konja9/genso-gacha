// 電子殻の図の配置
import { describe, expect, it } from 'vitest';
import { bohrLayout } from '../src/core/bohr';
import { ELEMENTS } from '../src/data/elements';

describe('ボーア模型の配置', () => {
  it('全元素で、描く電子の数が原子番号と一致し、殻の数も電子殻の数と一致する', () => {
    for (const e of ELEMENTS) {
      const layout = bohrLayout(e.shells);
      expect(layout.rings).toHaveLength(e.shells.length);
      expect(layout.rings.reduce((a, r) => a + r.electrons.length, 0)).toBe(e.number);
    }
  });

  it('外側の殻ほど半径が大きく、図の枠（0〜100）からはみ出さない', () => {
    for (const e of ELEMENTS) {
      const { rings, dotR } = bohrLayout(e.shells);
      for (let i = 1; i < rings.length; i++) expect(rings[i].r).toBeGreaterThan(rings[i - 1].r);
      for (const r of rings)
        for (const p of r.electrons) {
          expect(p.x - dotR).toBeGreaterThanOrEqual(0);
          expect(p.x + dotR).toBeLessThanOrEqual(100);
          expect(p.y - dotR).toBeGreaterThanOrEqual(0);
          expect(p.y + dotR).toBeLessThanOrEqual(100);
        }
    }
  });

  it('電子の点どうしが重ならない', () => {
    for (const e of ELEMENTS) {
      const { rings, dotR } = bohrLayout(e.shells);
      for (const r of rings) {
        if (r.electrons.length < 2) continue;
        const [a, b] = r.electrons;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(dotR * 2);
      }
    }
  });
});
