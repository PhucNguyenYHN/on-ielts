// Writing + Speaking theo sách Cambridge (đề đã mã hóa trong tests/, mở bằng mã mở đề như phần Thi thử).
// Sắp theo dạng bài: Task 2 theo kiểu đề, Task 1 theo loại hình, Speaking Part 2 theo chủ đề; mỗi dạng có dàn ý gợi ý.
// Bài viết nộp như Thi thử Writing (chấm lúc 22h); bản ghi Speaking gửi về bảng tính như Luyện nói.
import * as store from '../store.js';
import { esc, bi, wordCount, countdown, mmss } from '../util.js';
import { hasVault, savedPass, readJSON } from '../vault.js';
import { recorderWidget, blobToBase64 } from '../recorder.js';
import { say, stop as stopTTS } from '../tts.js';
import { confetti } from '../fx.js';

// ---------- Hướng dẫn theo dạng (soạn riêng cho app) ----------
const W2 = {
  opinion: { en: 'Opinion (agree / disagree)', vn: 'Nêu quan điểm', how: 'Đề hỏi "To what extent do you agree or disagree?"',
    plan: ['Mở bài: viết lại đề bằng lời của em + nói rõ em đồng ý đến mức nào.', 'Thân bài 1: lý do chính thứ nhất, giải thích, ví dụ cụ thể.', 'Thân bài 2: lý do thứ hai (hoặc mặt em chỉ đồng ý một phần), giải thích, ví dụ.', 'Kết bài: nhắc lại quan điểm, không thêm ý mới.'],
    phrases: ['I largely agree that…', 'While it is true that…, I believe…', 'A clear example of this is…'] },
  discussion: { en: 'Discussion (both views + opinion)', vn: 'Bàn hai quan điểm', how: 'Đề có "Discuss both these views and give your own opinion."',
    plan: ['Mở bài: giới thiệu hai quan điểm + ý kiến của em.', 'Thân bài 1: quan điểm thứ nhất, vì sao có người nghĩ vậy, ví dụ.', 'Thân bài 2: quan điểm thứ hai, lý do, ví dụ; nói em nghiêng về bên nào.', 'Kết bài: tóm tắt và khẳng định ý kiến.'],
    phrases: ['On the one hand, some people argue that…', 'On the other hand, others claim…', 'Personally, I side with…'] },
  advdis: { en: 'Advantages vs disadvantages', vn: 'Lợi nhiều hơn hại?', how: 'Đề hỏi "Do the advantages outweigh the disadvantages?"',
    plan: ['Mở bài: viết lại đề + trả lời luôn: lợi nhiều hơn hay hại nhiều hơn.', 'Thân bài 1: mặt yếu hơn (ví dụ các bất lợi), có ví dụ.', 'Thân bài 2: mặt mạnh hơn (các lợi ích), giải thích vì sao nặng ký hơn.', 'Kết bài: nhắc lại cán cân lợi hại.'],
    phrases: ['The benefits clearly outweigh the drawbacks because…', 'Admittedly, there are some disadvantages…', 'More importantly,…'] },
  posneg: { en: 'Positive or negative development', vn: 'Xu hướng tốt hay xấu', how: 'Đề hỏi "Is this a positive or a negative development?"',
    plan: ['Mở bài: mô tả xu hướng + nói rõ em thấy tốt hay xấu (có thể "phần lớn là tốt").', 'Thân bài 1: lý do chính, ví dụ.', 'Thân bài 2: lý do thứ hai, hoặc thừa nhận mặt ngược lại rồi phản bác.', 'Kết bài: khẳng định lại đánh giá.'],
    phrases: ['This trend is largely positive since…', 'One drawback, however, is…', 'Overall, I consider this a … development.'] },
  twopart: { en: 'Two-part question', vn: 'Đề hai câu hỏi', how: 'Đề có hai câu hỏi riêng, ví dụ "Why is this the case? Is it positive or negative?"',
    plan: ['Mở bài: viết lại đề + trả lời ngắn cả hai câu hỏi.', 'Thân bài 1: trả lời câu hỏi 1 (nguyên nhân…), hai ý có ví dụ.', 'Thân bài 2: trả lời câu hỏi 2 (đánh giá, giải pháp…).', 'Kết bài: tóm tắt cả hai câu trả lời.'],
    phrases: ['There are several reasons for this.', 'The main cause is…', 'As for whether this is beneficial,…'] },
};
const W1 = {
  line: { en: 'Line graph', vn: 'Biểu đồ đường', plan: ['Câu mở: viết lại đề (graph shows… from… to…).', 'Overview: 2 xu hướng lớn nhất (tăng/giảm chung, đường nào cao nhất).', 'Thân 1: nhóm các đường giống nhau, nêu số liệu đầu–cuối, điểm cao/thấp.', 'Thân 2: phần còn lại, so sánh.'], phrases: ['rose steadily from … to …', 'peaked at … in …', 'fluctuated around …'] },
  bar: { en: 'Bar chart', vn: 'Biểu đồ cột', plan: ['Câu mở: viết lại đề.', 'Overview: hạng mục lớn nhất/nhỏ nhất, thay đổi chính.', 'Thân 1: các hạng mục tăng (hoặc nhóm lớn), có số liệu.', 'Thân 2: các hạng mục giảm (hoặc nhóm nhỏ), so sánh.'], phrases: ['accounted for the largest share', 'was twice as high as', 'in contrast,'] },
  mixed: { en: 'Table + pie charts', vn: 'Bảng kèm biểu đồ tròn', plan: ['Câu mở: nói rõ bảng cho biết gì, biểu đồ tròn cho biết gì.', 'Overview: một ý chính cho bảng, một ý chính cho biểu đồ.', 'Thân 1: bảng (số lớn nhất, thay đổi).', 'Thân 2: biểu đồ tròn (phần lớn nhất, phần đổi nhiều nhất).'], phrases: ['made up three quarters of', 'the proportion of … increased from … to …', 'remained unchanged at'] },
  map: { en: 'Maps / floor plans', vn: 'Bản đồ / sơ đồ', plan: ['Câu mở: viết lại đề (trước và sau / hiện tại và dự kiến).', 'Overview: thay đổi lớn nhất (ví dụ khu công nghiệp thành khu dân cư).', 'Thân 1: những gì bị bỏ, thay thế (dùng bị động).', 'Thân 2: những gì được thêm, vị trí (north of, next to…).'], phrases: ['was replaced by', 'a new … has been built to the east of', 'remained in the same place'] },
};
const P2 = {
  person: { vn: 'Người', tip: 'Ai, quen thế nào, tính cách có ví dụ, vì sao quan trọng với em.' },
  place: { vn: 'Nơi chốn', tip: 'Ở đâu, trông thế nào, em làm gì ở đó, cảm giác của em.' },
  object: { vn: 'Đồ vật / công trình', tip: 'Là gì, trông ra sao, gắn với kỷ niệm nào, vì sao em thích.' },
  event: { vn: 'Sự kiện / trải nghiệm', tip: 'Kể theo thời gian: khi nào, chuyện gì, rồi sao, em cảm thấy thế nào.' },
  activity: { vn: 'Hoạt động', tip: 'Làm gì, học từ đâu, các bước, khó khăn, cảm nghĩ.' },
};

