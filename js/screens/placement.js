// Kiểm tra đầu vào: 6 phần, làm theo thứ tự tùy ý, có thể chia nhiều buổi.
import * as store from '../store.js';
import { esc, bi, shuffle, checkText, countdown, wordCount, loadContent } from '../util.js';
import { toBand, PLACEMENT_SECTIONS } from '../engine.js';
import { runQuiz } from '../quiz.js';
import { say, stop as stopTTS } from '../tts.js';
import { recorderWidget, blobToBase64 } from '../recorder.js';

const NAMES = {
  grammar: ['Ngữ pháp', 'Grammar', '30 câu trắc nghiệm, khoảng 15 phút'],
  vocab: ['Từ vựng', 'Vocabulary', '40 từ, chọn nghĩa đúng, khoảng 8 phút'],
  listening: ['Nghe', 'Listening', '10 câu dạng Part 1, khoảng 8 phút'],
  reading: ['Đọc', 'Reading', '1 bài đọc, 10 câu, 15 phút'],
  writing: ['Viết', 'Writing Task 2', '1 bài luận tối thiểu 250 từ, 40 phút, làm trên máy tính'],
  speaking: ['Nói', 'Speaking Part 1', '3 câu hỏi, ghi âm mỗi câu tối đa 1 phút'],
};

export default async function placementScreen(view, [section]) {
  const data = await loadContent('placement');
  const run = { grammar, vocab, listening, reading, writing, speaking }[section];
  if (run) return run(view, data);
  overview(view);
}

function saveSection(key, result) {
  store.update(s => { s.placement[key] = { ...result, at: Date.now() }; });
}

