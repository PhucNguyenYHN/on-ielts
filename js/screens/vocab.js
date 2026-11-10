import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { esc, bi, shuffle, today, loadContent } from '../util.js';
import { review, dueIds, learnedCount } from '../srs.js';
import { newWordsLeft } from '../engine.js';
import { say, bindSay } from '../tts.js';
import { runQuiz } from '../quiz.js';
import { resultCard, spellingDiff } from '../coach.js';
import { confetti } from '../fx.js';
import { sttSupport, sttError, listen, compare } from '../speech.js';
import { recordPron } from './speak.js';

// Nút đọc thử trên thẻ: máy nghe rồi báo đã nhận ra từ chưa. Không bắt buộc, không tính vào điểm nhớ từ.
const recBtn = () => sttSupport() ? '<button class="say rec" data-rec>🎙 Đọc thử</button>' : '';
function bindRec(view, v) {
  const btn = view.querySelector('[data-rec]'), out = view.querySelector('[data-recres]');
  if (!btn) return;
  let sess = null, timer = 0;
  const finish = async () => {
    if (!sess) return;
    const s = sess; sess = null; clearTimeout(timer);
    btn.disabled = true; btn.textContent = '…';
    const { text, error } = await s.stop();
    btn.disabled = false; btn.textContent = '🎙 Đọc lại';
    if (!text) { out.innerHTML = `<span class="muted">${esc(sttError(error || 'no-speech'))}</span>`; return; }
    const c = compare(v.w, text), ok = c.score === 1;
    recordPron(c); // từ đọc sai nhiều lần sẽ vào mục Từ hay đọc sai bên Luyện nói
    store.logAttempt({ item: `PW-${v.w}`, skill: 'S', type: 'S-word', correct: ok, detail: ok ? '' : `nghe thành: ${text}` });
    out.innerHTML = ok
      ? `<span class="good-t">✓ Rõ rồi, máy nghe đúng "${esc(v.w)}".</span>`
      : `<span class="bad-t">Máy nghe thành: <i>${esc(text)}</i>.</span> <span class="muted">Bấm 🔊 nghe lại, nhìn phiên âm${v.i ? ` /${esc(v.i.split(' · ')[0].replace(/\s*\(.*\)$/, ''))}/` : ''}, chú ý chỗ nhấn ˈ và âm cuối, rồi đọc chậm, rõ.</span>`;
    if (ok) confetti(20);
  };
  btn.onclick = () => {
    if (sess) return finish();
    out.innerHTML = '<span class="muted">Đang nghe… đọc từ này một lần.</span>';
    btn.textContent = '■ Xong';
    sess = listen({
      lang: 'en-US',
      onText: t => { if (compare(v.w, t).score === 1) { clearTimeout(timer); timer = setTimeout(finish, 400); } },
      onError: e => { out.innerHTML = `<span class="muted">${esc(sttError(e))}</span>`; },
    });
    timer = setTimeout(finish, 5000);
  };
}

// Phiên âm giọng Anh: "ɪnˈkriːs (v) · ˈɪŋkriːs (n)" → /ɪnˈkriːs/ (v) · /ˈɪŋkriːs/ (n)
const ipa = v => !v.i ? '' : v.i.split(' · ').map(x => { const m = x.match(/^(.*?)(?:\s+\((.+)\))?$/); return `/${esc(m[1])}/${m[2] ? ` <small>(${esc(m[2])})</small>` : ''}`; }).join(' · ');


// Cách nhớ tự động từ tiền tố, hậu tố khi từ chưa có mẹo soạn sẵn
const AFFIX = [[/^un/, 'un- = không'], [/^dis/, 'dis- = không, ngược lại'], [/^re/, 're- = lại, lần nữa'], [/^in(?=[^aeiou])|^im/, 'in-/im- = không hoặc vào trong'], [/^pre/, 'pre- = trước'], [/^over/, 'over- = quá mức'], [/^under/, 'under- = dưới, chưa đủ'], [/^de/, 'de- = xuống, bỏ đi'],
  [/tion$|sion$/, '-tion/-sion: đuôi danh từ'], [/ment$/, '-ment: đuôi danh từ'], [/ness$/, '-ness: đuôi danh từ chỉ tính chất'], [/ity$/, '-ity: đuôi danh từ'], [/ful$/, '-ful = đầy, có nhiều'], [/less$/, '-less = không có'], [/able$|ible$/, '-able/-ible = có thể'], [/ly$/, '-ly: đuôi trạng từ'], [/ist$/, '-ist: người làm nghề'], [/ee$/, '-ee: người được nhận'], [/(er|or)$/, '-er/-or: người hoặc vật làm việc gì']];