// ---------- Dữ liệu ----------
let BANKS = null; // tóm tắt trong index
const FULL = {};  // ngân hàng đã giải mã
async function banks() {
  if (BANKS) return BANKS;
  if (!(await hasVault()) || !savedPass()) return null;
  try { BANKS = (await readJSON('index.enc')).filter(x => x.kind === 'bank'); } catch { return null; }
  return BANKS;
}
async function bank(id) {
  const b = (await banks())?.find(x => x.id === id);
  if (!b) return null;
  return (FULL[id] ??= readJSON(b.file));
}
const done = () => store.get().book || {};
const keyOf = (id, test, part) => `${id}/${test}/${part}`;
const DKEY = k => 'ielts.book.draft.' + k;
const getDraft = k => { try { return JSON.parse(localStorage.getItem(DKEY(k))) || null; } catch { return null; } };
const setDraft = (k, v) => { try { v ? localStorage.setItem(DKEY(k), JSON.stringify(v)) : localStorage.removeItem(DKEY(k)); } catch { /* bỏ qua */ } };
const accent = () => store.get().prefs?.accent || 'en-GB';
const para = s => esc(s).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');

export default async function book(view, [mode, id, test, task] = []) {
  const list = await banks();
  if (!list) {
    view.innerHTML = `<p><a href="#/">← Hôm nay</a></p><h1>${bi('Writing & Speaking theo sách', 'Cambridge Writing & Speaking')}</h1>
      <div class="card"><p>Đề trong sách được mã hóa. Vào <a href="#/exam">Thi thử</a>, nhập mã mở đề một lần, rồi quay lại đây.</p></div>`;
    return;
  }
  if (mode === 'w') return writeTask(view, id, +test, +task);
  if (mode === 's') return speakSet(view, id, +test);
  return menu(view, list, mode === 'speak' ? 'speak' : mode === 't1' ? 't1' : 't2');
}

