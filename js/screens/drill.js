// Luyện từng câu của một bài nghe: nghe chép (gõ lại câu vừa nghe) và nói nhại (nghe rồi nói theo, máy chấm từng từ).
import * as store from '../store.js';
import { esc, bi, xung } from '../util.js';
import { say, stop as stopTTS } from '../tts.js';
import { sttSupport, sttError, listen, compare } from '../speech.js';
import { resultCard } from '../coach.js';
import { confetti } from '../fx.js';

// Tách bài thành từng câu (bỏ dấu tách lượt hội thoại)
export function sentences(t) {
  return t.text.flatMap(p => p.split(/\s+—\s+/))
    .flatMap(p => p.match(/[^.!?]+[.!?]+["')]*|[^.!?]+$/g) || [])
    .map(s => s.trim()).filter(s => s.split(/\s+/).length >= 3);
}

// Từ chức năng hay bị đọc lướt: giải thích vì sao tai bỏ sót
const WEAK = {
  a: 'đọc rất nhẹ thành /ə/, dính vào từ sau', an: 'đọc /ən/, dính vào từ sau (an_hour → "a-nau-ơ")',
  the: 'đọc nhẹ /ðə/, gần như mất tiếng', of: 'đọc lướt /əv/, nhiều khi chỉ còn /ə/ (a lot of → "a-lot-ơ")',
  to: 'đọc lướt /tə/ (want to → "wanna")', and: 'đọc lướt /ən/ hoặc chỉ /n/ (heart and lungs → "heart-n-lungs")',
  for: 'đọc lướt /fə/', at: 'đọc lướt /ət/, chữ t gần như mất', in: 'dính vào từ trước và sau',
  on: 'dính vào từ trước (put_on → "pu-ton")', is: 'thường rút gọn còn /z/ (it is → it\'s)', are: 'đọc lướt /ə/',
  was: 'đọc lướt /wəz/', were: 'đọc lướt /wə/', have: 'đọc lướt /əv/ (could have → "could-ơv")',
  has: 'đọc lướt /əz/', will: 'rút gọn còn /l/ (we will → we\'ll)', can: 'đọc lướt /kən/, khác hẳn can\'t /kɑːnt/',
  be: 'đọc nhẹ, ngắn', from: 'đọc lướt /frəm/', that: 'đọc lướt /ðət/', than: 'đọc lướt /ðən/',
  do: 'đọc lướt /də/', does: 'đọc lướt /dəz/', but: 'đọc lướt /bət/', or: 'đọc lướt /ə/', as: 'đọc lướt /əz/',
  we: 'đọc nhẹ, dính vào động từ sau', you: 'đọc lướt /jə/', our: 'đọc giống "are" /ɑː/', some: 'đọc lướt /səm/',
  them: 'đọc lướt /ðəm/, nhiều khi chỉ còn /əm/', his: 'chữ h thường mất (tell his → "tell-iz")', him: 'chữ h thường mất',
  her: 'chữ h thường mất (ask her → "ask-ơ")', there: 'đọc lướt /ðə/', would: 'rút gọn còn /d/ (I would → I\'d)',
};
const ENDS = w => /(ed|s|es)$/.test(w) && w.length > 3;

function explain(missed) {
  const tips = [];
  const weak = missed.filter(w => WEAK[w]);
  if (weak.length) tips.push(`<b>Từ đọc lướt</b>, người bản xứ không nhấn: ${weak.slice(0, 4).map(w => `<i>${esc(w)}</i> ${esc(WEAK[w])}`).join('; ')}.`);
  const ends = missed.filter(w => !WEAK[w] && ENDS(w));
  if (ends.length) tips.push(`<b>Âm cuối</b> -s, -ed rất nhỏ và hay dính vào từ sau: ${ends.slice(0, 4).map(w => `<i>${esc(w)}</i>`).join(', ')}. Đoán bằng ngữ pháp: số nhiều thì có -s, chuyện đã xong thì có -ed.`);
  const content = missed.filter(w => !WEAK[w] && !ENDS(w));
  if (content.length) tips.push(`<b>Từ chính chưa bắt được</b>: ${content.slice(0, 5).map(w => `<button class="say" data-w="${esc(w)}">🔊 ${esc(w)}</button>`).join(' ')}. Nghe riêng từng từ, rồi nghe lại cả câu xem từ đó nằm ở đâu.`);
  return tips.length ? `<div class="fix-tip">💡 ${tips.join('<br>')}</div>` : '';
}

const words = ws => ws.map(x => `<span style="color:var(${x.ok ? '--good' : '--bad'});${x.ok ? '' : 'text-decoration:underline;font-weight:700'}">${esc(x.w)}</span>`).join(' ');

export function drill(view, t, mode, back) {
  const list = sentences(t);
  const dict = mode === 'chep';
  const PASS = dict ? 0.9 : 0.8;
  let idx = 0, cancelled = false, session = null;
  const results = [];
  const play = (s, rate) => { stopTTS(); return say(s, { lang: t.lang, rate }); };

  if (!dict && !sttSupport()) {
    view.innerHTML = `<p><a href="#/listen/${t.id}">← ${esc(t.title)}</a></p><div class="card"><p>${esc(sttError('unsupported'))}</p></div>`;
    return () => {};
  }

  function show() {
    const s = list[idx];
    let tries = 0, best = null;
    view.innerHTML = `<p><a href="#/listen/${t.id}">← ${esc(t.title)}</a></p>
      <h1>${dict ? bi('Nghe chép', 'Dictation') : bi('Nói nhại', 'Shadowing')}</h1>
      <div class="progress"><span style="width:${(idx / list.length) * 100}%"></span></div>
      <p class="muted small">Câu ${idx + 1}/${list.length}. ${dict
        ? 'Nghe bao nhiêu lần cũng được, rồi gõ lại đúng từng từ. Không cần viết hoa hay dấu câu.'
        : 'Nghe mẫu, rồi bấm 🎙 và nói theo đúng nhịp, đúng chỗ ngắt. Bắt chước cả chỗ đọc lướt.'}</p>
      <div class="card">
        <div class="row"><button class="btn" data-n>▶ Nghe</button><button class="btn ghost" data-s>🐢 Chậm</button></div>
        <p class="lead" data-target style="margin:12px 0">${dict ? `<span class="muted">${xung('(câu bị ẩn cho tới khi em kiểm tra)')}</span>` : esc(s)}</p>
        ${dict ? '<textarea class="inp" rows="3" style="min-height:0" data-in placeholder="Gõ câu vừa nghe…" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>' : ''}
        <div class="row"><button class="btn" data-go>${dict ? 'Kiểm tra' : '🎙 Nói theo'}</button><button class="btn ghost" data-skip>Bỏ qua câu này →</button></div>
        <p class="small muted" data-live></p>
        <div data-res></div>
      </div>`;
    const $ = q => view.querySelector(q);
    $('[data-n]').onclick = () => play(s, 0.92);
    $('[data-s]').onclick = () => play(s, 0.7);
    const target = $('[data-target]'), live = $('[data-live]'), res = $('[data-res]'), go = $('[data-go]');
    setTimeout(() => !cancelled && play(s, 0.92), 300);
    $('[data-skip]').onclick = () => {
      if (session) { session.stop(); session = null; }
      stopTTS();
      results.push({ s, score: best ? best.score : 0, tries });
      idx++;
      if (idx < list.length) show(); else summary();
    };

    function judge(heard) {
      tries++;
      const c = compare(s, heard);
      if (!best || c.score > best.score) best = c;
      const ok = c.score >= PASS;
      target.innerHTML = words(c.words);
      store.logAttempt({ item: `L${dict ? 'D' : 'S'}-${t.id}-${idx + 1}`, skill: dict ? 'L' : 'S', type: dict ? 'L-dict' : 'S-shadow', correct: ok,
        detail: `${Math.round(c.score * 100)}%${c.missed.length ? ' | thiếu: ' + c.missed.join(', ') : ''}` });
      res.innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}"><b>${ok ? (c.score === 1 ? 'Chính xác từng từ!' : 'Đạt') : 'Chưa đạt'}: ${dict ? 'đúng' : 'máy nhận ra'} ${Math.round(c.score * 100)}% số từ</b>
        ${dict && heard ? `<p class="small">${xung('Em')} gõ: <i>${esc(heard)}</i></p>` : ''}
        ${c.missed.length ? explain(c.missed) : ''}
        <div class="row"><button class="btn ghost" data-again>${dict ? 'Nghe lại và sửa' : '🔁 Nói lại'}</button><button class="btn" data-next>${idx + 1 < list.length ? 'Câu tiếp' : 'Xem kết quả'}</button></div></div>`;
      res.querySelectorAll('[data-w]').forEach(b => { b.onclick = () => play(b.dataset.w, 0.7); });
      res.querySelector('[data-again]').onclick = () => {
        res.innerHTML = '';
        if (dict) { target.innerHTML = `<span class="muted">${xung('(câu bị ẩn cho tới khi em kiểm tra)')}</span>`; $('[data-in]').focus(); }
        play(s, 0.8);
      };
      res.querySelector('[data-next]').onclick = () => {
        stopTTS();
        results.push({ s, score: best.score, tries });
        idx++;
        if (idx < list.length) show(); else summary();
      };
      if (c.score === 1) confetti(30);
    }

    if (dict) {
      const inp = $('[data-in]');
      go.onclick = () => { if (inp.value.trim()) judge(inp.value.trim()); else inp.focus(); };
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go.click(); } };
      return;
    }

    async function finish() {
      const sess = session; session = null;
      clearTimeout(finish.t);
      go.disabled = true; go.textContent = '…';
      const { text, error } = await sess.stop();
      if (cancelled) return;
      go.disabled = false; go.textContent = '🎙 Nói theo';
      if (!text) { live.textContent = sttError(error || 'no-speech'); return; }
      live.innerHTML = `Máy nghe được: <i>${esc(text)}</i>`;
      judge(text);
    }
    go.onclick = () => {
      if (session) return finish();
      stopTTS();
      target.textContent = s;
      res.innerHTML = '';
      live.textContent = 'Đang nghe… nói xong máy tự dừng, hoặc bấm Xong.';
      go.textContent = '■ Xong';
      session = listen({
        lang: 'en-US',
        onText: x => {
          live.innerHTML = `<i>${esc(x)}</i>`;
          if (compare(s, x).score === 1) { clearTimeout(finish.t); finish.t = setTimeout(() => session && finish(), 600); }
        },
        onError: e => { live.textContent = sttError(e); },
      });
      finish.t = setTimeout(() => session && finish(), 20000);
    };
  }

  function summary() {
    const pct = Math.round(results.reduce((a, x) => a + x.score, 0) / results.length * 100);
    store.update(st => { st.listen ||= {}; const k = `${t.id}-${mode}`; st.listen[k] = Math.max(st.listen[k] ?? 0, pct); });
    const r = resultCard(pct, `<div class="row" style="justify-content:center;margin-top:10px">
      <a class="btn" href="#/listen/${t.id}">Về bài nghe</a>
      <a class="btn ghost" href="#/listen/${t.id}/${dict ? 'nhai' : 'chep'}">${dict ? '🗣 Nói nhại bài này' : '✍ Nghe chép bài này'}</a></div>`);
    view.innerHTML = `<h1>${dict ? bi('Kết quả nghe chép', 'Dictation result') : bi('Kết quả nói nhại', 'Shadowing result')}</h1>${r.html}
      <div class="card"><table class="res">${results.map(x => `<tr><td>${esc(x.s)}</td><td><b>${Math.round(x.score * 100)}%</b></td></tr>`).join('')}</table>
      <p class="muted small" style="margin-top:8px">${dict
        ? 'Câu dưới 90%: nghe lại vài lần ở tốc độ thường, rồi tự nói câu đó thành tiếng. Nói được thì sẽ nghe ra.'
        : 'Nói nhại đều đặn thì tai quen nhịp nói thật, nên nghe hội thảo dễ hơn. Mỗi ngày làm lại một bài cũ.'}</p></div>`;
    if (r.party) confetti();
  }

  if (!list.length) { view.innerHTML = '<p>Bài này chưa có câu để luyện.</p>'; return () => {}; }
  show();
  return () => { cancelled = true; session?.stop(); stopTTS(); };
}
