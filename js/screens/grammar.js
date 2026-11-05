import * as store from '../store.js';
import { esc, bi, shuffle, loadContent } from '../util.js';
import { recommendLesson } from '../engine.js';
import { bindSay } from '../tts.js';
import { runQuiz } from '../quiz.js';

export default async function grammarScreen(view, [id, mode]) {
  const lessons = await loadContent('grammar');
  const lesson = lessons.find(l => l.id === id);
  if (lesson && mode === 'practice') return practice(view, lesson);
  if (lesson) return detail(view, lesson);
  listView(view, lessons);
}

function listView(view, lessons) {
  const s = store.get();
  const rec = recommendLesson(s, lessons);
  view.innerHTML = `<h1>${bi('Ngữ pháp nền', 'Grammar basics')}</h1>
    <p class="muted small">Mốc 1 cần chắc thì và câu đơn trước, rồi mới lên câu phức. Đạt từ 80% thì bài được tính là xong.</p>
    ${lessons.map((l, i) => {
      const best = s.grammar[l.id];
      const badge = best >= 80 ? `<span class="badge done">${best}%</span>`
        : best != null ? `<span class="badge warn">${best}%</span>` : '';
      return `<a class="card" href="#/grammar/${esc(l.id)}"><h3>${i + 1}. ${esc(l.title)} ${badge} ${rec?.lesson.id === l.id ? '<span class="badge">Gợi ý</span>' : ''}</h3>
        <div class="meta">${esc(l.en)}</div></a>`;
    }).join('')}`;
}

function detail(view, l) {
  view.innerHTML = `<p><a href="#/grammar">← Danh sách bài</a></p>
    <h1>${bi(l.title, l.en)}</h1>
    <div class="card"><ul class="points">${l.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <h2>${bi('Ví dụ', 'Examples')}</h2>
    <div class="card">${l.examples.map(e => `<div class="ex"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b>${esc(e.en)}</b>
      <button class="say" data-say="${esc(e.en)}" data-lang="${store.get().prefs.accent}">🔊</button></div><div class="muted small">${esc(e.vn)}</div></div>`).join('')}</div>
    <a class="btn block" href="#/grammar/${esc(l.id)}/practice">Làm ${l.exercises.length} câu bài tập</a>`;
  bindSay(view);
}

function practice(view, l) {
  // Trắc nghiệm trước, câu sửa lỗi sau; trộn thứ tự trong từng nhóm và trộn phương án
  const mcq = shuffle(l.exercises.filter(x => x.type === 'mcq')).map(x => {
    const order = shuffle(x.options.map((_, k) => k));
    return { ...x, options: order.map(k => x.options[k]), answer: order.indexOf(x.answer) };
  });
  const text = shuffle(l.exercises.filter(x => x.type === 'text'));
  runQuiz(view, [...mcq, ...text], {
    title: l.title,
    onAnswer: r => store.logAttempt({ item: l.id, skill: 'G', type: l.tag, correct: r.correct, ms: r.ms, detail: r.correct ? '' : String(r.given) }),
    onDone: res => {
      const pct = Math.round((res.filter(r => r.correct).length / res.length) * 100);
      store.update(s => { s.grammar[l.id] = Math.max(s.grammar[l.id] ?? 0, pct); });
      view.innerHTML = `<h1>${bi('Kết quả', 'Result')}</h1>
        <div class="card"><h3>${l.title}: ${pct}%</h3>
        <p class="meta">${pct >= 80 ? 'Đạt. App sẽ chuyển sang bài tiếp theo.' : 'Chưa đạt 80%. Đọc lại phần giải thích rồi làm lại; app sẽ gợi ý bài này cho tới khi đạt.'}</p>
        <div class="row"><a class="btn" href="#/grammar/${esc(l.id)}">Xem lại bài</a><a class="btn ghost" href="#/grammar">Danh sách bài</a></div></div>`;
    },
  });
}
