// Chạm vào một từ trong lời thoại để xem nghĩa, phiên âm, nghe phát âm và lưu vào thẻ ôn.
// Nghĩa lấy từ bộ từ của app; từ chưa có trong bộ thì mở Google Dịch.
import * as store from './store.js';
import { esc, loadContent } from './util.js';
import { say, stop as stopTTS } from './tts.js';

let index = null;
async function dict() {
  if (index) return index;
  const vocab = await loadContent('vocab');
  index = new Map();
  vocab.forEach(v => { const k = v.w.toLowerCase(); if (!index.has(k)) index.set(k, v); });
  return index;
}

// Tìm từ trong bộ: nguyên dạng, rồi bỏ đuôi -s, -es, -ed, -ing, -ly
function find(map, w) {
  const k = w.toLowerCase().replace(/[’']s$/, '');
  const tries = [k, k.replace(/ies$/, 'y'), k.replace(/es$/, ''), k.replace(/s$/, ''), k.replace(/ied$/, 'y'), k.replace(/ed$/, ''), k.replace(/ed$/, 'e'),
    k.replace(/ing$/, ''), k.replace(/ing$/, 'e'), k.replace(/(.)\1ing$/, '$1'), k.replace(/(.)\1ed$/, '$1'), k.replace(/ly$/, '')];
  for (const t of tries) if (t.length > 1 && map.has(t)) return map.get(t);
  return null;
}

// Biến một đoạn chữ thành các từ chạm được (giữ nguyên dấu câu)
export function tappable(text) {
  return esc(text).replace(/[A-Za-z][A-Za-z’'-]*/g, m => `<span class="tw" data-tw="${m}">${m}</span>`);
}

// Gắn sự kiện chạm cho mọi .tw trong root
export async function bindTap(root, lang = 'en-GB') {
  const map = await dict();
  root.querySelectorAll('.tw').forEach(el => { if (find(map, el.dataset.tw)) el.classList.add('known'); });
  root.addEventListener('click', e => {
    const el = e.target.closest('.tw');
    if (!el) return;
    show(map, el.dataset.tw, lang);
  });
}

function show(map, raw, lang) {
  document.querySelector('.wpop')?.remove();
  const v = find(map, raw);
  const pop = document.createElement('div');
  pop.className = 'wpop';
  const inDeck = v && store.get().srs[v.w];
  pop.innerHTML = `<button class="x" aria-label="Đóng">×</button>
    <div class="w">${esc(v ? v.w : raw)} ${v?.i ? `<span class="ipa-s">/${esc(v.i.split(' · ')[0].replace(/\s*\(.*\)$/, ''))}/</span>` : ''}</div>
    ${v ? `<div class="muted small">${esc(v.p)}</div><div style="margin:6px 0;font-weight:700;color:var(--accent)">${esc(v.vn)}</div>
      ${v.ex ? `<div class="small muted">${esc(v.ex)}</div>` : ''}`
      : '<p class="small muted">Từ này chưa có trong bộ từ của app.</p>'}
    <div class="row" style="margin-top:10px">
      <button class="say" data-p>🔊 Nghe</button>
      ${v ? (inDeck ? '<span class="badge done">Đã có trong thẻ ôn</span>' : '<button class="btn" data-save style="min-height:36px;padding:6px 12px">＋ Lưu vào thẻ ôn</button>')
        : `<a class="btn ghost" style="min-height:36px;padding:6px 12px" target="_blank" rel="noopener" href="https://translate.google.com/?sl=en&tl=vi&text=${encodeURIComponent(raw)}">Tra Google Dịch</a>`}
    </div>`;
  document.body.appendChild(pop);
  pop.querySelector('.x').onclick = () => pop.remove();
  pop.querySelector('[data-p]').onclick = () => { stopTTS(); say(v ? v.w : raw, { lang, rate: 0.85 }); };
  pop.querySelector('[data-save]')?.addEventListener('click', e => {
    // Thẻ mới đến hạn ngay: sẽ hiện ở Ôn thẻ đến hạn
    store.update(s => { s.srs[v.w] ||= { ease: 2.5, ivl: 0, reps: 0, lapses: 0, due: Date.now(), last: Date.now() }; });
    e.target.outerHTML = '<span class="badge done">Đã lưu ✓ · xem ở Ôn thẻ</span>';
  });
  stopTTS(); say(v ? v.w : raw, { lang, rate: 0.85 });
  const close = ev => { if (!pop.contains(ev.target) && !ev.target.closest('.tw')) { pop.remove(); document.removeEventListener('click', close, true); } };
  setTimeout(() => document.addEventListener('click', close, true), 0);
  window.addEventListener('hashchange', () => pop.remove(), { once: true });
}
