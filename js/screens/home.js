import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { esc, streak, weekCount, today, loadContent, xung } from '../util.js';
import { dueIds, learnedCount } from '../srs.js';
import { recommendLesson, newWordsLeft, PLACEMENT_SECTIONS, toBand } from '../engine.js';
import { savedPass, readJSON } from '../vault.js';
import { icon } from '../icons.js';
import { ring } from '../fx.js';

const DAILY_MINUTES = 30; // mục tiêu phút học mỗi ngày cho vòng tiến độ

// Câu động viên đổi theo ngày
const QUOTES = [
  'Mỗi ngày một chút, 5.5 sẽ đến sớm hơn em nghĩ.',
  'Không cần hoàn hảo, chỉ cần đều đặn.',
  'Hôm nay học 15 phút còn hơn mai học 2 tiếng.',
  'Sai hôm nay là đúng ngày thi.',
  'Từ nào em nhớ hôm nay là của em mãi mãi.',
  'Dược sĩ giỏi tiếng Anh sẽ đọc được cả thế giới tài liệu.',
  'Chậm mà chắc, chuỗi ngày học là vũ khí mạnh nhất.',
];

// Câu động viên cho người học giao tiếp, nghe hội thảo (không thi IELTS)
const QUOTES_B1 = [
  'Không cần hoàn hảo, chỉ cần đều đặn.',
  'Hôm nay học 15 phút còn hơn mai học 2 tiếng.',
  'Nghe được một câu hôm nay là nghe được câu đó ở hội thảo.',
  'Nói sai mà người ta hiểu vẫn hơn im lặng.',
  'Một bài nghe kỹ có ích hơn năm bài nghe lướt.',
  'Chuyên môn anh đã có, tiếng Anh chỉ là cây cầu.',
  'Chậm mà chắc, chuỗi ngày học là vũ khí mạnh nhất.',
];

function greet() {
  const h = new Date().getHours();
  return h < 11 ? ['Chào buổi sáng', '☀️'] : h < 14 ? ['Chào buổi trưa', '🌤️'] : h < 18 ? ['Chào buổi chiều', '🌇'] : ['Chào buổi tối', '🌙'];
}

function streakNote(n) {
  if (n >= 30) return `${n} ngày liền, phi thường! 🏆`;
  if (n >= 7) return `${n} ngày liền, em đang tạo thói quen rất tốt 🔥`;
  if (n >= 3) return `${n} ngày liên tục, giữ lửa nhé 🔥`;
  if (n >= 1) return 'Đã học hôm nay, tuyệt!';
  return 'Bắt đầu chuỗi ngày học từ hôm nay nhé';
}

// ----- Lịch tuần (IELTS): mỗi ngày một kỹ năng trọng tâm, bài lấy lần lượt từ đề trong app -----
// 0 = Chủ nhật … 6 = Thứ Bảy (theo Date.getDay)
const FOCUS = { 1: 'R', 2: 'L', 3: 'W1', 4: 'R', 5: 'S', 6: 'W2', 0: 'X' };
const FOCUS_NAME = { R: 'Reading', L: 'Listening', W1: 'Writing Task 1', W2: 'Writing Task 2', S: 'Speaking', X: 'Thi thử' };
const isToday = ts => today(new Date(ts)) === today();

