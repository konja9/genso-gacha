// 設定画面：バックアップの書き出し・読み込み、リセット
import { today } from '../../core/date';
import { backupFileName, exportBackup, importBackup } from '../../state/backup';
import { h, replaceChildren } from '../dom';
import { go } from '../nav';
import { store } from '../store';

export function renderSettings(root: HTMLElement): void {
  const message = h('p', { class: 'settings-message', 'aria-live': 'polite' });
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void importFile(file);
    fileInput.value = '';
  });

  const data = store.get();
  replaceChildren(
    root,
    h('h1', { class: 'screen-title' }, '設定'),

    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'バックアップ'),
      h(
        'p',
        { class: 'muted' },
        '進行データはこの端末のブラウザの中に保存されています。機種変更や、ブラウザのデータ削除に備えて、ときどき書き出しておくと安心です。',
      ),
      h('button', { class: 'btn btn-sub', onclick: download }, 'バックアップを書き出す'),
      h('button', { class: 'btn btn-sub', onclick: () => fileInput.click() }, 'バックアップを読み込む'),
      fileInput,
      message,
    ),

    h(
      'section',
      { class: 'panel danger' },
      h('h2', {}, 'リセット'),
      h('p', { class: 'muted' }, 'すべてのカード・石・記録を消して、はじめからにします。元には戻せません。'),
      h('button', { class: 'btn btn-danger', onclick: reset }, 'すべてリセット'),
    ),

    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'このアプリについて'),
      h(
        'p',
        { class: 'muted' },
        `所持 ${Object.keys(data.cards).length}/118・ガチャ ${data.totalPulls}回・保存先：${store.persistent ? 'この端末のブラウザ' : '保存できない環境（閉じると消えます）'}`,
      ),
    ),
  );

  function download(): void {
    const text = exportBackup(store.get(), new Date());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = h('a', { href: url, download: backupFileName(today()) });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    show('バックアップを書き出しました。', 'ok');
  }

  async function importFile(file: File): Promise<void> {
    try {
      const next = importBackup(await file.text());
      const count = Object.keys(next.cards).length;
      if (!confirm(`バックアップ（所持 ${count} 種・石 ${next.stones}）を読み込みます。今のデータは上書きされます。よろしいですか？`)) return;
      store.set(next);
      show('バックアップを読み込みました。', 'ok');
    } catch (e) {
      show(`読み込めませんでした：${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  function reset(): void {
    if (!confirm('すべてのデータを消して、はじめからにします。よろしいですか？')) return;
    if (!confirm('本当によろしいですか？ 元には戻せません。')) return;
    store.reset();
    go('home');
  }

  function show(text: string, kind: 'ok' | 'error'): void {
    message.textContent = text;
    message.className = `settings-message ${kind}`;
  }
}
