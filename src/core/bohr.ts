// ボーア模型風の電子殻の図の配置を計算する（描画は ui/bohr.ts）
// 図の大きさは 0〜100 の正方形として計算する。

export interface BohrRing {
  /** 殻の円の半径 */
  r: number;
  /** その殻の電子の位置 */
  electrons: { x: number; y: number }[];
}

export interface BohrLayout {
  /** 原子核の半径 */
  nucleusR: number;
  rings: BohrRing[];
  /** 電子の点の半径（電子が多いほど小さくする） */
  dotR: number;
}

const CENTER = 50;
const INNER = 15;
const OUTER = 46;

export function bohrLayout(shells: readonly number[]): BohrLayout {
  const n = shells.length;
  const step = n > 1 ? (OUTER - INNER) / (n - 1) : 0;
  const rings: BohrRing[] = shells.map((count, i) => {
    const r = n === 1 ? 26 : INNER + step * i;
    // 殻ごとに少しずつ回転をずらし、電子が一直線に並ばないようにする
    const offset = -Math.PI / 2 + i * 0.35;
    const electrons = Array.from({ length: count }, (_, k) => {
      const a = offset + (2 * Math.PI * k) / count;
      return { x: round(CENTER + r * Math.cos(a)), y: round(CENTER + r * Math.sin(a)) };
    });
    return { r: round(r), electrons };
  });
  // 一番混み合う殻でも点が重ならない大きさにする
  let dotR = 2.6;
  for (const ring of rings) {
    const count = ring.electrons.length;
    if (count > 1) dotR = Math.min(dotR, ((2 * Math.PI * ring.r) / count) * 0.32);
  }
  return { nucleusR: n === 1 ? 9 : 8, rings, dotR: round(Math.max(dotR, 0.9)) };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
