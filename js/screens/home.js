import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { esc, streak, weekCount, today, loadContent, xung } from '../util.js';
import { dueIds, learnedCount } from '../srs.js';
import { recommendLesson, newWordsLeft, PLACEMENT_SECTIONS } from '../engine.js';
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
  if (CONFIG.ielts && rec) add('G', 'grammar', `#/grammar/${esc(rec.lesson.id)}`, `Ngữ pháp: ${esc(rec.lesson.title)}`, esc(rec.why), '10 phút', todayK.has('G'));
  if (!CONFIG.ielts) {
    // Bài đầu tiên chưa đủ 85% ở cả 3 bước (câu hỏi, nghe chép, nói nhại)
    const L = s.listen || {}, ok = k => (L[k] ?? 0) >= 85;
    let n = 1;
    while (n < 10 && ok('T' + n) && ok(`T${n}-chep`) && ok(`T${n}-nhai`)) n++;
    const id = 'T' + n;
    const [href, what] = !ok(id) ? [`#/listen/${id}`, 'nghe và trả lời câu hỏi'] : !ok(`${id}-chep`) ? [`#/listen/${id}/chep`, 'nghe chép từng câu'] : [`#/listen/${id}/nhai`, 'nói nhại từng câu'];
    add('L', 'listen', href, `Nghe hội thảo · bài ${n}`, `Bước tiếp theo: ${what}`, '15 phút', todayK.has('L'));
  }
  add('S', 'speak', CONFIG.ielts ? '#/speak' : '#/speak/part1/0', CONFIG.ielts ? 'Luyện nói' : 'Luyện trò chuyện', CONFIG.ielts ? 'Đọc to 5 câu, máy nghe ra đúng chữ là đạt' : 'Tự giới thiệu, nói về công việc, hỏi ở hội thảo', '5 phút', todayK.has('S'));
  // Kỹ năng yếu nhất lên đầu những việc chưa xong
  plan.forEach(x => { x.weak = x.k === weak && !x.done; });
  plan.sort((a, b) => (a.done - b.done) || (b.weak - a.weak));
  const doneN = plan.filter(x => x.done).length;

  const extra = [];
  const graded = store.unseenGraded();
  if (graded.length) extra.push(task('write', `#/writing/${graded[0].ts}`, 'pen', 'Bài viết đã có điểm', `${graded[0].score ? `Band ${esc(graded[0].score)}. ` : ''}Mở xem nhận xét và cách sửa lỗi.`, '<span class="badge warn">Mới</span>'));
  if (CONFIG.ielts && pDone < PLACEMENT_SECTIONS.length) extra.push(task('test', '#/placement', 'test', 'Kiểm tra đầu vào', `Đã xong ${pDone}/${PLACEMENT_SECTIONS.length} phần. Có thể chia làm nhiều buổi.`, '<span class="badge warn">Làm trước</span>'));
  if (!s.device?.ok) extra.push(task('speak', '#/mic', 'mic', 'Thử micro', 'Kiểm tra ghi âm và nhận giọng nói trên máy này.', '<span class="badge">1 phút</span>'));
  const canDictate = Object.values(s.srs).filter(c => c.reps >= 2).length >= 5;
  if (canDictate) extra.push(task('listen', '#/vocab/dictation', 'headphones', 'Nghe và gõ từ', CONFIG.ielts ? 'Nghe từ đã ôn rồi viết lại, luyện chính tả cho Listening.' : 'Nghe từ đã ôn rồi viết lại, luyện tai.', '<span class="badge">10 từ</span>'));
  if (CONFIG.ielts) extra.push(task('write', '#/writing', 'book', 'Bài viết của em', 'Xem điểm và nhận xét các bài Writing đã nộp.'));

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
        <div><p class="eyebrow">Kế hoạch hằng ngày</p><h2>Hôm nay</h2></div>
        <span class="donering">${ring(plan.length ? doneN / plan.length : 0, { size: 58, stroke: 6, label: `${doneN}/${plan.length}` })}</span>
      </div>
      ${plan.map(x => `<a class="card task ${x.done ? 'done' : ''} ${x.weak ? 'focus' : ''}" data-skill="${x.skill}" href="${x.href}">
        <span class="chip">${x.done ? '✓' : x.k}</span>
        <span class="body"><h3>${x.title} ${x.weak ? '<span class="tag-weak">Kỹ năng yếu nhất</span>' : ''}</h3><div class="meta">${x.meta} · ${x.mins}</div></span>
        <span class="go">${icon('arrow', 18)}</span></a>`).join('')}
      ${doneN === plan.length ? '<p class="small" style="text-align:center;color:var(--good);font-weight:700">Xong hết việc hôm nay 🎉</p>' : ''}
    </div>

    <div class="card">
      <p class="eyebrow">Lộ trình</p>
      ${CONFIG.ielts
        ? '<div class="road2"><span class="st now">4.5</span><span class="ln"></span><span class="st">5.0</span><span class="ln"></span><span class="st goal">5.5 🎯</span><span class="ln"></span><span class="st">6.5</span></div>'
        : '<div class="road2"><span class="st now">A2</span><span class="ln"></span><span class="st goal">B1 🎯</span><span class="ln"></span><span class="st">Nghe hội thảo</span></div>'}
    </div>

    ${extra.length ? `<p class="eyebrow" style="margin:18px 0 8px">Thêm</p>${extra.join('')}` : ''}
    <p class="muted small" style="text-align:center;margin-top:16px">Buổi ngắn 10–15 phút: học và ôn từ. Buổi dài 30–45 phút: làm hết kế hoạch hôm nay.</p>`;
}