function autoTip(v) {
  const w = v.w.toLowerCase();
  if (w.includes(' ')) return 'Học cả cụm, đừng tách từng chữ. Đặt một câu về chính em với cụm này.';
  const hits = AFFIX.filter(([re]) => re.test(w)).map(([, t]) => t).slice(0, 2);
  return (hits.length ? 'Phân tích từ: ' + hits.join('; ') + '. ' : '') + 'Đọc to câu ví dụ hai lần rồi tự đặt một câu về ngành Dược hoặc cuộc sống của em.';
}

export default async function vocabScreen(view, [mode]) {
  const vocab = await loadContent('vocab');
  if (mode === 'learn') return learn(view, vocab);
  if (mode === 'review') return cards(view, vocab);
  if (mode === 'dictation') return dictation(view, vocab);
  if (mode === 'list') return list(view, vocab);
  menu(view, vocab);
}

function menu(view, vocab) {
  const s = store.get();
  const due = dueIds(s.srs).length;
  const fresh = Math.min(newWordsLeft(s, CONFIG.newWordsPerDay), vocab.filter(v => !s.srs[v.w]).length);
  view.innerHTML = `
    <h1>${bi('Từ vựng', 'Vocabulary')}</h1>
    <div class="stats">
      <div class="stat"><b>${learnedCount(s.srs)}</b><span>đã thuộc</span></div>
      <div class="stat"><b>${due}</b><span>đến hạn ôn</span></div>
      <div class="stat"><b>${vocab.length}</b><span>tổng số từ</span></div>
    </div>
    <a class="card" href="#/vocab/learn"><h3>1. Học từ mới <span class="badge">${fresh ? fresh + ' từ' : 'Xong ✓'}</span></h3>
      <div class="meta">Xem từ kèm nghĩa và cách nhớ, rồi luyện chọn nghĩa và viết lại từ.</div></a>
    <a class="card" href="#/vocab/review"><h3>2. Ôn thẻ đến hạn <span class="badge">${due} thẻ</span></h3>
      <div class="meta">Lật thẻ nhớ lại nghĩa, tự chấm Quên, Khó hoặc Nhớ.</div></a>
    <a class="card" href="#/vocab/dictation"><h3>3. Nghe và gõ chính tả</h3>
      <div class="meta">Nghe 10 từ em đã ôn ít nhất hai lần rồi gõ lại. ${CONFIG.ielts ? 'Dùng để sửa lỗi chính tả và thiếu "s" khi làm Listening.' : 'Luyện tai nhận ra từ đã học khi nghe.'}</div></a>
    <a class="card" href="#/vocab/list"><h3>Danh sách từ theo chủ đề</h3>
      <div class="meta">Xem nghĩa và nghe phát âm giọng Anh hoặc Mỹ.</div></a>`;
}

