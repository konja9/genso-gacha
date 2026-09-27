// データ検証スクリプト。`npm run validate` で実行する。
// data/elements.json と data/rarity.json を読み込み、誤りがあれば一覧で表示する。
import { readFileSync } from 'node:fs';
import { validateElements } from '../src/core/validate';

const elements = JSON.parse(readFileSync(new URL('../data/elements.json', import.meta.url), 'utf8'));
const rarity = JSON.parse(readFileSync(new URL('../data/rarity.json', import.meta.url), 'utf8'));

const errors = validateElements(elements, rarity);

if (errors.length > 0) {
  console.error(`✗ データに ${errors.length} 件の問題があります：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// 問題がなければ、分類ごと・レア度ごとの件数を表示する
const byCategory = new Map<string, number>();
for (const e of elements as { category: string }[]) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);

console.log('✓ データに問題はありません');
console.log(`  元素：${elements.length}件（原子番号・記号の重複なし、電子殻の合計＝原子番号）`);
console.log(`  分類：${[...byCategory].map(([k, v]) => `${k} ${v}`).join(' / ')}`);
console.log(`  レア度：N ${rarity.N.length} / R ${rarity.R.length} / SR ${rarity.SR.length} / SSR ${rarity.SSR.length}`);