// ---------- Danh sách theo dạng ----------
function menu(view, list, tab) {
  const d = done();
  const items = list.flatMap(b => b.items.map(it => ({ ...it, id: b.id, book: b.book })));
  const mark = k => d[k] ? `<span class="badge done">Đã làm${d[k].words ? ` · ${d[k].words} từ` : ''}</span>` : '';
  const prog = (arr, part) => { const n = arr.filter(it => d[keyOf(it.id, it.test, part)]).length; return `<span class="badge ${n === arr.length ? 'done' : ''}">${n}/${arr.length}</span>`; };
  const group = (types, field, part, render) => Object.entries(types).map(([t, g]) => {
    const arr = items.filter(it => it[field] === t);
    if (!arr.length) return '';
    return `<details class="exam-group"><summary><b>${esc(g.en || g.vn)}</b> <span class="muted small">· ${esc(g.vn)}</span> ${prog(arr, part)}</summary>
      ${guide(g)}${arr.map(it => render(it)).join('')}</details>`;
  }).join('');
  const w2row = it => `<a class="card task" data-skill="write" href="#/book/w/${it.id}/${it.test}/2"><span class="chip">W2</span><span class="body"><h3>${esc(it.book)} · Test ${it.test} ${mark(keyOf(it.id, it.test, 'w2'))}</h3><div class="meta">${esc(it.w2p)}…</div></span><span class="go">→</span></a>`;
  const w1row = it => `<a class="card task" data-skill="write" href="#/book/w/${it.id}/${it.test}/1"><span class="chip">W1</span><span class="body"><h3>${esc(it.book)} · Test ${it.test} ${mark(keyOf(it.id, it.test, 'w1'))}</h3><div class="meta">${esc(W1[it.w1]?.vn || '')} · 20 phút · ít nhất 150 từ</div></span><span class="go">→</span></a>`;
  const sprow = it => `<a class="card task" data-skill="speak" href="#/book/s/${it.id}/${it.test}"><span class="chip">S</span><span class="body"><h3>${esc(it.book)} · Test ${it.test} ${mark(keyOf(it.id, it.test, 'sp'))}</h3><div class="meta">${esc(it.cue)}</div></span><span class="go">→</span></a>`;
  view.innerHTML = `<p><a href="#/">← Hôm nay</a></p>
    <h1>${bi('Writing & Speaking theo sách', 'Cambridge Writing & Speaking')}</h1>
    <p class="muted small">${list.map(b => esc(b.book)).join(', ')} · luyện theo từng dạng đề. Làm đủ các dạng, mỗi dạng ít nhất 2 bài, rồi mới tăng độ khó.</p>
    <div class="seg" style="margin:8px 0 12px">
      <a class="${tab === 't2' ? 'on' : ''}" href="#/book">Task 2</a><a class="${tab === 't1' ? 'on' : ''}" href="#/book/t1">Task 1</a><a class="${tab === 'speak' ? 'on' : ''}" href="#/book/speak">Speaking</a></div>
    ${tab === 't2' ? `<div class="card"><p class="small">Task 2: 40 phút, ít nhất 250 từ, chiếm 2/3 điểm Writing. Mở từng dạng để xem dàn ý gợi ý.</p></div>${group(W2, 'w2', 'w2', w2row)}`
      : tab === 't1' ? `<div class="card"><p class="small">Task 1 (Academic): 20 phút, ít nhất 150 từ. Bắt buộc có câu overview nêu xu hướng chính; không nêu ý kiến riêng.</p></div>${group(W1, 'w1', 'w1', w1row)}`
      : `<div class="card"><p class="small">Mỗi bộ đủ 3 phần như phòng thi: Part 1 (4 câu ngắn), Part 2 (1 phút chuẩn bị, nói 1–2 phút), Part 3 (thảo luận). Bản ghi gửi về để chấm.</p></div>${group(Object.fromEntries(Object.entries(P2).map(([k, v]) => [k, { vn: v.vn, en: 'Part 2 · ' + v.vn, plan: [v.tip] }])), 'p2', 'sp', sprow)}`}`;
}
function guide(g) {
  if (!g.plan) return '';
  return `<div class="card" style="background:var(--soft, rgba(0,0,0,.03))">
    ${g.how ? `<p class="small"><b>Nhận dạng:</b> ${esc(g.how)}</p>` : ''}
    <p class="small"><b>${g.plan.length > 1 ? 'Dàn ý gợi ý' : 'Gợi ý'}:</b></p><ol class="small" style="margin:0 0 0 18px">${g.plan.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${g.phrases ? `<p class="small" style="margin-top:6px"><b>Cụm hay dùng:</b> ${g.phrases.map(x => `<i>${esc(x)}</i>`).join(' · ')}</p>` : ''}</div>`;
}

