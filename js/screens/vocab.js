import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { esc, bi, shuffle, today, loadContent } from '../util.js';
import { review, dueIds, learnedCount } from '../srs.js';
import { newWordsLeft } from '../engine.js';
import { say, bindSay } from '../tts.js';
import { runQuiz } from '../quiz.js';

export default async function vocabScreen(view, [mode]) {
  const vocab = await loadContent('vocab');
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
    <a class="card" href="#/vocab/review"><h3>Ôn thẻ <span class="badge">${due + fresh} thẻ</span></h3>
      <div class="meta">Thẻ đến hạn ôn trước, sau đó ${fresh} từ mới. Tự chấm: Quên, Khó hoặc Nhớ.</div></a>
    <a class="card" href="#/vocab/dictation"><h3>Nghe và gõ chính tả</h3>
      <div class="meta">Nghe 10 từ đã học rồi gõ lại. Dùng để sửa lỗi chính tả và thiếu "s" khi làm Listening.</div></a>
    <a class="card" href="#/vocab/list"><h3>Danh sách từ theo chủ đề</h3>
      <div class="meta">Xem nghĩa và nghe phát âm giọng Anh hoặc Mỹ.</div></a>`;
}

function cards(view, vocab) {
  const byW = Object.fromEntries(vocab.map(v => [v.w, v]));
  const s0 = store.get();
  const due = shuffle(dueIds(s0.srs).filter(w => byW[w])).slice(0, 40);
  const nNew = newWordsLeft(s0, CONFIG.newWordsPerDay);
  const fresh = vocab.filter(v => !s0.srs[v.w]).slice(0, nNew).map(v => v.w);
  const q = [...due, ...fresh];
  const requeued = new Set();
  let remembered = 0, reviewed = 0;
  const accent = () => store.get().prefs.accent;

  if (!q.length) {
    view.innerHTML = `<h1>${bi('Ôn thẻ', 'Review')}</h1>
      <div class="card"><h3>Hôm nay đã ôn xong</h3><p class="meta">Không còn thẻ đến hạn và đã học đủ ${CONFIG.newWordsPerDay} từ mới. Có thể luyện nghe–gõ để ôn thêm.</p>
      <a class="btn" href="#/vocab/dictation">Nghe và gõ chính tả</a></div>`;
    return;
  }

  function show() {
    if (!q.length) return finish();
    const w = q[0], v = byW[w];
    const isNew = !store.get().srs[w];
    view.innerHTML = `
      <div class="qhead muted small">Còn ${q.length} thẻ ${isNew ? '<span class="badge">Từ mới</span>' : ''}</div>
      <div class="card flash">
        <div class="word">${esc(v.w)}</div>
        <div class="pos">${esc(v.p)} · ${esc(v.t)}${v.cefr ? ` · <span class="badge">${esc(v.cefr)}</span>` : ""}</div>
        <div class="row" style="justify-content:center;margin-top:8px">
          <button class="say" data-say="${esc(v.w)}" data-lang="en-GB">🔊 UK</button>
          <button class="say" data-say="${esc(v.w)}" data-lang="en-US">🔊 US</button>
        </div>
        <div class="back" hidden>
          <div class="vn">${esc(v.vn)}</div>
          <p>${esc(v.ex)} <button class="say" data-say="${esc(v.ex)}" data-lang="${accent()}">🔊</button></p>
        </div>
      </div>
      <button class="btn block" data-flip>Lật thẻ · Show meaning</button>
      <div class="grades" hidden>
        <button class="btn danger" data-g="0">Quên</button>
        <button class="btn ghost" data-g="1">Khó</button>
        <button class="btn" data-g="2">Nhớ</button>
      </div>`;
    bindSay(view);
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
    view.innerHTML = `<h1>${bi('Xong buổi ôn', 'Done')}</h1>
      <div class="card"><h3>Nhớ ${remembered}/${reviewed} lượt</h3>
      <p class="meta">Thẻ chấm Quên hoặc Khó sẽ quay lại sớm hơn. Mai mở app để ôn đúng hạn.</p>
      <a class="btn" href="#/vocab/dictation">Nghe và gõ chính tả</a><a class="btn ghost" href="#/">Về Hôm nay</a></div>`;
  }

  show();
}

function dictation(view, vocab) {
  const s = store.get();
  const known = vocab.filter(v => s.srs[v.w]?.ivl >= 1);
  const pool = known.length >= 5 ? known : vocab.slice(0, 20);
  const items = shuffle(pool).slice(0, 10).map(v => ({
    q: 'Nghe và gõ lại từ',
    lead: known.length >= 5 ? '' : 'Chưa đủ từ đã thuộc, tạm lấy các từ đầu danh sách.',
    type: 'text', answer: [v.w], say: v.w, ph: 'Gõ từ bạn nghe được',
    explain: `${v.w} (${v.p}): ${v.vn}`,
  }));
  runQuiz(view, items, {
    title: 'Nghe – gõ', lang: s.prefs.accent,
    onAnswer: r => store.logAttempt({ item: r.item.answer[0], skill: 'L', type: 'L-spelling', correct: r.correct, ms: r.ms, detail: r.correct ? '' : r.given }),
    onDone: res => {
      const wrong = res.filter(r => !r.correct);
      view.innerHTML = `<h1>${bi('Kết quả nghe – gõ', 'Dictation result')}</h1>
        <div class="card"><h3>Đúng ${res.length - wrong.length}/${res.length}</h3>
        ${wrong.length ? `<table class="res"><tr><th>Em gõ</th><th>Đúng là</th></tr>${wrong.map(r => `<tr><td>${esc(r.given)}</td><td><b>${esc(r.item.answer[0])}</b></td></tr>`).join('')}</table>` : '<p class="meta">Không sai từ nào.</p>'}
        <div class="row" style="margin-top:10px"><a class="btn" href="#/vocab/dictation" data-again>Làm lượt khác</a><a class="btn ghost" href="#/">Về Hôm nay</a></div></div>`;
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
      <span><b>${esc(v.w)}</b> <span class="muted small">${esc(v.p)}${v.cefr ? ` · ${esc(v.cefr)}` : ""}</span> ${known(v) ? '<span class="badge done">đã thuộc</span>' : ''}</span>
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