// Bài kế tiếp chưa làm cho trọng tâm hôm nay
async function focusTask(s, f) {
  let list = null;
  if (savedPass()) { try { list = await readJSON('index.enc'); } catch { list = null; } }
  if (!list) return { k: f[0], skill: 'test', href: '#/exam', title: `${FOCUS_NAME[f]}: nhập mã mở đề`, meta: 'Vào Thi thử nhập mã một lần để app tự chọn bài cho từng ngày', mins: '1 phút', done: false };
  const ex = s.exams || [];
  const tests = list.filter(t => t.kind !== 'bank' && !t.practice);
  if (f === 'R' || f === 'L') {
    const skill = f === 'R' ? 'reading' : 'listening', n = f === 'R' ? 3 : 4;
    const doneToday = ex.some(x => x.skill === skill && x.src === 'app' && isToday(x.ts));
    for (const t of tests.filter(t => t.skill === skill)) {
      if (ex.some(x => x.testId === t.id && x.part == null && x.band)) continue; // cả đề đã làm
      for (let k = 0; k < n; k++) {
        if (ex.some(x => x.testId === t.id && x.part === k && !isToday(x.ts))) continue;
        const name = t.title.replace(/^Cambridge IELTS (\d+) · /, 'Cam $1 · ').replace(' · Academic Reading', '').replace(' · Listening', '');
        return { k: f, skill: f === 'R' ? 'read' : 'listen', href: `#/exam/app/${encodeURIComponent(t.id)}/${k}`, title: `${f === 'R' ? 'Một bài đọc' : 'Một part nghe'}: ${esc(name)} · ${f === 'R' ? 'Passage' : 'Part'} ${k + 1}`, meta: f === 'R' ? '13–14 câu, chấm ngay, chữa từng câu' : '10 câu, nghe một lần, có lời thoại sau khi chấm', mins: f === 'R' ? '20 phút' : '10 phút', done: doneToday };
      }
    }
  }
  if (f === 'X') {
    const wk = Math.floor((Date.now() / 864e5 + 3) / 7); // đổi kỹ năng mỗi tuần
    const skill = wk % 2 ? 'reading' : 'listening';
    const t = tests.find(t => t.skill === skill && !ex.some(x => x.testId === t.id && x.part == null)) || tests.find(t => t.skill === skill);
    if (t) return { k: 'X', skill: 'test', href: `#/exam/app/${encodeURIComponent(t.id)}`, title: `Thi thử Chủ nhật: ${skill === 'reading' ? 'Reading' : 'Listening'} cả đề`, meta: `${esc(t.title)} · tính band, tuần sau đổi kỹ năng`, mins: `${t.mins} phút`, done: ex.some(x => x.testId === t.id && x.part == null && isToday(x.ts)) };
  }
  const banks = list.filter(t => t.kind === 'bank');
  if (banks.length && (f === 'W1' || f === 'W2' || f === 'S')) {
    const bk = s.book || {}, part = f === 'W1' ? 'w1' : f === 'W2' ? 'w2' : 'sp';
    const items = banks.flatMap(b => b.items.map(it => ({ ...it, id: b.id, book: b.book })));
    const doneToday = Object.entries(bk).some(([k, v]) => k.endsWith('/' + part) && isToday(v.ts));
    // dạng đã luyện ít nhất lên trước (W: kiểu bài; S: chủ đề Part 2)
    const typeOf = it => f === 'W1' ? it.w1 : f === 'W2' ? it.w2 : it.p2;
    const cnt = {};
    items.forEach(it => { cnt[typeOf(it)] ??= 0; if (bk[`${it.id}/${it.test}/${part}`]) cnt[typeOf(it)]++; });
    const todo = items.filter(it => !bk[`${it.id}/${it.test}/${part}`]).sort((a, b) => cnt[typeOf(a)] - cnt[typeOf(b)]);
    const it = todo[0] || items[0];
    const href = f === 'S' ? `#/book/s/${it.id}/${it.test}` : `#/book/w/${it.id}/${it.test}/${f === 'W1' ? 1 : 2}`;
    return { k: f === 'S' ? 'S' : 'W', skill: f === 'S' ? 'speak' : 'write', href, title: `${FOCUS_NAME[f]}: ${esc(it.book)} Test ${it.test}`, meta: f === 'S' ? esc(it.cue) : f === 'W1' ? 'Mô tả biểu đồ, ít nhất 150 từ, nộp để chấm lúc 22h' : 'Viết luận, ít nhất 250 từ, nộp để chấm lúc 22h', mins: f === 'W2' ? '40 phút' : f === 'W1' ? '20 phút' : '15 phút', done: doneToday };
  }
  return null;
}

