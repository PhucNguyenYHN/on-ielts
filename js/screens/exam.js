// Thi thử bằng đề chính thức: mở đề trên trang gốc (British Council, ielts.org, IDP) hoặc sách Cambridge của em,
// app bấm giờ như phòng thi, em nhập số câu đúng, app quy đổi band và lưu lịch sử.
// Writing: viết ngay trong app, nộp để phiên chấm 22h chấm như bài thường.
import * as store from '../store.js';
import { esc, bi, wordCount } from '../util.js';
import { toBand } from '../engine.js';
import { confetti, ring } from '../fx.js';
import { hasVault, savedPass, unlock, forget, readJSON, readBlobURL } from '../vault.js';

const SOURCES = [
  { id: 'bc', name: 'British Council: đề luyện Academic', url: 'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests/academic', note: 'Listening, Reading, Writing, Speaking. Không cần đăng ký.' },
  { id: 'bcf', name: 'British Council: bài thi làm quen (trên máy)', url: 'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests/ielts-familiarisation-test', note: 'Giống thi trên máy tính, tự chấm Listening và Reading.' },
  { id: 'org', name: 'ielts.org: đề mẫu chính thức (PDF có đáp án)', url: 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions', note: 'Có bài Writing mẫu kèm band và nhận xét của giám khảo.' },
  { id: 'idp', name: 'IDP: đề thi thử chính thức', url: 'https://ielts.idp.com/prepare/article-access-official-ielts-mock-test', note: 'Đủ 4 kỹ năng, có đáp án để tự chấm.' },
  { id: 'ready', name: 'British Council: IELTS Ready', url: 'https://takeielts.britishcouncil.org/prepare/ielts-ready', note: '6 đề đủ 4 kỹ năng, cần đăng ký tài khoản miễn phí.' },
  { id: 'cam', name: 'Sách Cambridge IELTS của em', url: '', note: 'Ghi số sách và số đề để theo dõi, ví dụ "Cam 18 Test 2".' },
];
const SKILLS = {
  listening: { name: 'Listening', vn: 'Nghe', mins: 30, total: 40, k: 'L' },
  reading: { name: 'Reading', vn: 'Đọc', mins: 60, total: 40, k: 'R' },
  writing: { name: 'Writing', vn: 'Viết', mins: 60, k: 'W' },
};
const RUN = 'ielts.exam.run'; // phiên đang làm, giữ khi em chuyển sang tab đề rồi quay lại
const getRun = () => { try { return JSON.parse(localStorage.getItem(RUN)) || null; } catch { return null; } };
const setRun = r => { try { r ? localStorage.setItem(RUN, JSON.stringify(r)) : localStorage.removeItem(RUN); } catch { /* bỏ qua */ } };
const fmt = s => `${s < 0 ? '-' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`;

export default function exam(view, [mode, id] = []) {
  const run = getRun();
  if (run) return run.app ? appTest(view, run) : running(view, run);
  if (mode === 'app' && id) return startApp(view, id);
  return menu(view);
}

function menu(view) {
  const s = store.get();
  const hist = (s.exams || []).slice().reverse();
  const best = k => Math.max(0, ...(s.exams || []).filter(x => x.skill === k && x.band).map(x => x.band));
  view.innerHTML = `<p><a href="#/">← Hôm nay</a></p>
    <h1>${bi('Thi thử đề chính thức', 'Official practice tests')}</h1>
    <div class="kpis">
      <div class="kpi"><b>${best('listening') || '–'}</b><span>Listening cao nhất</span></div>
      <div class="kpi"><b>${best('reading') || '–'}</b><span>Reading cao nhất</span></div>
    </div>
    <div data-vault></div>
    <div class="card">
      <p class="eyebrow">Đề ở trang ngoài</p>
      <p class="eyebrow">Bước 1</p><h3>Chọn kỹ năng</h3>
      <div class="seg" data-skill-seg>${Object.entries(SKILLS).map(([k, x]) => `<button data-sk="${k}">${x.name} · ${x.mins}′</button>`).join('')}</div>
      <p class="eyebrow" style="margin-top:16px">Bước 2</p><h3>Chọn nguồn đề</h3>
      ${SOURCES.map((x, i) => `<label class="src"><input type="radio" name="src" value="${x.id}" ${i ? '' : 'checked'}>
        <span><b>${esc(x.name)}</b><span class="muted small">${esc(x.note)}</span></span></label>`).join('')}
      <input class="inp" data-label placeholder="Tên đề, ví dụ: Cam 18 Test 2, hoặc BC Practice Test 1" style="margin-top:8px">
      <p class="eyebrow" style="margin-top:12px">Bước 3</p>
      <button class="btn block" data-start>Mở đề và bắt đầu tính giờ</button>
      <p class="muted small">App mở đề ở tab mới. Làm xong quay lại app (đồng hồ vẫn chạy), nhập số câu đúng theo đáp án của đề, app quy đổi ra band.</p>
    </div>
    ${hist.length ? `<h2>${bi('Lịch sử thi thử', 'History')}</h2><div class="card"><table class="res">
      <tr><th>Ngày</th><th>Đề</th><th>Kết quả</th></tr>
      ${hist.slice(0, 20).map(x => `<tr><td>${new Date(x.ts).toLocaleDateString('vi-VN')}</td><td>${SKILLS[x.skill].name}<div class="muted small">${esc(x.label || '')}</div></td>
        <td>${x.band ? `<b>Band ${x.band}</b><div class="muted small">${x.raw}/${x.total} câu · ${x.mins}′</div>` : `<span class="badge">Đã nộp chấm</span><div class="muted small">${x.words} từ · ${x.mins}′</div>`}</td></tr>`).join('')}
    </table></div>` : ''}
    <p class="muted small">Band quy đổi theo bảng điểm phổ biến của IELTS, chỉ để tham khảo, không phải điểm thi chính thức.</p>`;

  let skill = 'listening';
  const mark = () => view.querySelectorAll('[data-sk]').forEach(b => b.classList.toggle('on', b.dataset.sk === skill));
  view.querySelectorAll('[data-sk]').forEach(b => { b.onclick = () => { skill = b.dataset.sk; mark(); }; });
  mark();
  renderVault(view.querySelector('[data-vault]'));
  view.querySelector('[data-start]').onclick = () => {
    const src = SOURCES.find(x => x.id === view.querySelector('input[name=src]:checked').value);
    const label = view.querySelector('[data-label]').value.trim() || src.name;
    if (src.url) window.open(src.url, '_blank', 'noopener');
    setRun({ skill, src: src.id, label, start: Date.now(), mins: SKILLS[skill].mins, text: '', prompt: '' });
    running(view, getRun());
  };
}

function running(view, run) {
  const sk = SKILLS[run.skill];
  const src = SOURCES.find(x => x.id === run.src);
  const write = run.skill === 'writing';
  view.innerHTML = `<div class="timer" data-timer>⏱ --:--</div>
    <h1>${sk.name} <span class="muted small">· ${esc(run.label)}</span></h1>
    ${src?.url ? `<p><a class="btn ghost" href="${src.url}" target="_blank" rel="noopener">Mở lại trang đề</a></p>` : ''}
    ${write ? `<div class="card">
        <p class="eyebrow">Đề bài</p>
        <textarea class="inp" data-prompt rows="3" style="min-height:0" placeholder="Dán hoặc gõ lại đề Task 2 (hoặc Task 1)">${esc(run.prompt || '')}</textarea>
        <p class="eyebrow" style="margin-top:8px">Bài viết · <span data-wc>0</span> từ</p>
        <textarea class="inp" data-text placeholder="Viết bài ở đây. App tự lưu khi em gõ.">${esc(run.text || '')}</textarea>
        <button class="btn block" data-send>Nộp bài để chấm</button>
        <p class="muted small">Bài nộp được chấm lúc 22h, điểm và nhận xét hiện ở mục Bài viết của em.</p>
      </div>`
      : `<div class="card">
        <p class="eyebrow">Khi làm xong</p>
        <label><b>Số câu đúng (trên ${sk.total})</b></label>
        <input class="inp" data-raw type="number" inputmode="numeric" min="0" max="${sk.total}" placeholder="Ví dụ 24">
        <button class="btn block" data-done>Xem band</button>
        <p class="muted small">Chấm theo đáp án đi kèm đề. Câu viết sai chính tả hoặc thiếu -s tính là sai, như khi thi thật.</p>
      </div>`}
    <button class="btn ghost" data-quit>Hủy bài này</button>`;

  const timer = view.querySelector('[data-timer]');
  const tick = () => {
    const left = Math.round(run.start / 1000 + run.mins * 60 - Date.now() / 1000);
    timer.textContent = left >= 0 ? `⏱ Còn ${fmt(left)}` : `⏱ Hết giờ · quá ${fmt(-left)}`;
    timer.classList.toggle('over', left < 0);
  };
  tick();
  const iv = setInterval(tick, 1000);
  const usedMins = () => Math.max(1, Math.round((Date.now() - run.start) / 60000));

  view.querySelector('[data-quit]').onclick = () => { if (confirm('Hủy bài thi thử này? Bài sẽ không được lưu.')) { setRun(null); clearInterval(iv); menu(view); } };

  if (write) {
    const ta = view.querySelector('[data-text]'), pr = view.querySelector('[data-prompt]'), wc = view.querySelector('[data-wc]');
    const save = () => { run.text = ta.value; run.prompt = pr.value; setRun(run); wc.textContent = wordCount(ta.value); };
    ta.oninput = pr.oninput = save; save();
    view.querySelector('[data-send]').onclick = async e => {
      const words = wordCount(ta.value);
      if (words < 50) { alert('Bài còn quá ngắn để chấm (dưới 50 từ).'); return; }
      e.target.disabled = true; e.target.textContent = 'Đang nộp…';
      try {
        await store.api({ action: 'writing', prompt: pr.value || run.label, text: ta.value, words, minutes: usedMins(), source: `Thi thử: ${run.label}` });
      } catch { e.target.disabled = false; e.target.textContent = 'Nộp lại'; alert('Chưa gửi được, kiểm tra mạng rồi bấm Nộp lại. Bài vẫn được giữ trên máy.'); return; }
      store.update(s => { (s.exams ||= []).push({ ts: Date.now(), skill: run.skill, src: run.src, label: run.label, words, mins: usedMins() }); });
      setRun(null); clearInterval(iv);
      view.innerHTML = `<div class="card result-big"><h3>Đã nộp bài ✅</h3><p class="meta">${words} từ trong ${usedMins()} phút. Bài sẽ được chấm lúc 22h, xem ở mục Bài viết của em.</p>
        <div class="row" style="justify-content:center"><a class="btn" href="#/exam">Về Thi thử</a><a class="btn ghost" href="#/">Về Hôm nay</a></div></div>`;
      confetti(50);
    };
  } else {
    view.querySelector('[data-done]').onclick = () => {
      const raw = Math.round(+view.querySelector('[data-raw]').value);
      if (!(raw >= 0 && raw <= sk.total)) { alert(`Nhập số câu đúng từ 0 đến ${sk.total}.`); return; }
      const band = toBand(raw, sk.total, run.skill);
      const mins = usedMins();
      store.update(s => { (s.exams ||= []).push({ ts: Date.now(), skill: run.skill, src: run.src, label: run.label, raw, total: sk.total, band, mins }); });
      store.logAttempt({ item: `MOCK-${run.label}`, skill: sk.k, type: `X-${run.skill}`, correct: band >= 5.5, detail: `${raw}/${sk.total} → band ${band}` });
      setRun(null); clearInterval(iv);
      const next = band >= 6.5 ? 'Đã vượt mục tiêu cuối. Giữ phong độ bằng một đề mỗi tuần.' : band >= 5.5 ? 'Đạt mục tiêu 5.5. Bước tiếp theo là 6.5: xem lại từng câu sai và vì sao sai.' : `Cần thêm ${Math.max(1, needRaw(5.5, run.skill) - raw)} câu đúng nữa để đạt 5.5. Xem lại câu sai theo đáp án, ghi lại dạng câu hay sai.`;
      view.innerHTML = `<h1>${bi('Kết quả thi thử', 'Result')}</h1>
        <div class="card result-big">${ring(raw / sk.total, { size: 110, stroke: 10, label: `${raw}/${sk.total}` })}
          <p class="eyebrow" style="margin-top:6px">${sk.name} · ${esc(run.label)}</p>
          <h3 style="font-size:1.8rem;margin:4px 0">Band ${band}</h3>
          <p class="meta">${mins} phút · mục tiêu 5.5, đích cuối 6.5</p>
          <p class="meta" style="margin-top:8px">${next}</p>
          <div class="row" style="justify-content:center;margin-top:10px"><a class="btn" href="#/exam">Về Thi thử</a><a class="btn ghost" href="#/">Về Hôm nay</a></div></div>`;
      if (band >= 5.5) confetti();
    };
  }
  return () => clearInterval(iv);
}

// Số câu đúng tối thiểu để đạt một band
function needRaw(band, skill) {
  for (let raw = 0; raw <= 40; raw++) if (toBand(raw, 40, skill) >= band) return raw;
  return 40;
}

// ===================== Đề có sẵn trong app (đã mã hóa) =====================
async function renderVault(el) {
  if (!el || !(await hasVault())) return;
  const s = store.get();
  const doneOf = id => (s.exams || []).filter(x => x.testId === id && x.band).map(x => x.band);
  let list = null;
  if (savedPass()) { try { list = await readJSON('index.enc'); } catch { forget(); } }
  if (!list) {
    el.innerHTML = `<div class="card"><p class="eyebrow">Đề trong app</p><h3>🔐 Nhập mã mở đề</h3>
      <p class="meta">Đề trong app được mã hóa. Nhập mã một lần trên máy này là dùng được mãi.</p>
      <input class="inp" data-pass autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx-xxxx-xxxx-xxxx">
      <button class="btn" data-unlock>Mở khóa</button><p class="small" data-err style="color:var(--bad)"></p></div>`;
    el.querySelector('[data-unlock]').onclick = async () => {
      const ok = await unlock(el.querySelector('[data-pass]').value);
      if (ok) renderVault(el); else el.querySelector('[data-err]').textContent = 'Mã chưa đúng.';
    };
    return;
  }
  el.innerHTML = `<div class="card"><p class="eyebrow">Đề trong app · chấm tự động</p><h3>Chọn đề</h3>
    ${list.map(t => {
      const b = t.practice ? [] : doneOf(t.id);
      return `<a class="card task" data-skill="${t.skill === 'listening' ? 'listen' : 'read'}" href="#/exam/app/${encodeURIComponent(t.id)}">
        <span class="chip">${t.skill === 'listening' ? 'L' : 'R'}</span>
        <span class="body"><h3>${esc(t.title)} ${t.practice ? '<span class="badge">Luyện dạng câu</span>' : '<span class="badge done">Đề chuẩn</span>'}</h3><div class="meta">${t.total} câu · ${t.mins} phút${b.length ? ` · cao nhất band ${Math.max(...b)}` : ''}</div></span>
        <span class="go">→</span></a>`;
    }).join('')}</div>`;
}

async function startApp(view, id) {
  view.innerHTML = '<p class="muted">Đang mở đề…</p>';
  let list;
  try { list = await readJSON('index.enc'); } catch { location.hash = '#/exam'; return; }
  const meta = list.find(x => x.id === id);
  if (!meta) { location.hash = '#/exam'; return; }
  const run = { app: true, id, practice: !!meta.practice, file: meta.file, audio: meta.audio, title: meta.title, skill: meta.skill, mins: meta.mins, start: Date.now(), ans: {} };
  setRun(run);
  return appTest(view, run);
}

const norm = x => String(x ?? '').toLowerCase().replace(/[’']/g, "'").replace(/[.,;:!?"]+$/g, '').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
const qk = q => Array.isArray(q.n) ? q.n.join('-') : String(q.n);           // khóa lưu câu trả lời
const qlabel = q => Array.isArray(q.n) ? q.n.join(' & ') : q.n;               // số câu hiển thị
const marksOf = q => Array.isArray(q.n) ? q.n.length : 1;                     // số điểm tối đa
const answered = v => Array.isArray(v) ? v.length > 0 : !!norm(v);

function appTest(view, run) {
  let alive = true, iv = 0, audioURL = '';
  view.innerHTML = '<p class="muted">Đang giải mã đề…</p>';
  (async () => {
    let t;
    try { t = await readJSON(run.file); } catch { setRun(null); view.innerHTML = '<div class="card"><p>Không mở được đề. Kiểm tra mã mở đề trong mục Thi thử.</p><a class="btn" href="#/exam">Về Thi thử</a></div>'; return; }
    if (!alive) return;
    const qs = t.parts.flatMap(p => p.questions);
    view.innerHTML = `<div class="timer" data-timer>⏱ --:--</div>
      <h1>${esc(t.title)}</h1>
      ${t.note ? `<p class="muted small">${esc(t.note)}</p>` : ''}
      ${run.audio ? '<div class="card aud-sticky"><p class="muted small" data-aud>Đang giải mã audio…</p></div>' : ''}
      ${t.parts.map(p => `<div class="card">
        <p class="eyebrow">${esc(p.title)}</p>
        ${p.instructions ? `<p class="meta">${esc(p.instructions)}</p>` : ''}
        ${p.audio ? `<div class="paud" data-paud="${p.audio}"><button class="btn ghost" data-loadaud>🎧 Mở audio phần này</button></div>` : ''}
        ${p.passage ? `<details class="passage-box" open><summary>📄 Bài đọc</summary><div class="passage">${p.passage.map((x, i) => i === 0 ? `<h3>${esc(x)}</h3>` : `<p>${esc(x)}</p>`).join('')}</div></details>` : ''}
        ${p.questions.map(q => `${q.intro ? `<p class="qintro">${esc(q.intro)}</p>` : ''}<div class="qitem" data-q="${qk(q)}"><label><b>${qlabel(q)}.</b> ${esc(q.q)}</label>${field(q, run.ans[qk(q)])}</div>`).join('')}
      </div>`).join('')}
      <button class="btn block" data-submit>Nộp bài và chấm</button>
      <button class="btn ghost" data-quit>Hủy bài này</button>`;

    // Lưu câu trả lời ngay khi chọn hoặc gõ
    view.querySelectorAll('[data-q]').forEach(box => {
      const k = box.dataset.q;
      const q = qs.find(x => qk(x) === k);
      box.querySelectorAll('input,select').forEach(inp => {
        const save = () => {
          if (inp.type === 'checkbox') {
            const on = [...box.querySelectorAll('input:checked')];
            if (on.length > marksOf(q)) { inp.checked = false; return; } // chỉ được chọn đúng số đáp án đề yêu cầu
            run.ans[k] = on.map(x => x.value);
          } else run.ans[k] = inp.type === 'radio' ? (inp.checked ? inp.value : run.ans[k]) : inp.value;
          setRun(run);
        };
        inp.addEventListener(inp.type === 'radio' || inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', save);
      });
    });
    if (run.audio) {
      readBlobURL(run.audio).then(url => {
        if (!alive) return URL.revokeObjectURL(url);
        audioURL = url;
        view.querySelector('[data-aud]').outerHTML = `<audio controls preload="auto" src="${url}"></audio><p class="muted small" style="margin:0">Bấm phát rồi làm theo hướng dẫn trong audio. Chấm xong thì nghe lại chỗ sai.</p>`;
      }).catch(() => { view.querySelector('[data-aud]').textContent = 'Không mở được audio.'; });
    }
    const timer = view.querySelector('[data-timer]');
    const tick = () => {
      const left = Math.round(run.start / 1000 + run.mins * 60 - Date.now() / 1000);
      timer.textContent = left >= 0 ? `⏱ Còn ${fmt(left)}` : `⏱ Hết giờ · quá ${fmt(-left)}`;
      timer.classList.toggle('over', left < 0);
    };
    tick(); iv = setInterval(tick, 1000);
    view.querySelector('[data-quit]').onclick = () => { if (confirm('Hủy bài này? Câu trả lời sẽ không được lưu.')) { setRun(null); if (location.hash === '#/exam') menu(view); else location.hash = '#/exam'; } };
    view.querySelector('[data-submit]').onclick = () => {
      const empty = qs.filter(q => !answered(run.ans[qk(q)])).reduce((a, q) => a + marksOf(q), 0);
      if (empty && !confirm(`Còn ${empty} câu chưa làm. Vẫn nộp bài?`)) return;
      clearInterval(iv);
      grade(view, run, t, qs);
    };
  })();
  // Audio từng phần: chỉ giải mã khi bấm mở
  const partURLs = [];
  view.addEventListener('click', async e => {
    const b = e.target.closest('[data-loadaud]');
    if (!b) return;
    const box = b.closest('[data-paud]');
    b.disabled = true; b.textContent = 'Đang mở audio…';
    try {
      const url = await readBlobURL(box.dataset.paud);
      if (!alive) return URL.revokeObjectURL(url);
      partURLs.push(url);
      view.querySelectorAll('[data-paud] audio').forEach(a => a.pause());
      box.innerHTML = `<audio controls autoplay src="${url}"></audio>`;
    } catch { b.disabled = false; b.textContent = 'Không mở được, bấm thử lại'; }
  });
  return () => { alive = false; clearInterval(iv); if (audioURL) URL.revokeObjectURL(audioURL); partURLs.forEach(u => URL.revokeObjectURL(u)); };
}

function field(q, val = '') {
  const name = `q${qk(q)}`;
  if (q.type === 'tfng' || q.type === 'ynng') {
    const opts = q.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
    return `<div class="seg">${opts.map(o => `<label class="segopt"><input type="radio" name="${name}" value="${o}" ${val === o ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div>`;
  }
  if (q.type === 'mcq' || q.type === 'pick') {
    const multi = q.type === 'pick', chosen = multi ? (Array.isArray(val) ? val : []) : [val];
    return (multi ? `<p class="muted small" style="margin:2px 0">Chọn ${marksOf(q)} đáp án.</p>` : '') +
      q.options.map((o, i) => { const L = 'ABCDEFGH'[i]; return `<label class="src"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${L}" ${chosen.includes(L) ? 'checked' : ''}><span><b>${L}</b> ${esc(o)}</span></label>`; }).join('');
  }
  if (q.type === 'letter') {
    // values: mã riêng (ví dụ i, ii, iii cho nối tiêu đề); mặc định A, B, C…
    return `<select class="inp" style="max-width:100%"><option value="">— chọn —</option>${q.options.map((o, i) => { const L = q.values ? q.values[i] : 'ABCDEFGH'[i]; return `<option value="${L}" ${val === L ? 'selected' : ''}>${q.values ? '' : L + ' · '}${esc(o)}</option>`; }).join('')}</select>`;
  }
  return `<input class="inp" value="${esc(val || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Câu trả lời">`;
}

// Chấm: câu thường 1 điểm; chọn HAI đáp án mỗi chữ đúng 1 điểm; nhóm "theo thứ tự bất kỳ" không tính trùng
function grade(view, run, t, qs) {
  const used = {};
  const res = qs.map(q => {
    const given = run.ans[qk(q)] ?? (q.type === 'pick' ? [] : '');
    const max = marksOf(q);
    let got = 0;
    if (q.type === 'pick') got = Math.min(max, [...new Set(given)].filter(L => q.answer.includes(L)).length);
    else if (q.group) {
      // Mỗi đáp án trong nhóm có thể có nhiều cách viết, ngăn bằng "|" (books|some books); mỗi đáp án chỉ được tính một lần
      const g = (used[q.group] ||= new Set()), v = norm(given);
      const k = q.answer.findIndex(a => a.split('|').some(x => norm(x) === v));
      if (k >= 0 && !g.has(k)) { got = 1; g.add(k); }
    } else got = q.answer.some(a => a.split('|').some(x => norm(x) === norm(given))) ? 1 : 0;
    return { q, given, got, max };
  });
  // Nhóm theo thứ tự bất kỳ: câu sai thì đáp án cần chỉ ra là đáp án chưa ai dùng
  res.forEach(x => { if (x.q.group && !x.got) x.expect = (x.q.answer.find((a, k) => !used[x.q.group].has(k)) || x.q.answer[0]).split('|')[0]; });
  const raw = res.reduce((a, x) => a + x.got, 0), total = res.reduce((a, x) => a + x.max, 0);
  const band = run.practice ? null : toBand(raw, total, run.skill); // đề tự soạn: chỉ luyện dạng câu, không tính band
  const mins = Math.max(1, Math.round((Date.now() - run.start) / 60000));
  const show = v => Array.isArray(v) ? v.join(', ') : v;
  store.update(s => { (s.exams ||= []).push({ ts: Date.now(), skill: run.skill, src: 'app', testId: run.id, label: run.title, raw, total, band, mins }); });
  res.forEach(x => store.logAttempt({ item: `${run.id}-${qk(x.q)}`, skill: run.skill === 'listening' ? 'L' : 'R', type: `X-${x.q.type}`, correct: x.got === x.max, detail: x.got === x.max ? '' : `${show(x.given)} → ${x.q.answer.join('/')}` }));
  setRun(null);
  // Dạng câu hay sai
  const byType = {};
  res.forEach(x => { const b = (byType[x.q.type] ||= { n: 0, ok: 0 }); b.n += x.max; b.ok += x.got; });
  const TYPE = { tfng: 'True/False/Not Given', ynng: 'Yes/No/Not Given', text: 'Điền từ', mcq: 'Trắc nghiệm', pick: 'Chọn hai đáp án', letter: 'Nối thông tin' };
  const weakType = Object.entries(byType).filter(([, b]) => b.ok < b.n).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
  const TIP = {
    tfng: 'NOT GIVEN là khi bài không nói tới; FALSE là khi bài nói ngược lại. Tìm đúng câu trong bài rồi so từng chi tiết.',
    ynng: 'Câu hỏi về ý kiến tác giả. NO là tác giả nghĩ ngược lại; NOT GIVEN là tác giả không bày tỏ.',
    text: 'Chép đúng chữ trong bài, đúng chính tả, đúng số lượng từ đề cho. Thiếu -s là sai.',
    mcq: 'Loại trừ đáp án sai trước. Đáp án đúng thường diễn đạt lại ý của bài bằng từ khác.',
    pick: 'Đọc kỹ cả 5 lựa chọn. Lựa chọn sai thường có từ giống bài nhưng ý khác hoặc bài không nhắc tới.',
    letter: 'Gạch tên người hoặc từ khóa của từng đoạn trước, rồi tìm câu nói cùng ý (thường được diễn đạt lại bằng từ khác).',
  };
  const ok = x => x.got === x.max;
  view.innerHTML = `<h1>${bi('Kết quả', 'Result')}</h1>
    <div class="card result-big">${ring(raw / total, { size: 110, stroke: 10, label: `${raw}/${total}` })}
      <p class="eyebrow" style="margin-top:6px">${esc(t.title)}</p>
      <h3 style="font-size:1.8rem;margin:4px 0">${band ? `Band ${band}` : `Đúng ${raw}/${total}`}</h3>
      <p class="meta">${mins} phút${band ? (total < 40 ? ' · quy đổi theo tỉ lệ trên 40 câu' : '') : ' · đề luyện dạng câu, không tính band'}</p>
      ${weakType ? `<div class="fix-tip" style="text-align:left;margin-top:10px">💡 <b>Dạng sai nhiều nhất: ${TYPE[weakType[0]]}</b> (${weakType[1].ok}/${weakType[1].n} đúng). ${TIP[weakType[0]]}</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:10px"><a class="btn" href="#/exam">Về Thi thử</a><a class="btn ghost" href="#/exam/app/${encodeURIComponent(run.id)}">Làm lại</a></div></div>
    ${t.parts.some(p => p.transcript) ? `<h2>${bi('Lời thoại', 'Transcripts')}</h2><p class="muted small">Đối chiếu chỗ nghe sai với lời thoại.</p>
      ${t.parts.filter(p => p.transcript).map(p => `<details class="card"><summary><b>${esc(p.title)}</b></summary><div class="tscript">${esc(p.transcript)}</div></details>`).join('')}` : ''}
    <h2>${bi('Chữa từng câu', 'Review')}</h2>
    <div class="card">${res.map(x => `<div class="review-item"><b>${qlabel(x.q)}.</b> ${esc(x.q.q)}
      <div class="small" style="margin-top:4px">${ok(x) ? `<span class="good-t">✓ ${esc(show(x.given))}</span>`
        : `<span class="bad-t">${x.got ? `◐ ${x.got}/${x.max}` : '✗'} ${esc(show(x.given) || '(bỏ trống)')}</span> → <b>${esc(x.q.type === 'pick' ? x.q.answer.join(', ') : (x.expect || x.q.answer[0]))}</b>${x.q.type === 'letter' && !x.q.values ? ` <span class="muted">(${esc(x.q.options['ABCDEFGH'.indexOf(x.q.answer[0])])})</span>` : ''}`}</div>
      ${x.q.explain && !ok(x) ? `<div class="muted small">${esc(x.q.explain)}</div>` : ''}</div>`).join('')}</div>`;
  if (band ? band >= 5.5 : raw / total >= 0.7) confetti();
}