function cards(view, vocab) {
  const byW = Object.fromEntries(vocab.map(v => [v.w, v]));
  const s0 = store.get();
  const due = shuffle(dueIds(s0.srs).filter(w => byW[w])).slice(0, 40);
  const q = [...due];
  const requeued = new Set();
  let remembered = 0, reviewed = 0;
  const accent = () => store.get().prefs.accent;

  if (!q.length) {
    view.innerHTML = `<h1>${bi('Ôn thẻ', 'Review')}</h1>
      <div class="card"><h3>Không còn thẻ đến hạn 🎉</h3><p class="meta">Thẻ đã học sẽ quay lại đúng ngày cần ôn.</p>
      <a class="btn" href="#/vocab/learn">Học từ mới</a><a class="btn ghost" href="#/vocab/dictation">Nghe và gõ chính tả</a></div>`;
    return;
  }

  function show() {
    if (!q.length) return finish();
    const w = q[0], v = byW[w];
    const isNew = !store.get().srs[w];
    view.innerHTML = `
      <div class="qhead muted small">Còn ${q.length} thẻ ${isNew ? '<span class="badge">Từ mới</span>' : ''}</div>
      <div class="card flash">
        <div class="word">${esc(v.w)}</div>${v.i ? `<div class="ipa">${ipa(v)}</div>` : ''}
        <div class="pos">${esc(v.p)} · ${esc(v.t)}${v.cefr ? ` · <span class="badge">${esc(v.cefr)}</span>` : ""}</div>
        <div class="row" style="justify-content:center;margin-top:8px">
          <button class="say" data-say="${esc(v.w)}" data-lang="en-GB">🔊 UK</button>
          <button class="say" data-say="${esc(v.w)}" data-lang="en-US">🔊 US</button>
          ${recBtn()}
        </div><div class="rec-res" data-recres></div>
        <div class="back" hidden>
          <div class="vn">${esc(v.vn)}</div>
          <p>${esc(v.ex)} <button class="say" data-say="${esc(v.ex)}" data-lang="${accent()}">🔊</button></p>
          <div class="memo"><b>💡 Cách nhớ</b><div>${esc(v.m || autoTip(v))}</div></div>
        </div>
      </div>
      <button class="btn block" data-flip>Lật thẻ · Show meaning</button>
      <div class="grades" hidden>
        <button class="btn danger" data-g="0">😵 Quên</button>
        <button class="btn ghost" data-g="1">🤔 Khó</button>
        <button class="btn" data-g="2">😎 Nhớ</button>
      </div>
      <p class="muted small" style="text-align:center">${remembered ? `Đã nhớ ${remembered} thẻ trong buổi này` : 'Lật thẻ, tự chấm thật lòng để app nhắc đúng lúc'}</p>`;
    bindSay(view);
    bindRec(view, v);
    say(v.w, { lang: accent() });
    view.querySelector('[data-flip]').onclick = e => {
      e.target.hidden = true;
      view.querySelector('.back').hidden = false;
      view.querySelector('.grades').hidden = false;
    };
    view.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => grade(w, +b.dataset.g, isNew); });
  }

  function grade(w, g, isNew) {
    store.update(s => {
      s.srs[w] = review(s.srs[w], g);
      if (isNew) {
        if (s.newToday.date !== today()) s.newToday = { date: today(), n: 0 };
        s.newToday.n++;
      }
    });
    store.logAttempt({ item: w, skill: 'V', type: 'V-recall', correct: g > 0 });
    reviewed++;
    if (g > 0) remembered++;
    q.shift();
    if (g === 0 && !requeued.has(w)) { requeued.add(w); q.push(w); } // quên thì gặp lại một lần cuối buổi
    show();
  }

  function finish() {
    const pct = reviewed ? Math.round((remembered / reviewed) * 100) : 0;
    const r = resultCard(pct, `<p class="meta">Nhớ ${remembered}/${reviewed} lượt. Thẻ chấm Quên hoặc Khó sẽ quay lại sớm hơn, mai mở app để ôn đúng hạn.</p>
      <div class="row" style="justify-content:center;margin-top:10px"><a class="btn" href="#/vocab/dictation">Nghe và gõ chính tả</a><a class="btn ghost" href="#/">Về Hôm nay</a></div>`);
    view.innerHTML = `<h1>${bi('Xong buổi ôn', 'Done')}</h1>${r.html}`;
    confetti(r.party ? 100 : 40);
  }

  show();
}

// Thứ tự học theo hồ sơ: chủ đề ưu tiên trước, chủ đề luyện thi IELTS để sau cùng
function plan(vocab) {
  const focus = CONFIG.focusTopics || [], later = new Set(CONFIG.laterTopics || []);
  if (!focus.length && !later.size) return vocab;
  const first = focus.flatMap(t => vocab.filter(v => v.t === t)); // theo thứ tự chủ đề ưu tiên
  const mid = vocab.filter(v => !focus.includes(v.t) && !later.has(v.t) && v.lv <= 2);
  const used = new Set([...first, ...mid]);
  return [...first, ...mid, ...vocab.filter(v => !used.has(v))];
}