// Band dự đoán từng kỹ năng: trung bình 3 lần gần nhất (cả đề), chưa có thì ước từ bài luyện từng phần
function predicted(s) {
  const ex = s.exams || [];
  const out = {};
  for (const skill of ['listening', 'reading']) {
    const full = ex.filter(x => x.skill === skill && x.band).slice(-3);
    if (full.length) { out[skill] = { band: Math.round(full.reduce((a, x) => a + x.band, 0) / full.length * 2) / 2, from: `${full.length} đề gần nhất` }; continue; }
    const parts = ex.filter(x => x.skill === skill && x.part != null && x.total).slice(-6);
    if (parts.length >= 2) { const r = parts.reduce((a, x) => a + x.raw, 0) / parts.reduce((a, x) => a + x.total, 0); out[skill] = { band: toBand(Math.round(r * 40), 40, skill), from: `ước từ ${parts.length} phần đã luyện` }; }
  }
  const w = store.cachedWritings().map(x => parseFloat(x.score)).filter(x => x > 0).slice(0, 3);
  if (w.length) out.writing = { band: Math.round(w.reduce((a, b) => a + b, 0) / w.length * 2) / 2, from: `${w.length} bài đã chấm` };
  return out;
}

const task = (skill, href, ic, title, meta, badge = '') => `<a class="card task" data-skill="${skill}" href="${href}">
  <span class="chip">${icon(ic, 24)}</span>
  <span class="body"><h3>${title} ${badge}</h3><div class="meta">${meta}</div></span>
  <span class="go">${icon('arrow', 20)}</span></a>`;

