import * as store from './store.js';
import { stop as stopTTS } from './tts.js';
import home from './screens/home.js';
import vocab from './screens/vocab.js';
import grammar from './screens/grammar.js';
import placement from './screens/placement.js';
import mic from './screens/mic.js';
import settings from './screens/settings.js';

const routes = { home, vocab, grammar, placement, mic, settings };
const LEARNING = new Set(['vocab', 'grammar', 'placement', 'mic']);
const root = document.getElementById('app');
let cleanup = null, current = 'home', token = 0;

async function render() {
  const [name = '', ...args] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  current = routes[name] ? name : 'home';
  if (cleanup) { try { cleanup(); } catch { /* bỏ qua */ } cleanup = null; }
  stopTTS();
  const my = ++token;
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.r === current));
  // Mỗi màn dựng vào một khung riêng, xong mới gắn vào trang, để màn cũ tải chậm không đè màn mới
  const view = document.createElement('div');
  try {
    const c = await routes[current](view, args);
    if (my !== token) { c?.(); return; }
    cleanup = c || null;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h3>Không tải được trang</h3><p class="muted small">${e.message}</p></div>`;
  }
  if (my !== token) return;
  root.replaceChildren(view);
  window.scrollTo(0, 0);
}

addEventListener('hashchange', render);

// Đếm phút học: chỉ tính khi đang ở màn học, trang đang mở và có thao tác trong 2 phút gần nhất
let lastAct = Date.now();
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
setInterval(() => {
  if (document.visibilityState === 'visible' && LEARNING.has(current) && Date.now() - lastAct < 120000) store.addMinutes(0.5);
}, 30000);

const syncEl = document.getElementById('sync');
const LABEL = { ok: 'Đã đồng bộ', off: 'Chưa nối máy chủ', err: 'Mất kết nối, sẽ gửi lại', busy: 'Đang gửi…' };
store.onStatus(s => { syncEl.dataset.s = s; syncEl.textContent = LABEL[s]; });

render();
store.pullState().then(changed => { if (changed) render(); store.flush(); });