// Học từ mới theo 3 bước: xem (từ + nghĩa + cách nhớ) → chọn nghĩa → viết lại từ từ nghĩa.
// Xong mới đưa vào lịch ôn: đúng cả hai bước = Nhớ, đúng một = Khó, sai cả hai = Quên (gặp lại sớm).
function learn(view, vocab) {
  const s0 = store.get();
  const accent = () => store.get().prefs.accent;
  const words = plan(vocab).filter(v => !s0.srs[v.w]).slice(0, newWordsLeft(s0, CONFIG.newWordsPerDay));
  if (!words.length) {
    view.innerHTML = `<h1>${bi('Học từ mới', 'New words')}</h1><div class="card result-big"><h3>Hôm nay đã học đủ ${CONFIG.newWordsPerDay} từ mới 🎉</h3>
      <p class="meta">Mai quay lại học tiếp nhé. Giờ có thể ôn thẻ đến hạn.</p><a class="btn" href="#/vocab/review">Ôn thẻ</a></div>`;
    return;
  }
  const score = Object.fromEntries(words.map(v => [v.w, 0]));
  let i = 0;

  // Bước 1: xem từng từ, nghĩa hiện sẵn
  function study() {
    const v = words[i];
    view.innerHTML = `<div class="row" style="justify-content:space-between"><div class="qhead muted small">Bước 1/3 · Xem từ mới · ${i + 1}/${words.length}</div><span class="badge">Từ mới</span></div>
      <div class="bar"><i style="width:${(i / words.length) * 100}%"></i></div>
      <div class="card flash">
        <div class="word">${esc(v.w)}</div>${v.i ? `<div class="ipa">${ipa(v)}</div>` : ''}
        <div class="pos">${esc(v.p)} · ${esc(v.t)}${v.cefr ? ` · <span class="badge">${esc(v.cefr)}</span>` : ''}</div>
        <div class="row" style="justify-content:center;margin-top:8px">
          <button class="say" data-say="${esc(v.w)}" data-lang="en-GB">🔊 UK</button><button class="say" data-say="${esc(v.w)}" data-lang="en-US">🔊 US</button>${recBtn()}</div><div class="rec-res" data-recres></div>
        <div class="back" hidden><div class="vn">${esc(v.vn)}</div>
          <p>${esc(v.ex)} <button class="say" data-say="${esc(v.ex)}" data-lang="${accent()}">🔊</button></p>
          <div class="memo"><b>💡 Cách nhớ</b><div>${esc(v.m || autoTip(v))}</div></div></div>
      </div>
      <button class="btn block" data-show>Đoán nghĩa trong đầu rồi bấm để xem · Show meaning</button>
      <div class="row" data-nav hidden>${i ? '<button class="btn ghost" data-prev>← Từ trước</button>' : ''}<button class="btn" data-next style="flex:1">${i + 1 < words.length ? 'Từ tiếp theo →' : 'Xong, sang luyện tập →'}</button></div>
      <p class="muted small" style="text-align:center">Thử đoán nghĩa trước khi lật. Sau đó đọc to từ, câu ví dụ và nhìn kỹ cách nhớ.</p>`;
    bindSay(view);
    bindRec(view, v);
    say(v.w, { lang: accent() });
    view.querySelector('[data-show]').onclick = e => {
      e.target.hidden = true;
      view.querySelector('.back').hidden = false;
      view.querySelector('[data-nav]').hidden = false;
    };
    view.querySelector('[data-next]').onclick = () => { i++; if (i < words.length) study(); else interlude('Bước 2/3 · Chọn nghĩa', 'Nhìn từ tiếng Anh và chọn nghĩa đúng. Sai thì app chỉ cách nhớ.', quizMeaning); };
    view.querySelector('[data-prev]')?.addEventListener('click', () => { i--; study(); });
  }

  // Bước 2: nhìn từ, chọn nghĩa đúng
  function quizMeaning() {
    const items = shuffle(words).map(v => {
      const pool = vocab.filter(x => x.w !== v.w && x.vn !== v.vn);
      const same = shuffle(pool.filter(x => x.t === v.t)).slice(0, 3);
      const others = same.length === 3 ? same : [...same, ...shuffle(pool).slice(0, 3 - same.length)];
      const options = shuffle([v.vn, ...others.map(x => x.vn)]);
      return { w: v.w, q: v.w, type: 'mcq', options, answer: options.indexOf(v.vn), say: v.w, explain: v.m || v.ex, tag: 'V-recall' };
    });
    runQuiz(view, items, {
      title: 'Bước 2/3 · Chọn nghĩa', lang: accent(),
      onAnswer: r => { if (r.correct) score[r.item.w]++; store.logAttempt({ item: r.item.w, skill: 'V', type: 'V-meaning', correct: r.correct, ms: r.ms }); },
      onDone: () => interlude('Bước 3/3 · Viết lại từ', 'Nhìn nghĩa tiếng Việt và viết lại từ tiếng Anh. Có gợi ý chữ cái đầu và số ký tự.', quizWrite),
    });
  }

  // Bước 3: nhìn nghĩa, viết lại từ tiếng Anh
  function quizWrite() {
    const items = shuffle(words).map(v => ({
      w: v.w, q: v.vn, lead: `${v.p} · gợi ý: bắt đầu bằng "${v.w[0]}", ${v.w.length} ký tự`,
      type: 'text', answer: [v.w], ph: 'Gõ từ tiếng Anh', explain: v.ex, tag: 'L-spelling',
    }));
    runQuiz(view, items, {
      title: 'Bước 3/3 · Viết từ', lang: accent(),
      onAnswer: r => { if (r.correct) score[r.item.w]++; store.logAttempt({ item: r.item.w, skill: 'V', type: 'V-spelling', correct: r.correct, ms: r.ms, detail: r.correct ? '' : String(r.given) }); },
      onDone: finish,
    });
  }

  function interlude(title, text, next) {
    view.innerHTML = `<div class="card result-big"><h3>${title}</h3><p class="meta">${text}</p><button class="btn" data-go>Bắt đầu</button></div>`;
    view.querySelector('[data-go]').onclick = next;
  }

  function finish() {
    store.update(s => {
      if (s.newToday.date !== today()) s.newToday = { date: today(), n: 0 };
      words.forEach(v => { s.srs[v.w] = review(s.srs[v.w], score[v.w] >= 2 ? 2 : score[v.w] === 1 ? 1 : 0); s.newToday.n++; });
    });
    const total = words.length * 2, ok = Object.values(score).reduce((a, b) => a + b, 0);
    const pct = Math.round((ok / total) * 100);
    const weak = words.filter(v => score[v.w] < 2);
    const r = resultCard(pct, `<p class="meta">Em vừa học ${words.length} từ mới. Từ nào còn sai sẽ quay lại sớm trong phần Ôn thẻ.</p>
      <div class="row" style="justify-content:center;margin-top:10px"><a class="btn" href="#/vocab/review">Ôn thẻ đến hạn</a><a class="btn ghost" href="#/">Về Hôm nay</a></div>`);
    view.innerHTML = `<h1>${bi('Xong buổi học từ mới', 'Well done')}</h1>${r.html}
      ${weak.length ? `<h2>${bi('Từ cần nhớ thêm', 'Words to revisit')}</h2><div class="card">${weak.map(v => `<div class="review-item"><b>${esc(v.w)}</b> <span class="muted small">${esc(v.p)}</span> · ${esc(v.vn)} <button class="say" data-say="${esc(v.w)}" data-lang="${accent()}">🔊</button>
        <div class="memo"><b>💡 Cách nhớ</b><div>${esc(v.m || autoTip(v))}</div></div></div>`).join('')}</div>` : ''}`;
    bindSay(view);
    confetti(r.party ? 110 : 50);
  }

  study();
}

