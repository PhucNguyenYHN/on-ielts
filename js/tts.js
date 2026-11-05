// Giọng đọc của trình duyệt: dùng cho phát âm từ và bài nghe tạm thời trong đợt 1.
const ok = 'speechSynthesis' in window;
let voices = [];
function refresh() { voices = speechSynthesis.getVoices(); }
if (ok) { refresh(); speechSynthesis.addEventListener?.('voiceschanged', refresh); }

export const ttsOK = () => ok;

function pick(lang, n) {
  const want = lang.toLowerCase();
  const list = voices.filter(v => v.lang.replace('_', '-').toLowerCase() === want);
  return list.length ? list[n % list.length] : null;
}

export function say(text, { lang = 'en-GB', rate = 0.92, voice = 0, pitch = 1 } = {}) {
  return new Promise(resolve => {
    if (!ok) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = pick(lang, voice);
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = pitch;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export function stop() { if (ok) speechSynthesis.cancel(); }

// Gắn nút phát âm: <button class="say" data-say="text" data-lang="en-US">
export function bindSay(root) {
  root.querySelectorAll('[data-say]').forEach(b => {
    b.onclick = () => { stop(); say(b.dataset.say, { lang: b.dataset.lang || 'en-GB' }); };
  });
}