// ---------- Viết ----------
function sampleHTML(s) {
  if (!s) return '<p class="meta">Sách không có bài mẫu cho đề này.</p>';
  const head = s.band ? `Bài của thí sinh đạt <b>Band ${esc(s.band)}</b>` : '<b>Bài mẫu do giám khảo viết</b> (mức rất tốt)';
  if (s.images) return `<p class="small">${head}. Ảnh trang sách, giữ nguyên lỗi của thí sinh và nhận xét của giám khảo.</p>${s.images.map(u => /^data:image\/jpeg;base64,/.test(u) ? `<img class="exam-img" src="${u}" alt="Bài mẫu trong sách">` : '').join('')}`;
  return `<p class="small">${head}. Giữ nguyên lỗi của thí sinh.</p><div class="passage">${s.text.map(p => `<p>${esc(p)}</p>`).join('')}</div>
    ${s.comment.length ? `<p class="eyebrow" style="margin-top:10px">Nhận xét của giám khảo</p>${s.comment.map(p => `<p class="small">${esc(p)}</p>`).join('')}` : ''}`;
}
async function writeTask(view, id, test, task) {
  view.innerHTML = '<p class="muted">Đang mở đề…</p>';
  const b = await bank(id);
  const t = b?.tests.find(x => x.test === test);
  if (!t || ![1, 2].includes(task)) { view.innerHTML = '<div class="card"><p>Không mở được đề.</p><a class="btn" href="#/book">Về danh sách</a></div>'; return; }
  const w = task === 1 ? t.w1 : t.w2;
  const k = keyOf(id, test, 'w' + task), mins = task === 1 ? 20 : 40, minWords = task === 1 ? 150 : 250;
  const label = `${b.book} Test ${test} · Task ${task}`;
  const g = task === 1 ? W1[w.type] : W2[w.type];
  let dr = getDraft(k);
  const prev = done()[k];
  view.innerHTML = `<p><a href="#/book${task === 1 ? '/t1' : ''}">← Writing & Speaking</a></p>
    <div class="timer" data-timer>⏱ ${mins}:00</div>
    <h1>${esc(label)}</h1>
    <div class="card"><p class="eyebrow">${esc(g?.en || '')} · ${mins} phút · ít nhất ${minWords} từ</p>
      <p><b>${para(w.prompt)}</b></p>
      ${task === 1 && /^data:image\/jpeg;base64,/.test(w.image) ? `<img class="exam-img" src="${w.image}" alt="Biểu đồ của đề">` : ''}
      <details><summary class="small">Dàn ý gợi ý cho dạng này</summary>${guide(g || {})}</details></div>
    ${prev ? `<div class="card"><p class="small">Em đã nộp đề này ngày ${new Date(prev.ts).toLocaleDateString('vi-VN')} (${prev.words} từ). Viết lại lần nữa cũng được.</p></div>` : ''}
    <div class="card" data-editor>
      ${dr ? '' : `<button class="btn block" data-go>Bắt đầu viết (tính giờ ${mins} phút)</button>`}
      <div data-area ${dr ? '' : 'hidden'}>
        <p class="eyebrow">Bài viết · <span data-wc>0</span> từ</p>
        <textarea class="inp" data-text rows="14" placeholder="Viết bài ở đây. App tự lưu khi em gõ.">${esc(dr?.text || '')}</textarea>
        <button class="btn block" data-send>Nộp bài để chấm</button>
        <p class="muted small">Bài nộp được chấm lúc 22h, điểm và nhận xét hiện ở mục Bài viết của em.</p>
      </div></div>
    <div class="card"><details data-sample><summary><b>Bài mẫu trong sách</b> <span class="muted small">(nên xem sau khi viết xong)</span></summary>${sampleHTML(w.sample)}</details></div>`;
  const timerEl = view.querySelector('[data-timer]'), area = view.querySelector('[data-area]'), ta = view.querySelector('[data-text]'), wc = view.querySelector('[data-wc]');
  let stopTimer = null;
  const startTimer = () => { stopTimer?.(); stopTimer = countdown(timerEl, Math.round(dr.start / 1000 + mins * 60 - Date.now() / 1000), () => { timerEl.textContent = 'Hết giờ'; }); };
  const save = () => { dr.text = ta.value; setDraft(k, dr); wc.textContent = wordCount(ta.value); };
  if (dr) { startTimer(); save(); }
  view.querySelector('[data-go]')?.addEventListener('click', e => { dr = { start: Date.now(), text: '' }; setDraft(k, dr); e.target.remove(); area.hidden = false; startTimer(); ta.focus(); });
  ta.oninput = save;
  view.querySelector('[data-send]').onclick = async e => {
    const words = wordCount(ta.value);
    if (words < 50) { alert('Bài còn quá ngắn để chấm (dưới 50 từ).'); return; }
    const used = Math.max(1, Math.round((Date.now() - dr.start) / 60000));
    e.target.disabled = true; e.target.textContent = 'Đang nộp…';
    try {
      await store.api({ action: 'writing', prompt: `[${label}] ${w.prompt.replace(/\n+/g, ' ')}`, text: ta.value, words, minutes: used, source: `Sách: ${label}` });
    } catch { e.target.disabled = false; e.target.textContent = 'Nộp lại'; alert('Chưa gửi được, kiểm tra mạng rồi bấm Nộp lại. Bài vẫn được giữ trên máy.'); return; }
    store.update(s => { (s.book ||= {})[k] = { ts: Date.now(), words, mins: used }; (s.exams ||= []).push({ ts: Date.now(), skill: 'writing', src: 'cam', label, words, mins: used }); });
    store.logAttempt({ item: `BK-${k}`, skill: 'W', type: `W-${task === 1 ? 't1-' : 't2-'}${w.type}`, correct: words >= minWords, detail: `${words} từ / ${used} phút` });
    setDraft(k, null); stopTimer?.();
    view.querySelector('[data-editor]').innerHTML = `<div class="result-big"><h3>Đã nộp bài ✅</h3><p class="meta">${words} từ trong ${used} phút${words < minWords ? ` · còn thiếu ${minWords - words} từ so với yêu cầu, thi thật sẽ bị trừ điểm` : ''}. Bài sẽ được chấm lúc 22h.</p>
      <p class="small">Giờ mở bài mẫu bên dưới, so cách mở bài, overview và từ nối với bài của em.</p></div>`;
    view.querySelector('[data-sample]').open = true;
    confetti(40);
  };
  return () => stopTimer?.();
}