function dictation(view, vocab) {
  const s = store.get();
  // Chỉ lấy từ đã ôn ít nhất 2 lần, để em đã nhớ nghĩa trước khi phải nghe và viết
  const known = vocab.filter(v => s.srs[v.w]?.reps >= 2);
  if (known.length < 5) {
    view.innerHTML = `<h1>${bi('Nghe – gõ', 'Dictation')}</h1><div class="card"><h3>Chưa đủ từ để nghe–gõ</h3>
      <p class="meta">Phần này chỉ dùng những từ em đã ôn ít nhất hai lần (hiện có ${known.length} từ, cần 5). Học từ mới và ôn thẻ vài ngày là mở được.</p>
      <a class="btn" href="#/vocab/learn">Học từ mới</a><a class="btn ghost" href="#/vocab/review">Ôn thẻ</a></div>`;
    return;
  }
  const pool = known;
  const items = shuffle(pool).slice(0, 10).map(v => ({
    q: 'Nghe và gõ lại từ',
    type: 'text', answer: [v.w], say: v.w, ph: 'Gõ từ bạn nghe được',
    explain: `${v.w} (${v.p}): ${v.vn}`,
  }));
  runQuiz(view, items, {
    title: 'Nghe – gõ', lang: s.prefs.accent,
    onAnswer: r => store.logAttempt({ item: r.item.answer[0], skill: 'L', type: 'L-spelling', correct: r.correct, ms: r.ms, detail: r.correct ? '' : r.given }),
    onDone: res => {
      const wrong = res.filter(r => !r.correct);
      const pct = Math.round(((res.length - wrong.length) / res.length) * 100);
      const r = resultCard(pct, `<div class="row" style="justify-content:center;margin-top:10px"><a class="btn" href="#/vocab/dictation" data-again>Làm lượt khác</a><a class="btn ghost" href="#/">Về Hôm nay</a></div>`);
      view.innerHTML = `<h1>${bi('Kết quả nghe – gõ', 'Dictation result')}</h1>${r.html}
        ${wrong.length ? `<h2>${bi('Sửa các từ gõ sai', 'Fix your spelling')}</h2><div class="card">${wrong.map(x => `<div class="review-item"><b>${esc(x.item.answer[0])}</b> <span class="muted small">${esc(x.item.explain)}</span>${spellingDiff(x.given, x.item.answer[0])}</div>`).join('')}</div>` : ''}`;
      if (r.party) confetti();
      view.querySelector('[data-again]').onclick = e => { e.preventDefault(); dictation(view, vocab); };
    },
  });
}

