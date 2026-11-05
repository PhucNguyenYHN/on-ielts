import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { esc, bi, streak, weekCount, today, loadContent } from '../util.js';
import { dueIds, learnedCount } from '../srs.js';
import { recommendLesson, newWordsLeft, PLACEMENT_SECTIONS } from '../engine.js';

export default async function home(view) {
  const [vocab, grammar] = await Promise.all([loadContent('vocab'), loadContent('grammar')]);
  const s = store.get();
  const exam = new Date(CONFIG.examDate + 'T00:00:00');
  const daysLeft = Math.max(0, Math.ceil((exam - new Date()) / 864e5));
  const due = dueIds(s.srs).length;
  const fresh = Math.min(newWordsLeft(s, CONFIG.newWordsPerDay), vocab.filter(v => !s.srs[v.w]).length);
  const pDone = PLACEMENT_SECTIONS.filter(k => s.placement[k]).length;
  const rec = recommendLesson(s, grammar);
  const mins = Math.round(s.days[today()] || 0);

  const cards = [];
  if (pDone < PLACEMENT_SECTIONS.length) {
    cards.push(`<a class="card" href="#/placement">
      <h3>Kiểm tra đầu vào <span class="badge warn">Làm trước</span></h3>
      <div class="meta">Đã xong ${pDone}/${PLACEMENT_SECTIONS.length} phần. Có thể chia làm nhiều buổi.</div></a>`);
  }
  if (!s.device?.ok) {
    cards.push(`<a class="card" href="#/mic">
      <h3>Thử micro <span class="badge">1 phút</span></h3>
      <div class="meta">Kiểm tra ghi âm Speaking trên máy này.</div></a>`);
  }
  cards.push(`<a class="card" href="#/vocab/review">
    <h3>Ôn từ vựng <span class="badge">${due + fresh ? `${due + fresh} thẻ` : 'Xong'}</span></h3>
    <div class="meta">${due} thẻ đến hạn ôn, ${fresh} từ mới hôm nay · đã thuộc ${learnedCount(s.srs)}/${vocab.length} từ</div></a>`);
  if (rec) {
    cards.push(`<a class="card" href="#/grammar/${esc(rec.lesson.id)}">
      <h3>Ngữ pháp: ${esc(rec.lesson.title)}</h3>
      <div class="meta">${esc(rec.why)} · khoảng 10 phút</div></a>`);
  }
  cards.push(`<a class="card" href="#/vocab/dictation">
    <h3>Nghe và gõ chính tả <span class="badge">10 từ</span></h3>
    <div class="meta">Luyện viết đúng chính tả khi điền từ ở bài Listening.</div></a>`);
  cards.push(`<a class="card" href="#/speak">
    <h3>Luyện nói <span class="badge">5 phút</span></h3>
    <div class="meta">Đọc to 5 câu, máy nghe ra đúng chữ là phát âm đạt. Có cả câu hỏi Part 1 về bản thân em.</div></a>`);

  view.innerHTML = `
    <div class="card hero">
      <h3>${bi(`Chào ${CONFIG.learner}`, 'Welcome back')}</h3>
      <div class="meta">Còn ${daysLeft} ngày đến kỳ thi dự kiến (${exam.toLocaleDateString('vi-VN')}). Mốc 1: 5.5.</div>
    </div>
    <div class="stats">
      <div class="stat"><b>${streak(s.days)}</b><span>ngày liên tục</span></div>
      <div class="stat"><b>${weekCount(s.days, CONFIG.sessionMinutes)}/${CONFIG.weeklyGoal}</b><span>buổi tuần này</span></div>
      <div class="stat"><b>${mins}</b><span>phút hôm nay</span></div>
    </div>
    <h2>${bi('Việc hôm nay', "Today's plan")}</h2>
    ${cards.join('')}
    <p class="muted small">Buổi ngắn 10–15 phút: ôn từ vựng và nghe–gõ. Buổi dài 45–60 phút: làm thêm một bài ngữ pháp hoặc một phần kiểm tra. Học từ ${CONFIG.sessionMinutes} phút trong ngày thì tính là một buổi.</p>`;
}
