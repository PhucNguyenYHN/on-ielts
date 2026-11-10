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

  const cards = [];
  const graded = store.unseenGraded();
  if (graded.length) {
    cards.push(task('write', `#/writing/${graded[0].ts}`, 'pen', 'Bài viết đã có điểm', `${graded[0].score ? `Band ${esc(graded[0].score)}. ` : ''}Mở xem nhận xét và cách sửa lỗi.`, '<span class="badge warn">Mới</span>'));
  }
  if (CONFIG.ielts && pDone < PLACEMENT_SECTIONS.length) {
    cards.push(task('test', '#/placement', 'test', 'Kiểm tra đầu vào', `Đã xong ${pDone}/${PLACEMENT_SECTIONS.length} phần. Có thể chia làm nhiều buổi.`, '<span class="badge warn">Làm trước</span>'));
  }
  if (!s.device?.ok) {
    cards.push(task('speak', '#/mic', 'mic', 'Thử micro', 'Kiểm tra ghi âm và nhận giọng nói trên máy này.', '<span class="badge">1 phút</span>'));
  }
  cards.push(task('vocab', '#/vocab/learn', 'book', 'Học từ mới',
    fresh ? 'Xem từ kèm nghĩa và cách nhớ, rồi chọn nghĩa và viết lại từ.' : 'Hôm nay đã học đủ từ mới.', `<span class="badge">${fresh ? `${fresh} từ` : 'Xong ✓'}</span>`));
  if (due) cards.push(task('vocab', '#/vocab/review', 'cards', 'Ôn thẻ đến hạn', 'Lật thẻ nhớ lại nghĩa các từ đã học.', `<span class="badge">${due} thẻ</span>`));
  const canDictate = Object.values(s.srs).filter(c => c.reps >= 2).length >= 5;
  if (rec) cards.push(task('grammar', `#/grammar/${esc(rec.lesson.id)}`, 'grammar', `Ngữ pháp: ${esc(rec.lesson.title)}`, `${esc(rec.why)} · khoảng 10 phút`));
  if (canDictate) cards.push(task('listen', '#/vocab/dictation', 'headphones', 'Nghe và gõ chính tả', 'Nghe từ đã ôn rồi viết lại, luyện chính tả cho Listening.', '<span class="badge">10 từ</span>'));
  if (!CONFIG.ielts) {
    // Gợi ý đúng bước tiếp theo: bài đầu tiên chưa đủ 85% ở cả 3 bước (câu hỏi, nghe chép, nói nhại)
    const L = s.listen || {}, ok = k => (L[k] ?? 0) >= 85;
    let n = 1;
    while (n < 10 && ok('T' + n) && ok(`T${n}-chep`) && ok(`T${n}-nhai`)) n++;
    const id = 'T' + n;
    const [href, what] = !ok(id) ? [`#/listen/${id}`, 'nghe và trả lời câu hỏi'] : !ok(`${id}-chep`) ? [`#/listen/${id}/chep`, 'nghe chép từng câu'] : [`#/listen/${id}/nhai`, 'nói nhại từng câu'];
    cards.push(task('listen', href, 'headphones', `Nghe hội thảo · bài ${n}`, `Bước tiếp theo: ${what}. Xong cả 3 bước từ 85% là sang bài mới.`, '<span class="badge">15 phút</span>'));
  }
  cards.push(task('speak', CONFIG.ielts ? '#/speak' : '#/speak/part1/0', 'mic', CONFIG.ielts ? 'Luyện nói' : 'Luyện trò chuyện', CONFIG.ielts ? 'Đọc to 5 câu, máy nghe ra đúng chữ là phát âm đạt.' : 'Tự giới thiệu, nói về công việc, đặt câu hỏi ở hội thảo.', '<span class="badge">5 phút</span>'));

  view.innerHTML = `
    <div class="card hero">
      <div class="hero-top">
        <div><h2>${hello}, ${esc(CONFIG.learner)} ${emoji}</h2><div class="meta" style="margin-top:4px">${quote}</div></div>
        ${exam ? `<div class="count"><b>${daysLeft}</b><span>ngày đến kỳ thi</span></div>` : `<div class="count"><b>${learned}</b><span>từ đã thuộc</span></div>`}
      </div>
      ${!CONFIG.ielts ? '<div class="road"><span class="dot now">A2</span><span class="line"></span><span class="dot">B1 🎯</span><span class="line"></span><span class="dot">Nghe hội thảo</span></div>' : ''}
      ${CONFIG.target ? '<div class="road"><span class="dot now">4.5</span><span class="line"></span><span class="dot">5.0</span><span class="line"></span><span class="dot">5.5 🎯</span><span class="line"></span><span class="dot">6.5</span></div>' : ''}
    </div>
    <div class="card today">
      ${ring(mins / DAILY_MINUTES, { size: 72, stroke: 8, label: `${mins}′` })}
      <div class="body"><h3>${mins >= DAILY_MINUTES ? 'Đủ mục tiêu hôm nay! 🎉' : `Hôm nay: ${mins}/${DAILY_MINUTES} phút`}</h3>
        <div class="meta">${streakNote(st)}</div></div>
    </div>
    <div class="stats">
      <div class="stat fire">${icon('flame', 22)}<b>${st}</b><span>ngày liên tục</span></div>
      <div class="stat" data-skill="grammar">${icon('calendar', 22)}<b>${weekCount(s.days, CONFIG.sessionMinutes)}/${CONFIG.weeklyGoal}</b><span>buổi tuần này</span></div>
      <div class="stat" data-skill="vocab">${icon('cards', 22)}<b>${learned}</b><span>từ đã thuộc</span></div>
    </div>
    <h2>Việc hôm nay <span class="en">Today's plan</span></h2>
    ${cards.join('')}
    ${CONFIG.ielts ? '' : '<!-- -->'}<a class="card task" href="#/writing" data-skill="write" ${CONFIG.ielts ? '' : 'hidden'}><span class="chip">${icon('book', 24)}</span><span class="body"><h3>Bài viết của em</h3><div class="meta">Xem điểm và nhận xét các bài Writing đã nộp.</div></span><span class="go">${icon('arrow', 20)}</span></a>
    <p class="muted small" style="text-align:center;margin-top:16px">Buổi ngắn 10–15 phút: ôn từ và nghe–gõ. Buổi dài 45–60 phút: thêm ngữ pháp hoặc luyện nói.</p>`;
}
