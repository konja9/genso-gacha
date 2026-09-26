/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages では https://<ユーザー名>.github.io/genso-gacha/ で公開されるため、
// すべてのファイルの置き場所の先頭に /genso-gacha/ を付ける。
// リポジトリ名を変えた場合はここも同じ名前に変えること。
const BASE = '/genso-gacha/';

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      // 新しい版を公開したら、次に開いたときに自動で入れ替える
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '元素ガチャ',
        short_name: '元素ガチャ',
        description: '元素118種をカードで集めながら、間隔反復で覚える学習ゲーム',
        lang: 'ja',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1222',
        theme_color: '#0f1222',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // オフラインでも動くように、アプリの全ファイルを端末に保存しておく
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
