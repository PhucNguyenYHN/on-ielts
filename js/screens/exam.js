// Thi thử bằng đề chính thức: mở đề trên trang gốc (British Council, ielts.org, IDP) hoặc sách Cambridge của em,
// app bấm giờ như phòng thi, em nhập số câu đúng, app quy đổi band và lưu lịch sử.
// Writing: viết ngay trong app, nộp để phiên chấm 22h chấm như bài thường.
import * as store from '../store.js';
import { esc, bi, wordCount } from '../util.js';
import { toBand } from '../engine.js';
import { confetti, ring } from '../fx.js';

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

export default function exam(view) {
  const run = getRun();
  if (run) return running(view, run);
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
    <div class="card">
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
