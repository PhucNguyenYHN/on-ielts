import * as store from './store.js';
import { stop as stopTTS } from './tts.js';
import home from './screens/home.js';
import vocab from './screens/vocab.js';
import grammar from './screens/grammar.js';
import placement from './screens/placement.js';
import mic from './screens/mic.js';
import settings from './screens/settings.js';
import speak from './screens/speak.js';
import writing from './screens/writing.js';
import listen from './screens/listen.js';
import exam from './screens/exam.js';

import { icon } from './icons.js';
import { CONFIG } from './config.js';
import { xung } from './util.js';
import { unlock } from './lock.js';

// Tên hồ sơ trên thanh đầu, để biết đang học bằng tài khoản nào
import('./audio.js').then(m => m.mountAudio(document.querySelector('header.top')));
document.querySelector('.brand').insertAdjacentHTML('beforeend', ` <span class="badge">${CONFIG.learner}</span>`);

const routes = { home, vocab, grammar, placement, mic, settings, speak, writing, listen, exam };

// Thanh tab dưới: biểu tượng + nhãn
const TAB = { home: ['#/', 'home', 'Hôm nay'], vocab: ['#/vocab', 'cards', 'Từ vựng'], grammar: ['#/grammar', 'grammar', 'Ngữ pháp'], listen: ['#/listen', 'headphones', 'Nghe'], speak: ['#/speak', 'mic', 'Luyện nói'], settings: ['#/settings', 'gear', 'Cài đặt'] };
const TABS = CONFIG.tabs.map(r => [r, ...TAB[r]]);
document.getElementById('tabs').innerHTML = TABS.map(([r, href, ic, label]) => `<a href="${href}" data-r="${r}">${icon(ic)}<span>${label}</span></a>`).join('');
const LEARNING = new Set(['vocab', 'grammar', 'placement', 'mic', 'speak', 'listen', 'exam']);
const root = document.getElementById('app');
let cleanup = null, current = 'home', token = 0;

async function render() {
  const [name = '', ...args] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  current = routes[name] ? name : 'home';
  if (cleanup) { try { cleanup(); } catch { /* bỏ qua */ } cleanup = null; }
  stopTTS();
  const my = ++token;
  const tabOf = { placement: 'home', mic: 'settings', writing: 'home', exam: 'home', grammar: CONFIG.tabs.includes('grammar') ? 'grammar' : 'home' };
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.r === (tabOf[current] || current)));
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

// Tài khoản không xưng "em" (Phúc): đổi mọi chữ "em" trên màn hình thành cách xưng của tài khoản.
// Màn nào cũng dựng lại nội dung liên tục, nên theo dõi thay đổi thay vì sửa từng chuỗi.
if (CONFIG.xung !== 'em') {
  const fix = n => {
    if (n.nodeType === 3) { const t = xung(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; return; }
    if (n.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(n.nodeName)) return;
    if (n.placeholder) n.placeholder = xung(n.placeholder);
    n.childNodes.forEach(fix);
  };
  new MutationObserver(ms => ms.forEach(m => m.type === 'characterData' ? fix(m.target) : m.addedNodes.forEach(fix)))
    .observe(root, { childList: true, subtree: true, characterData: true });
}
addEventListener('hashchange', () => { if (!root.querySelector('.lock')) render(); });

// Đếm phút học: chỉ tính khi đang ở màn học, trang đang mở và có thao tác trong 2 phút gần nhất
let lastAct = Date.now();
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
setInterval(() => {
  if (document.visibilityState === 'visible' && LEARNING.has(current) && Date.now() - lastAct < 120000) store.addMinutes(0.5);
}, 30000);

const syncEl = document.getElementById('sync');
const LABEL = { ok: 'Đã đồng bộ', off: 'Chưa nối máy chủ', err: 'Mất kết nối, sẽ gửi lại', busy: 'Đang gửi…' };
store.onStatus(s => { syncEl.dataset.s = s; syncEl.textContent = LABEL[s]; });

// Tài khoản có mã PIN: mở khóa xong mới vào app và đồng bộ
unlock(root).then(() => {
  render();
  store.pullState().then(changed => { if (changed) render(); store.flush(); });
  // Tải điểm Writing mới; có bài mới chấm thì vẽ lại màn Hôm nay để hiện thẻ báo
  const before = store.unseenGraded().length;
  store.fetchWritings().then(list => {
    if (current === 'home' && store.unseenGraded(list).length !== before) render();
  }).catch(() => {});
});