export default async function home(view) {
  const [vocab, grammar] = await Promise.all([loadContent('vocab'), loadContent('grammar')]);
  const s = store.get();
  const exam = CONFIG.examDate ? new Date(CONFIG.examDate + 'T00:00:00') : null;
  const daysLeft = exam ? Math.max(0, Math.ceil((exam - new Date()) / 864e5)) : null;
  const due = dueIds(s.srs).length;
  const fresh = Math.min(newWordsLeft(s, CONFIG.newWordsPerDay), vocab.filter(v => !s.srs[v.w]).length);
  const pDone = PLACEMENT_SECTIONS.filter(k => s.placement[k]).length;
  const rec = recommendLesson(s, grammar);
  const mins = Math.round(s.days[today()] || 0);
  const st = streak(s.days);
  const learned = learnedCount(s.srs);
  const [hello, emoji] = greet();
  const Q = CONFIG.ielts ? QUOTES : QUOTES_B1;
  const quote = xung(Q[Math.floor(Date.now() / 864e5) % Q.length]);

  // ----- Kỹ năng hôm nay đã làm chưa, kỹ năng nào yếu nhất -----
  const SKILL_OF = t => (t || '').startsWith('V-') ? 'V' : (t || '').startsWith('L-') ? 'L' : (t || '').startsWith('G') ? 'G' : (t || '').startsWith('S-') ? 'S' : '';
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const todayK = new Set(s.attempts.filter(a => a.ts >= t0.getTime()).map(a => a.k || SKILL_OF(a.t)));
  const acc = {};
  for (let k = s.attempts.length - 1; k >= 0; k--) {
    const a = s.attempts[k], sk = a.k || SKILL_OF(a.t);
    if (!sk) continue;
    const b = (acc[sk] ||= { n: 0, ok: 0 });
    if (b.n < 30) { b.n++; b.ok += a.c; }
  }
  const pool = CONFIG.ielts ? ['V', 'G', 'S'] : ['V', 'L', 'S'];
  const weak = pool.filter(k => acc[k]?.n >= 5).sort((a, b) => acc[a].ok / acc[a].n - acc[b].ok / acc[b].n)[0];

  // ----- Kế hoạch hôm nay: mỗi việc có chữ cái kỹ năng, thời lượng, trạng thái xong -----
  const plan = [];
  const add = (k, skill, href, title, meta, mins, done) => plan.push({ k, skill, href, title, meta, mins, done });
  add('V', 'vocab', '#/vocab/learn', 'Học từ mới', fresh ? `${fresh} từ · xem nghĩa, chọn nghĩa, viết lại` : 'Đã học đủ từ mới hôm nay', '10 phút', !fresh);
  if (due || todayK.has('V')) add('V', 'vocab', '#/vocab/review', 'Ôn thẻ đến hạn', due ? `${due} thẻ cần nhớ lại` : 'Không còn thẻ đến hạn', '5 phút', !due);
  const dow = new Date().getDay();
  if (CONFIG.ielts && rec && [1, 3, 5, 0].includes(dow)) add('G', 'grammar', `#/grammar/${esc(rec.lesson.id)}`, `Ngữ pháp: ${esc(rec.lesson.title)}`, esc(rec.why), '10 phút', todayK.has('G'));
  if (!CONFIG.ielts) {
    // Bài đầu tiên chưa đủ 85% ở cả 3 bước (câu hỏi, nghe chép, nói nhại)
    const L = s.listen || {}, ok = k => (L[k] ?? 0) >= 85;
    let n = 1;
    while (n < 10 && ok('T' + n) && ok(`T${n}-chep`) && ok(`T${n}-nhai`)) n++;
    const id = 'T' + n;
    const [href, what] = !ok(id) ? [`#/listen/${id}`, 'nghe và trả lời câu hỏi'] : !ok(`${id}-chep`) ? [`#/listen/${id}/chep`, 'nghe chép từng câu'] : [`#/listen/${id}/nhai`, 'nói nhại từng câu'];
    add('L', 'listen', href, `Nghe hội thảo · bài ${n}`, `Bước tiếp theo: ${what}`, '15 phút', todayK.has('L'));
  }
  if (CONFIG.ielts) {
    const ft = await focusTask(s, FOCUS[dow]);
    if (ft) plan.push({ ...ft, focus: true });
  }
  if (!CONFIG.ielts || [2, 4, 6].includes(dow)) add('S', 'speak', CONFIG.ielts ? '#/speak' : '#/speak/part1/0', CONFIG.ielts ? 'Luyện nói' : 'Luyện trò chuyện', CONFIG.ielts ? 'Đọc to 5 câu, máy nghe ra đúng chữ là đạt' : 'Tự giới thiệu, nói về công việc, hỏi ở hội thảo', '5 phút', todayK.has('S'));
  // Kỹ năng yếu nhất lên đầu những việc chưa xong
  plan.forEach(x => { x.weak = x.k === weak && !x.done; });
  plan.sort((a, b) => (a.done - b.done) || ((b.focus ? 1 : 0) - (a.focus ? 1 : 0)) || (b.weak - a.weak));
  const pred = CONFIG.ielts ? predicted(s) : {};
  const doneN = plan.filter(x => x.done).length;

  const extra = [];
  const graded = store.unseenGraded();
  if (graded.length) extra.push(task('write', `#/writing/${graded[0].ts}`, 'pen', 'Bài viết đã có điểm', `${graded[0].score ? `Band ${esc(graded[0].score)}. ` : ''}Mở xem nhận xét và cách sửa lỗi.`, '<span class="badge warn">Mới</span>'));
  if (CONFIG.ielts && pDone < PLACEMENT_SECTIONS.length) extra.push(task('test', '#/placement', 'test', 'Kiểm tra đầu vào', `Đã xong ${pDone}/${PLACEMENT_SECTIONS.length} phần. Có thể chia làm nhiều buổi.`, '<span class="badge warn">Làm trước</span>'));
  if (!s.device?.ok) extra.push(task('speak', '#/mic', 'mic', 'Thử micro', 'Kiểm tra ghi âm và nhận giọng nói trên máy này.', '<span class="badge">1 phút</span>'));
  const canDictate = Object.values(s.srs).filter(c => c.reps >= 2).length >= 5;
  if (canDictate) extra.push(task('listen', '#/vocab/dictation', 'headphones', 'Nghe và gõ từ', CONFIG.ielts ? 'Nghe từ đã ôn rồi viết lại, luyện chính tả cho Listening.' : 'Nghe từ đã ôn rồi viết lại, luyện tai.', '<span class="badge">10 từ</span>'));
  if (CONFIG.ielts) {
    const ex = s.exams || [], lastEx = ex[ex.length - 1];
    const ago = lastEx ? Math.floor((Date.now() - lastEx.ts) / 864e5) : null;
    const running = (() => { try { return !!localStorage.getItem('ielts.exam.run'); } catch { return false; } })();
    extra.unshift(task('test', '#/exam', 'test', running ? 'Đang làm bài thi thử' : 'Thi thử đề chính thức',
      running ? 'Đồng hồ vẫn đang chạy. Bấm để quay lại bài.' : lastEx ? `Lần gần nhất ${ago ? ago + ' ngày trước' : 'hôm nay'}${lastEx.band ? ` · ${lastEx.skill === 'listening' ? 'Listening' : 'Reading'} band ${lastEx.band}` : ''}. Nên làm 1 đề mỗi tuần.` : 'Đề của British Council, IDP, ielts.org hoặc sách Cambridge. App bấm giờ và quy đổi band.',
      running ? '<span class="badge warn">Đang làm</span>' : (ago == null || ago >= 7) ? '<span class="badge">Tuần này</span>' : ''));
    const bk = Object.keys(s.book || {}).length;
    extra.push(task('write', '#/book', 'pen', 'Writing & Speaking theo sách', `Đề Cam 17, 18 chia theo dạng: Task 1, Task 2, Speaking 3 phần, có bài mẫu.${bk ? ` Đã làm ${bk} bài.` : ''}`, '<span class="badge">Mới</span>'));
    extra.push(task('write', '#/writing', 'book', 'Bài viết của em', 'Xem điểm và nhận xét các bài Writing đã nộp.'));
  }

  // ----- Dải điểm danh tuần (Thứ 2 → Chủ nhật) -----
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const dayOf = k => { const d = new Date(mon); d.setDate(mon.getDate() + k); return d; };
  const studied = d => (s.days[today(d)] || 0) >= 1;
  const week = DAYS.map((lb, k) => {
    const d = dayOf(k), on = studied(d), isT = today(d) === today();
    return `<div class="d ${on ? 'on' : ''} ${isT ? 'now' : ''}">${lb}<i>${on ? '✓' : d.getDate()}</i></div>`;
  }).join('');
  const weekDays = DAYS.filter((_, k) => studied(dayOf(k))).length;

  const L = s.listen || {};
  const talksDone = [...Array(10)].filter((_, k) => ['', '-chep', '-nhai'].every(x => (L[`T${k + 1}${x}`] ?? 0) >= 85)).length;
  const dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });

  view.innerHTML = `
    <div class="greet">
      <img src="icons/icon-180.png?v=1" alt="">
      <div><h1>${hello}, ${esc(CONFIG.learner)} ${emoji}</h1><div class="meta">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div></div>
    </div>
    <div class="kpis">
      <div class="kpi"><b class="${st ? 'hot' : ''}">${st}${st ? ' 🔥' : ''}</b><span>Chuỗi ngày</span></div>
      <div class="kpi"><b>${learned}</b><span>Từ đã thuộc</span></div>
      ${exam ? `<div class="kpi"><b>${daysLeft}</b><span>Ngày đến kỳ thi</span></div>` : `<div class="kpi"><b>${talksDone}/10</b><span>Bài nghe hoàn thành</span></div>`}
      <div class="kpi"><b>${CONFIG.target ? esc(CONFIG.target) : 'B1'}</b><span>Mục tiêu</span></div>
    </div>

    <div class="section">
      <div class="plan-head">
        <div><p class="eyebrow">Tuần này · ${weekDays}/7 ngày học</p><h2>Điểm danh</h2></div>
        <span class="badge">${mins}/${DAILY_MINUTES} phút</span>
      </div>
      <div class="week">${week}</div>
      <p class="quote">${quote}</p>
    </div>

    <div class="card">
      <div class="plan-head">
        <div><p class="eyebrow">Kế hoạch hằng ngày${CONFIG.ielts ? ` · trọng tâm ${FOCUS_NAME[FOCUS[dow]]}` : ''}</p><h2>Hôm nay</h2></div>
        <span class="donering">${ring(plan.length ? doneN / plan.length : 0, { size: 58, stroke: 6, label: `${doneN}/${plan.length}` })}</span>
      </div>
      ${plan.map(x => `<a class="card task ${x.done ? 'done' : ''} ${x.weak ? 'focus' : ''}" data-skill="${x.skill}" href="${x.href}">
        <span class="chip">${x.done ? '✓' : x.k}</span>
        <span class="body"><h3>${x.title} ${x.focus ? '<span class="badge warn">Trọng tâm hôm nay</span>' : ''}${x.weak ? '<span class="tag-weak">Kỹ năng yếu nhất</span>' : ''}</h3><div class="meta">${x.meta} · ${x.mins}</div></span>
        <span class="go">${icon('arrow', 18)}</span></a>`).join('')}
      ${doneN === plan.length ? '<p class="small" style="text-align:center;color:var(--good);font-weight:700">Xong hết việc hôm nay 🎉</p>' : ''}
      ${CONFIG.ielts ? `<div class="weekplan">${[1, 2, 3, 4, 5, 6, 0].map(d => `<span class="${d === dow ? 'on' : ''}"><b>${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]}</b>${{ R: 'Đọc', L: 'Nghe', W1: 'Viết 1', W2: 'Viết 2', S: 'Nói', X: 'Thi thử' }[FOCUS[d]]}</span>`).join('')}</div>
        <p class="muted small" style="margin:6px 0 0">Ngày nào cũng có từ mới và ôn thẻ; ngữ pháp T2·T4·T6·CN, đọc to T3·T5·T7.</p>` : ''}
    </div>
    ${CONFIG.ielts ? `<div class="card"><p class="eyebrow">Band dự đoán · mục tiêu ${esc(CONFIG.target || '5.5')}</p>
      <div class="kpis" style="margin:6px 0 0">${[['listening', 'Listening'], ['reading', 'Reading'], ['writing', 'Writing'], ['speaking', 'Speaking']].map(([k, n]) => `<div class="kpi"><b>${pred[k] ? pred[k].band : '–'}</b><span>${n}</span><span class="muted small" style="font-size:.7rem">${pred[k] ? esc(pred[k].from) : k === 'speaking' ? 'chấm qua bản ghi' : 'chưa có bài'}</span></div>`).join('')}</div></div>` : ''}

    <div class="card">
      <p class="eyebrow">Lộ trình</p>
      ${CONFIG.ielts
        ? '<div class="road2"><span class="st now">4.5</span><span class="ln"></span><span class="st">5.0</span><span class="ln"></span><span class="st goal">5.5 🎯</span><span class="ln"></span><span class="st">6.5</span></div>'
        : '<div class="road2"><span class="st now">A2</span><span class="ln"></span><span class="st goal">B1 🎯</span><span class="ln"></span><span class="st">Nghe hội thảo</span></div>'}
    </div>

    ${extra.length ? `<p class="eyebrow" style="margin:18px 0 8px">Thêm</p>${extra.join('')}` : ''}
    <p class="muted small" style="text-align:center;margin-top:16px">Buổi ngắn 10–15 phút: học và ôn từ. Buổi dài 30–45 phút: làm hết kế hoạch hôm nay.</p>`;
}