// Danh sách theo chủ đề, mỗi chủ đề thu gọn; có ô tìm từ hoặc nghĩa
function list(view, vocab) {
  const s = store.get();
  const topics = [...new Set(vocab.map(v => v.t))];
  const known = v => s.srs[v.w]?.ivl >= 1;
  const row = v => `<div class="ex"><div class="row" style="justify-content:space-between">
      <span><b>${esc(v.w)}</b> ${v.i ? `<span class="ipa-s">${ipa(v)}</span>` : ''} <span class="muted small">${esc(v.p)}${v.cefr ? ` · ${esc(v.cefr)}` : ""}</span> ${known(v) ? '<span class="badge done">đã thuộc</span>' : ''}</span>
      <span><button class="say" data-say="${esc(v.w)}" data-lang="en-GB">UK</button> <button class="say" data-say="${esc(v.w)}" data-lang="en-US">US</button></span></div>
      <div>${esc(v.vn)}</div><div class="muted small">${esc(v.ex)}</div></div>`;
  view.innerHTML = `<h1>${bi('Danh sách từ', 'Word list')}</h1>
    <input class="inp" data-q placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt…" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div data-res></div>
    <div data-topics>${topics.map(t => {
      const items = vocab.filter(v => v.t === t);
      return `<details class="card" data-t="${esc(t)}"><summary><b>${esc(t)}</b> <span class="muted small">${items.filter(known).length}/${items.length} đã thuộc</span></summary><div data-body></div></details>`;
    }).join('')}</div>`;
  // Chỉ dựng danh sách từ khi mở chủ đề, để trang nhẹ trên điện thoại
  view.querySelectorAll('details[data-t]').forEach(d => d.addEventListener('toggle', () => {
    const body = d.querySelector('[data-body]');
    if (d.open && !body.childElementCount) { body.innerHTML = vocab.filter(v => v.t === d.dataset.t).map(row).join(''); bindSay(body); }
  }));
  const res = view.querySelector('[data-res]'), tops = view.querySelector('[data-topics]');
  view.querySelector('[data-q]').oninput = e => {
    const q = e.target.value.trim().toLowerCase();
    tops.hidden = !!q;
    if (!q) { res.innerHTML = ''; return; }
    const hits = vocab.filter(v => v.w.toLowerCase().includes(q) || v.vn.toLowerCase().includes(q)).slice(0, 50);
    res.innerHTML = hits.length ? `<div class="card">${hits.map(row).join('')}</div>` : '<p class="muted">Không tìm thấy.</p>';
    bindSay(res);
  };
}
