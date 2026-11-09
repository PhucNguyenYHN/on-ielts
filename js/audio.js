// Nút 🔊 trên thanh đầu trang: chỉnh âm lượng và tốc độ giọng đọc, có nút nghe thử.
import { audioPrefs, setAudioPrefs, say, stop } from './tts.js';

const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function mountAudio(header) {
  const wrap = document.createElement('span');
  wrap.className = 'audio-wrap';
  wrap.innerHTML = `<button class="audio-btn" aria-label="Âm lượng và tốc độ" aria-expanded="false">🔊</button>
    <div class="audio-pop" hidden>
      <label>Âm lượng <b data-vv></b><input type="range" min="0.1" max="1" step="0.1" data-vol></label>
      <label>Tốc độ đọc <b data-sv></b><input type="range" min="0.6" max="1.3" step="0.05" data-speed></label>
      <div class="row"><button class="btn" data-test>▶ Nghe thử</button><button class="btn ghost" data-reset>Mặc định</button></div>
      ${iOS ? '<p class="small muted">Trên iPhone, Safari thường bỏ qua thanh âm lượng: chỉnh bằng nút âm lượng bên hông máy. Sau khi dùng micro (nói nhại, luyện nói), tiếng có thể nhỏ đi hoặc phát ra loa nghe gọi: tải lại trang là hết.</p>' : '<p class="small muted">Tốc độ áp dụng cho mọi giọng đọc. Nút Chậm 🐢 vẫn chậm hơn mức này.</p>'}
    </div>`;
  header.insertBefore(wrap, header.querySelector('#sync'));
  const btn = wrap.querySelector('.audio-btn'), pop = wrap.querySelector('.audio-pop');
  const vol = wrap.querySelector('[data-vol]'), speed = wrap.querySelector('[data-speed]');
  const show = () => {
    const a = audioPrefs();
    vol.value = a.vol; speed.value = a.speed;
    wrap.querySelector('[data-vv]').textContent = Math.round(a.vol * 100) + '%';
    wrap.querySelector('[data-sv]').textContent = '×' + (+a.speed).toFixed(2).replace(/0$/, '');
    btn.textContent = a.vol <= 0.3 ? '🔈' : a.vol <= 0.7 ? '🔉' : '🔊';
  };
  show();
  const open = v => { pop.hidden = !v; btn.setAttribute('aria-expanded', String(v)); };
  btn.onclick = e => { e.stopPropagation(); open(pop.hidden); };
  pop.onclick = e => e.stopPropagation();
  document.addEventListener('click', () => open(false));
  window.addEventListener('hashchange', () => open(false));
  vol.oninput = () => { setAudioPrefs({ vol: +vol.value }); show(); };
  speed.oninput = () => { setAudioPrefs({ speed: +speed.value }); show(); };
  vol.onchange = speed.onchange = () => { stop(); say('This is the new volume and speed.', { lang: 'en-GB' }); };
  wrap.querySelector('[data-test]').onclick = () => { stop(); say('Good morning, everyone, and welcome to the conference.', { lang: 'en-GB' }); };
  wrap.querySelector('[data-reset]').onclick = () => { setAudioPrefs({ vol: 1, speed: 1 }); show(); };
}