// ---------- Nói ----------
async function speakSet(view, id, test) {
  view.innerHTML = '<p class="muted">Đang mở đề…</p>';
  const b = await bank(id);
  const t = b?.tests.find(x => x.test === test);
  if (!t) { view.innerHTML = '<div class="card"><p>Không mở được đề.</p><a class="btn" href="#/book/speak">Về danh sách</a></div>'; return; }
  const sp = t.sp, label = `${b.book} Test ${test}`, k = keyOf(id, test, 'sp');
  const cleanups = [];
  const qBlock = (q, part, i) => `<div class="qitem" data-sq="${part}-${i}"><p><b>${esc(q)}</b> <button class="say" data-say="${esc(q.replace(/\s*\[.*?\]\s*/g, ' '))}">🔊</button></p><div data-rec></div><p class="small muted" data-live></p><div data-res></div></div>`;
  view.innerHTML = `<p><a href="#/book/speak">← Writing & Speaking</a></p>
    <h1>${bi(`Speaking · ${label}`, 'Part 1 · Part 2 · Part 3')}</h1>
    <div class="card"><p class="eyebrow">Part 1 · ${esc(sp.p1.topic)} · 4–5 phút cả phần</p>
      <p class="muted small">Mỗi câu nói 20–30 giây: trả lời thẳng, thêm lý do, thêm ví dụ.</p>
      ${sp.p1.qs.map((q, i) => qBlock(q, 'p1', i)).join('')}</div>
    <div class="card"><p class="eyebrow">Part 2 · ${esc(P2[sp.p2.type]?.vn || '')}</p>
      <div class="cuecard" style="border:1px solid var(--line,#ddd);border-radius:10px;padding:12px">
        <p><b>${esc(sp.p2.cue)}</b> <button class="say" data-say="${esc(sp.p2.cue)}">🔊</button></p><p class="small">You should say:</p>
        <ul class="small" style="margin:0 0 6px 18px">${sp.p2.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="small">${esc(sp.p2.explain)}</p></div>
      <p class="muted small">Gợi ý: ${esc(P2[sp.p2.type]?.tip || '')} Ghi chú từ khóa, không viết cả câu.</p>
      <div class="row"><button class="btn" data-prep>⏳ 1 phút chuẩn bị</button><span class="timer" data-ptimer style="position:static"></span></div>
      <textarea class="inp" data-notes rows="3" placeholder="Ghi chú nhanh (chỉ em xem)"></textarea>
      <div class="qitem" data-sq="p2-0"><p class="small"><b>Nói 1–2 phút</b> (tối đa 2 phút, máy tự dừng).</p><div data-rec></div><p class="small muted" data-live></p><div data-res></div></div></div>
    <div class="card"><p class="eyebrow">Part 3 · Thảo luận · 4–5 phút</p>
      <p class="muted small">Câu trả lời dài hơn Part 1 (40–60 giây): nêu ý, giải thích, ví dụ, có thể so sánh xưa và nay.</p>
      ${sp.p3.map((g, gi) => `<p class="small" style="margin-top:8px"><b>${esc(g.topic)}</b></p>${g.qs.map((q, i) => qBlock(q, 'p3', gi * 10 + i)).join('')}`).join('')}</div>`;

  view.querySelectorAll('[data-say]').forEach(btn => { btn.onclick = () => { stopTTS(); say(btn.dataset.say, { lang: accent() }); }; });
  view.querySelector('[data-prep]').onclick = e => {
    e.target.disabled = true;
    const tEl = view.querySelector('[data-ptimer]');
    const stop = countdown(tEl, 60, () => { tEl.textContent = 'Bắt đầu nói!'; stop(); view.querySelector('[data-sq="p2-0"] [data-rec] button')?.focus(); });
    cleanups.push(stop);
  };
  view.querySelectorAll('[data-sq]').forEach(box => {
    const [part, idx] = box.dataset.sq.split('-');
    const q = part === 'p1' ? sp.p1.qs[+idx] : part === 'p2' ? sp.p2.cue : sp.p3[Math.floor(+idx / 10)].qs[+idx % 10];
    const maxSec = part === 'p1' ? 45 : part === 'p2' ? 120 : 75;
    const live = box.querySelector('[data-live]'), res = box.querySelector('[data-res]');
    cleanups.push(recorderWidget(box.querySelector('[data-rec]'), {
      maxSec, transcribe: true,
      onLive: tx => { live.innerHTML = `<i>${esc(tx)}</i>`; },
      onDone: async (blob, mime, info) => {
        const text = info?.text || '', words = wordCount(text), sec = info?.sec || 0;
        const need = part === 'p1' ? 25 : part === 'p2' ? 120 : 50;
        const ok = words >= need;
        store.logAttempt({ item: `BK-${k}-${part}-${idx}`, skill: 'S', type: `S-${part === 'p2' ? 'part2' : part === 'p3' ? 'part3' : 'part1'}`, correct: ok, detail: `${words} từ, ${sec}s | ${text.slice(0, 300)}` });
        if (part === 'p2') store.update(s => { (s.book ||= {})[k] = { ts: Date.now(), sec }; });
        res.innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}"><b>${text ? `Máy nghe được ${words} từ trong ${mmss(sec)}` : 'Máy không nghe ra chữ nào'}</b>
          ${text ? `<p class="small">${esc(text)}</p>` : ''}
          <p class="small muted">${part === 'p2' ? (sec < 60 ? 'Part 2 nên nói đủ ít nhất 1 phút: kể thêm chi tiết cho từng gạch đầu dòng.' : 'Đủ thời lượng Part 2.') : ok ? 'Độ dài ổn.' : 'Còn ngắn: thêm lý do và một ví dụ.'}</p>
          <p class="small" data-up>${store.apiOn() ? 'Đang gửi bản ghi…' : ''}</p></div>`;
        if (!store.apiOn()) return;
        const up = res.querySelector('[data-up]');
        try {
          await store.api({ action: 'audio', data: await blobToBase64(blob), mime, question: q, label: `book-${id}-t${test}-${part}`, source: `Speaking ${label} ${part.toUpperCase()}`, transcript: text, words, seconds: sec });
          up.textContent = 'Đã gửi bản ghi về bảng tính để chấm.';
        } catch (err) { up.textContent = 'Gửi không được: ' + err.message; }
      },
    }));
  });
  return () => { cleanups.forEach(c => { try { c?.(); } catch { /* bỏ qua */ } }); stopTTS(); };
}
