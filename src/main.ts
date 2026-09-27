// アプリの起動
import './styles/base.css';
import './styles/card.css';
import './styles/review.css';
import './styles/gacha.css';
import './styles/fx.css';
import './styles/zukan.css';
import './styles/stats.css';
import { registerSW } from 'virtual:pwa-register';
import { startRouter } from './ui/router';

// オフラインで動くように、アプリのファイルを端末に保存する仕組み（サービスワーカー）を登録する
registerSW({ immediate: true });

const app = document.getElementById('app');
if (app) startRouter(app);