function overview(view) {
  const p = store.get().placement;
  const status = k => {
    const r = p[k];
    if (!r) return '<span class="badge warn">Chưa làm</span>';
    if (r.total) return `<span class="badge done">${r.score}/${r.total}</span>`;
    return '<span class="badge done">Đã nộp</span>';
  };
  const est = [];
  if (p.listening) est.push(['Listening', `≈ ${toBand(p.listening.score, p.listening.total, 'listening')}`]);
  if (p.reading) est.push(['Reading', `≈ ${toBand(p.reading.score, p.reading.total, 'reading')}`]);
  if (p.grammar) {
    const pct = p.grammar.score / p.grammar.total;
    est.push(['Ngữ pháp', pct < 0.5 ? 'Mức 1: còn sai ở câu đơn' : pct < 0.8 ? 'Mức 2: câu đơn tạm ổn, câu phức còn yếu' : 'Mức 3: dùng được câu phức']);
  }
  if (p.vocab?.bands) {
    est.push(['Từ vựng', Object.entries(p.vocab.bands).map(([b, r]) => `${b}: ${r.c}/${r.n}`).join(' · ')]);
  }
  if (p.writing) est.push(['Writing', `${p.writing.words} từ trong ${p.writing.minutes} phút, chờ chấm`]);

  view.innerHTML = `<h1>${bi('Kiểm tra đầu vào', 'Placement test')}</h1>
    <p class="muted small">Làm đúng sức, không tra từ điển. Kết quả dùng để xếp bài luyện cho em, không phải để chấm đỗ trượt.</p>
    ${PLACEMENT_SECTIONS.map(k => `<a class="card" href="#/placement/${k}">
      <h3>${esc(NAMES[k][0])} <span class="muted small">${esc(NAMES[k][1])}</span> ${status(k)}</h3>
      <div class="meta">${esc(NAMES[k][2])}</div></a>`).join('')}
    ${est.length ? `<h2>${bi('Ước lượng ban đầu', 'First estimate')}</h2>
      <div class="card"><table class="res">${est.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</table>
      <p class="muted small">Band Listening và Reading quy đổi từ bài 10 câu nên chỉ là ước lượng thô. Đề thi thử đầy đủ ở các đợt sau mới cho điểm tin cậy.</p></div>` : ''}`;
}

function intro(view, key, body, onStart) {
  view.innerHTML = `<p><a href="#/placement">← Kiểm tra đầu vào</a></p>
    <h1>${bi(NAMES[key][0], NAMES[key][1])}</h1>
    <div class="card">${body}<button class="btn block" data-start>Bắt đầu</button></div>`;
  view.querySelector('[data-start]').onclick = onStart;
}

function reviewTable(rows) {
  return `<table class="res"><tr><th>Câu</th><th>Em chọn</th><th>Đáp án</th></tr>${rows.map(r =>
    `<tr><td>${esc(r.q)}</td><td>${esc(r.given)}</td><td><b>${esc(r.right)}</b></td></tr>`).join('')}</table>`;
}

function done(view, key, html) {
  view.innerHTML = `<h1>${bi(`Xong phần ${NAMES[key][0]}`, 'Section complete')}</h1>
    <div class="card">${html}<div class="row" style="margin-top:10px"><a class="btn" href="#/placement">Các phần khác</a><a class="btn ghost" href="#/">Về Hôm nay</a></div></div>`;
}

// ---- Ngữ pháp ----
function grammar(view, data) {
  intro(view, 'grammar', `<p>30 câu, từ dễ đến khó. Không hiện đáp án cho tới cuối bài. Câu nào không biết thì chọn đáp án em thấy hợp lý nhất, đừng bỏ trống.</p>`, () => {
    const items = data.grammar.map((g, i) => ({ id: `PL-G${i + 1}`, q: g.q, type: 'mcq', options: g.o, answer: g.a, tag: g.tag }));
    runQuiz(view, items, {
      title: 'Ngữ pháp', feedback: false,
      onAnswer: r => store.logAttempt({ item: r.item.id, skill: 'G', type: r.item.tag, correct: r.correct, ms: r.ms }),
      onDone: res => {
        const score = res.filter(r => r.correct).length;
        const wrong = res.filter(r => !r.correct);
        saveSection('grammar', { score, total: res.length, wrongTags: wrong.map(r => r.item.tag) });
        done(view, 'grammar', `<h3>Đúng ${score}/${res.length}</h3>
          ${wrong.length ? reviewTable(wrong.map(r => ({ q: r.item.q, given: r.item.options[r.given], right: r.item.options[r.item.answer] }))) : ''}`);
      },
    });
  });
}

// ---- Từ vựng ----
function vocab(view, data) {
  intro(view, 'vocab', `<p>40 từ chia bốn nhóm từ dễ đến khó. Mỗi từ chọn nghĩa tiếng Việt đúng. Không biết thì chọn "Không biết", đừng đoán, để app đo đúng vốn từ.</p>`, () => {
    const items = data.vocab.map((v, i) => {
      const others = shuffle(data.vocab.filter(x => x.band === v.band && x.w !== v.w)).slice(0, 3).map(x => x.vn);
      const options = shuffle([v.vn, ...others]);
      return { id: `PL-V${i + 1}`, q: v.w, type: 'mcq', options: [...options, 'Không biết'], answer: options.indexOf(v.vn), band: v.band };
    });
    runQuiz(view, items, {
      title: 'Từ vựng', feedback: false,
      onAnswer: r => store.logAttempt({ item: r.item.id, skill: 'V', type: `V-${r.item.band}`, correct: r.correct, ms: r.ms }),
      onDone: res => {
        const bands = {};
        res.forEach(r => { const b = (bands[r.item.band] ??= { c: 0, n: 0 }); b.n++; if (r.correct) b.c++; });
        const score = res.filter(r => r.correct).length;
        saveSection('vocab', { score, total: res.length, bands });
        done(view, 'vocab', `<h3>Biết ${score}/${res.length} từ</h3>
          <table class="res">${Object.entries(bands).map(([b, r]) => `<tr><th>${esc(b)}</th><td>${r.c}/${r.n}</td></tr>`).join('')}</table>
          <p class="muted small">Nhóm 1000 và 2000 từ thông dụng cần đạt từ 8/10 cho mốc 1. Nhóm học thuật là trọng tâm của mốc 2.</p>`);
      },
    });
  });
}

// ---- Nghe ----
function listening(view, data) {
  const L = data.listening;
  let stopTimer = null, playing = false, cancelled = false;
  view.innerHTML = `<p><a href="#/placement">← Kiểm tra đầu vào</a></p>
    <h1>${bi('Nghe', 'Listening Part 1')}</h1>
    <div class="card">
      <p>${esc(L.intro)}</p>
      <p class="muted small">Đề thật cho khoảng 30 giây đọc câu hỏi trước khi nghe. Đọc kỹ để đoán cần nghe loại thông tin gì: số, tên riêng hay ngày tháng. Bài chỉ được nghe <b>một lần</b>.</p>
      <p class="muted small">Đợt này dùng giọng đọc của trình duyệt nên nghe hơi máy móc. Cài đặt âm thanh nên để to vừa đủ và đeo tai nghe nếu có.</p>
      <div class="row"><span class="timer" data-timer>0:30</span><button class="btn" data-play disabled>▶ Nghe (một lần)</button><button class="btn ghost" data-skip>Bỏ qua thời gian đọc</button></div>
      <p class="small muted" data-pst></p>
    </div>
    <div class="card">
      <h3>${esc(L.title)}</h3>
      <p class="muted small">${esc(L.instruction)}</p>
      ${L.questions.map((q, i) => `<div class="qitem" data-i="${i}"><label><b>${i + 1}.</b> ${esc(q.before)} ____ ${esc(q.after || '')}</label>
        <input class="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></div>`).join('')}
      <button class="btn block" data-submit>Nộp bài</button>
    </div>`;
  const playBtn = view.querySelector('[data-play]');
  const pst = view.querySelector('[data-pst]');
  const enable = () => { playBtn.disabled = false; stopTimer?.(); };
  stopTimer = countdown(view.querySelector('[data-timer]'), 30, enable);
  view.querySelector('[data-skip]').onclick = e => { enable(); e.target.remove(); };
  playBtn.onclick = async () => {
    playBtn.disabled = true;
    playBtn.textContent = 'Đang phát…';
    view.querySelector('[data-skip]')?.remove();
    playing = true;
    for (let i = 0; i < L.script.length && !cancelled; i++) {
      const line = L.script[i];
      pst.textContent = `Câu thoại ${i + 1}/${L.script.length}`;
      await say(line.text, L.voices[line.s]);
    }
    playing = false;
    if (!cancelled) { playBtn.textContent = 'Đã nghe xong'; pst.textContent = 'Kiểm tra lại chính tả rồi nộp bài.'; }
  };
  view.querySelector('[data-submit]').onclick = () => {
    if (playing && !confirm('Bài nghe chưa phát xong. Vẫn nộp?')) return;
    cancelled = true;
    stopTTS();
    let score = 0;
    const wrong = [];
    L.questions.forEach((q, i) => {
      const box = view.querySelector(`.qitem[data-i="${i}"]`);
      const val = box.querySelector('input').value.trim();
      const ok = !!val && checkText(val, q.answer);
      if (ok) score++; else wrong.push({ q: `${i + 1}. ${q.before} ____ ${q.after || ''}`, given: val || '(bỏ trống)', right: q.answer[0] });
      store.logAttempt({ item: `PL-L${i + 1}`, skill: 'L', type: q.tag, correct: ok, detail: ok ? '' : val });
    });
    saveSection('listening', { score, total: L.questions.length });
    done(view, 'listening', `<h3>Đúng ${score}/${L.questions.length}</h3>
      ${wrong.length ? reviewTable(wrong) : ''}
      <p class="muted small">Chú ý các câu người nói đổi ý (giá, ngày bắt đầu, môn thể thao): đáp án là thông tin sau cùng.</p>`);
  };
  return () => { cancelled = true; stopTimer?.(); stopTTS(); };
}

// ---- Đọc ----
function reading(view, data) {
  const R = data.reading;
  let stopTimer = null;
  intro(view, 'reading', `<p>Một bài đọc khoảng 450 từ và 10 câu hỏi, làm trong 15 phút (đề thật trung bình 1,5 phút mỗi câu). Hết giờ đồng hồ chuyển đỏ nhưng vẫn cho làm tiếp, để em biết mình chậm bao nhiêu.</p>`, () => {
    const t0 = Date.now();
    let n = 0;
    const qs = [];
    view.innerHTML = `<div class="timer" data-timer>15:00</div>
      <h1>${esc(R.title)}</h1>
      <div class="card passage">${R.paragraphs.map(p => `<p><span class="pl">${esc(p.l)}</span>${esc(p.text)}</p>`).join('')}</div>
      ${R.groups.map(g => `<div class="card"><p class="muted small">${esc(g.instruction)}</p>
        ${g.items.map(it => { const i = n++; qs.push({ ...it, kind: g.type }); return `<div class="qitem" data-i="${i}"><label><b>${i + 1}.</b> ${esc(it.q)}</label>
          ${g.type === 'tfng'
            ? `<select><option value="">Chọn…</option><option>TRUE</option><option>FALSE</option><option>NOT GIVEN</option></select>`
            : `<input class="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">`}</div>`; }).join('')}</div>`).join('')}
      <button class="btn block" data-submit>Nộp bài</button>`;
    stopTimer = countdown(view.querySelector('[data-timer]'), 15 * 60);
    view.querySelector('[data-submit]').onclick = () => {
      stopTimer();
      const minutes = Math.round((Date.now() - t0) / 60000);
      let score = 0;
      const wrong = [];
      qs.forEach((q, i) => {
        const box = view.querySelector(`.qitem[data-i="${i}"]`);
        const val = (box.querySelector('select, input').value || '').trim();
        const ok = q.kind === 'tfng' ? val === q.answer : !!val && checkText(val, q.answer);
        if (ok) score++; else wrong.push({ q: `${i + 1}. ${q.q}`, given: val || '(bỏ trống)', right: q.kind === 'tfng' ? q.answer : q.answer[0] });
        store.logAttempt({ item: `PL-R${i + 1}`, skill: 'R', type: q.kind === 'tfng' ? 'R-tfng' : 'R-sentence', correct: ok, detail: ok ? '' : val });
      });
      saveSection('reading', { score, total: qs.length, minutes });
      done(view, 'reading', `<h3>Đúng ${score}/${qs.length} trong ${minutes} phút</h3>
        ${minutes > 15 ? '<p class="meta">Quá 15 phút: cần luyện đọc lướt tìm từ khóa trước khi đọc kỹ.</p>' : ''}
        ${wrong.length ? reviewTable(wrong) : ''}`);
    };
  });
  return () => stopTimer?.();
}

// ---- Viết ----
const DRAFT = 'ielts.draft.placement-writing';
function writing(view, data) {
  const W = data.writing;
  let stopTimer = null;
  intro(view, 'writing', `<p>Nên làm trên máy tính. Có 40 phút, tối thiểu 250 từ. Bài tự lưu nháp trên máy này. Nộp xong bài được gửi về Google Sheets để anh chấm.</p>
    <p class="muted small">Viết đúng sức, không dùng công cụ dịch hay sửa lỗi tự động.</p>`, () => {
    const t0 = Date.now();
    let draft = '';
    try { draft = localStorage.getItem(DRAFT) || ''; } catch { /* không có bộ nhớ */ }
    view.innerHTML = `<div class="timer" data-timer>40:00</div>
      <div class="card"><p class="muted small">${esc(W.instruction)}</p><p><b>${esc(W.prompt)}</b></p></div>
      <textarea data-text placeholder="Viết bài ở đây…" spellcheck="false" autocorrect="off" autocapitalize="sentences">${esc(draft)}</textarea>
      <div class="row" style="justify-content:space-between"><span class="muted small" data-wc>0 từ</span><button class="btn" data-submit>Nộp bài</button></div>
      <p class="small muted" data-msg></p>`;
    const ta = view.querySelector('[data-text]');
    const wc = view.querySelector('[data-wc]');
    const upd = () => {
      const n = wordCount(ta.value);
      wc.textContent = `${n} từ${n < W.minWords ? ` (còn thiếu ${W.minWords - n})` : ''}`;
      try { localStorage.setItem(DRAFT, ta.value); } catch { /* bỏ qua */ }
    };
    ta.oninput = upd;
    upd();
    stopTimer = countdown(view.querySelector('[data-timer]'), W.minutes * 60);
    view.querySelector('[data-submit]').onclick = async e => {
      const words = wordCount(ta.value);
      if (words < 20) return alert('Bài còn quá ngắn.');
      if (words < W.minWords && !confirm(`Bài mới có ${words} từ, dưới ${W.minWords}. Vẫn nộp?`)) return;
      e.target.disabled = true;
      stopTimer();
      const minutes = Math.round((Date.now() - t0) / 60000);
      const msg = view.querySelector('[data-msg]');
      let sent = false;
      if (store.apiOn()) {
        msg.textContent = 'Đang gửi…';
        try { await store.api({ action: 'writing', prompt: W.prompt, text: ta.value, words, minutes, source: 'Kiểm tra đầu vào' }); sent = true; }
        catch (err) { msg.textContent = 'Gửi không được: ' + err.message + '. Bài vẫn còn trong nháp, thử nộp lại sau.'; e.target.disabled = false; return; }
      }
      saveSection('writing', { words, minutes, sent });
      try { localStorage.removeItem(DRAFT); } catch { /* bỏ qua */ }
      done(view, 'writing', `<h3>Đã nộp: ${words} từ trong ${minutes} phút</h3>
        <p class="meta">${sent ? 'Bài đã lưu vào Google Sheets, bảng BaiViet.' : 'App chưa nối máy chủ nên bài chưa gửi đi. Bản dưới đây để em chép lại gửi anh.'}</p>
        ${sent ? '' : `<textarea readonly style="min-height:30vh">${esc(ta.value)}</textarea>`}`);
    };
  });
  return () => stopTimer?.();
}

// ---- Nói ----
function speaking(view, data) {
  const S = data.speaking;
  const cleanups = [];
  const recorded = new Set();
  view.innerHTML = `<p><a href="#/placement">← Kiểm tra đầu vào</a></p>
    <h1>${bi('Nói', 'Speaking Part 1')}</h1>
    <div class="card"><p>Bấm 🔊 để nghe câu hỏi, rồi ghi âm câu trả lời. Mỗi câu nên nói 20–40 giây, tối đa 1 phút. Nói tự nhiên, không đọc chữ viết sẵn.</p>
      <p class="muted small">Lần đầu bấm ghi âm, máy sẽ hỏi quyền dùng micro: chọn Cho phép.</p></div>
    ${S.map((q, i) => `<div class="card" data-i="${i}"><h3>Câu ${i + 1}</h3>
      <p><b>${esc(q.q)}</b> <button class="say" data-q="${i}">🔊</button></p>
      <div data-rec></div><p class="small muted" data-st></p></div>`).join('')}
    <button class="btn block" data-finish>Hoàn thành phần Nói</button>`;
  view.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => { stopTTS(); say(S[+b.dataset.q].q, { lang: 'en-GB' }); }; });
  S.forEach((q, i) => {
    const box = view.querySelector(`.card[data-i="${i}"]`);
    const st = box.querySelector('[data-st]');
    cleanups.push(recorderWidget(box.querySelector('[data-rec]'), {
      maxSec: 60,
      transcribe: true,
      onDone: async (blob, mime, info) => {
        recorded.add(i);
        const text = info?.text || '';
        const words = wordCount(text);
        store.logAttempt({ item: `PL-S${i + 1}`, skill: 'S', type: 'S-part1', correct: words >= 25, detail: `${words} từ, ${info?.sec || 0} giây | ${text.slice(0, 300)}` });
        if (!store.apiOn()) { st.textContent = 'Đã ghi. App chưa nối máy chủ nên bản ghi chỉ nghe lại được trên máy này.'; return; }
        st.textContent = 'Đang gửi bản ghi…';
        try {
          const data64 = await blobToBase64(blob);
          await store.api({ action: 'audio', data: data64, mime, question: q.q, label: `dau-vao-cau-${i + 1}`, source: 'Kiểm tra đầu vào', transcript: text, words, seconds: info?.sec || 0 });
          st.textContent = `Đã gửi bản ghi lên Google Drive.${text ? ` Máy nghe được ${words} từ.` : ''}`;
        } catch (e) { st.textContent = 'Gửi không được: ' + e.message + '. Ghi lại để gửi lần nữa.'; }
      },
    }));
  });
  view.querySelector('[data-finish]').onclick = () => {
    if (recorded.size < S.length && !confirm(`Mới ghi ${recorded.size}/${S.length} câu. Vẫn hoàn thành?`)) return;
    saveSection('speaking', { recorded: recorded.size });
    done(view, 'speaking', `<h3>Đã ghi ${recorded.size}/${S.length} câu</h3>
      <p class="meta">Anh nghe bản ghi trong thư mục Drive "IELTS - Ghi âm" để đánh giá đầu vào Speaking.</p>`);
  };
  return () => { cleanups.forEach(c => c()); stopTTS(); };
}
