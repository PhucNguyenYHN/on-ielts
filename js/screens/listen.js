// Nghe hội thảo: bài nói ngắn mức B1 về chủ đề tim mạch, nghe (có thể chậm), trả lời câu hỏi, xem lời thoại và cụm từ hay.
import * as store from '../store.js';
import { esc, bi, loadContent } from '../util.js';
import { say, stop as stopTTS } from '../tts.js';
import { runQuiz } from '../quiz.js';
import { resultCard } from '../coach.js';
import { confetti } from '../fx.js';
import { drill } from './drill.js';

export default async function listenScreen(view, [id, mode]) {
  const talks = await loadContent('talks');
  const t = talks.find(x => x.id === id);
  if (t && (mode === 'chep' || mode === 'nhai')) return drill(view, t, mode);
  if (t) return talk(view, t);
  const s = store.get();
  view.innerHTML = `<h1>${bi('Nghe hội thảo', 'Conference listening')}</h1>
    <p class="muted small">Bài nói ngắn mức B1 về chủ đề tim mạch.</p>
    <div class="card"><h3>Mỗi bài làm theo 3 bước</h3>
      <p class="small"><b>1. Nghe hiểu ❓</b> nghe không nhìn chữ, trả lời câu hỏi.<br>
      <b>2. Nghe chép ✍</b> nghe từng câu rồi gõ lại. Bước này lộ ra đúng những âm tai đang bỏ sót.<br>
      <b>3. Nói nhại 🗣</b> nghe từng câu rồi nói theo đúng nhịp. Nói được nhịp nào thì sẽ nghe ra nhịp đó.</p>
      <p class="muted small">Một bài nghe kỹ cả 3 bước có ích hơn nghe lướt 5 bài. Sang bài mới khi cả 3 bước đều từ 85% trở lên.</p></div>
    ${talks.map(x => {
      const best = s.listen?.[x.id], d = s.listen?.[x.id + '-chep'], n = s.listen?.[x.id + '-nhai'];
      const b = (v, ic) => v != null ? `<span class="badge ${v >= 85 ? 'done' : 'warn'}">${ic} ${v}%</span>` : '';
      return `<a class="card task" data-skill="listen" href="#/listen/${x.id}"><span class="chip">🎧</span>
        <span class="body"><h3>${esc(x.title)} ${b(best, '❓')} ${b(d, '✍')} ${b(n, '🗣')}</h3><div class="meta">${esc(x.en)} · ${esc(x.intro)}</div></span></a>`;
    }).join('')}`;
}

function talk(view, t) {
  let playing = false, cancelled = false;
  const play = async rate => {
    stopTTS(); playing = true; cancelled = false;
    const st = view.querySelector('[data-st]');
    // Đoạn hội thoại tách bằng " — ": mỗi người nói đổi giọng (giọng khác hoặc cao độ khác)
    let who = 0;
    for (let k = 0; k < t.text.length && !cancelled; k++) {
      if (st) st.textContent = `Đoạn ${k + 1}/${t.text.length}`;
      const turns = t.text[k].split(/\s+—\s+/);
      for (let j = 0; j < turns.length && !cancelled; j++) {
        if (j > 0) who = 1 - who;
        await say(turns[j], { lang: t.lang, rate, voice: who, pitch: who ? 0.85 : 1 });
      }
      if (turns.length > 1) who = 0;
    }
    playing = false;
    if (st && !cancelled) st.textContent = 'Nghe xong. Bấm Trả lời câu hỏi khi sẵn sàng.';
  };

  view.innerHTML = `<p><a href="#/listen">← Nghe hội thảo</a></p>
    <h1>${bi(t.title, t.en)}</h1>
    <div class="card"><p>${esc(t.intro)}</p>
      <p class="muted small">Mẹo: lần đầu nghe tốc độ thường để hiểu ý chính. Chưa theo kịp thì nghe lại ở tốc độ chậm.</p>
      <div class="row"><button class="btn" data-play>▶ Nghe</button><button class="btn ghost" data-slow>🐢 Nghe chậm</button><button class="btn ghost" data-stop>■ Dừng</button></div>
      <p class="small muted" data-st></p></div>
    <div class="card"><h3>Cụm từ cần chú ý khi nghe</h3>
      ${t.phrases.map(([en, vn]) => `<div class="ex"><b>${esc(en)}</b> <button class="say" data-p="${esc(en)}">🔊</button><div class="muted small">${esc(vn)}</div></div>`).join('')}</div>
    <button class="btn block" data-quiz>❓ Bước 1: Trả lời ${t.questions.length} câu hỏi</button>
    <div class="row" style="margin-top:10px"><a class="btn ghost" href="#/listen/${t.id}/chep">✍ Bước 2: Nghe chép từng câu</a><a class="btn ghost" href="#/listen/${t.id}/nhai">🗣 Bước 3: Nói nhại từng câu</a></div>`;
  view.querySelector('[data-play]').onclick = () => play(0.92);
  view.querySelector('[data-slow]').onclick = () => play(0.72);
  view.querySelector('[data-stop]').onclick = () => { cancelled = true; stopTTS(); };
  view.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => { stopTTS(); say(b.dataset.p, { lang: t.lang, rate: 0.85 }); }; });
  view.querySelector('[data-quiz]').onclick = () => {
    cancelled = true; stopTTS();
    const items = t.questions.map(q => ({ q: q.q, type: 'mcq', options: q.o, answer: q.a, explain: q.explain, tag: 'L-detail' }));
    runQuiz(view, items, {
      title: t.title, lang: t.lang,
      onAnswer: r => store.logAttempt({ item: `LT-${t.id}`, skill: 'L', type: 'L-talk', correct: r.correct, ms: r.ms }),
      onDone: res => {
        const pct = Math.round((res.filter(r => r.correct).length / res.length) * 100);
        store.update(s => { s.listen ||= {}; s.listen[t.id] = Math.max(s.listen[t.id] ?? 0, pct); });
        const r = resultCard(pct, `<div class="row" style="justify-content:center;margin-top:10px"><a class="btn" href="#/listen">Bài khác</a><a class="btn ghost" href="#/listen/${t.id}/chep">✍ Bước 2: Nghe chép</a></div>`);
        view.innerHTML = `<h1>${bi('Kết quả', 'Result')}</h1>${r.html}
          <h2>${bi('Lời thoại', 'Transcript')}</h2>
          <div class="card passage">${t.text.map(p => `<p>${esc(p)} <button class="say" data-say-p="${esc(p)}">🔊</button></p>`).join('')}</div>`;
        view.querySelectorAll('[data-say-p]').forEach(b => { b.onclick = () => { stopTTS(); say(b.dataset.sayP, { lang: t.lang, rate: 0.85 }); }; });
        if (r.party) confetti();
      },
    });
  };
  return () => { cancelled = true; stopTTS(); };
}
