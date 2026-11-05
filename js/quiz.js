// Bộ chạy câu hỏi dùng chung. item: { q, type: 'mcq'|'text', options, answer, explain, say }
// mcq: answer là chỉ số đáp án đúng; text: answer là mảng các câu trả lời chấp nhận.
import { esc, checkText } from './util.js';
import { say, stop } from './tts.js';

export function runQuiz(root, items, { title = '', feedback = true, lang = 'en-GB', onAnswer, onDone } = {}) {
  let i = 0, t0 = 0;
  const results = [];

  function show() {
    if (i >= items.length) return onDone?.(results);
    const it = items[i];
    t0 = Date.now();
    root.innerHTML = `<div class="quiz">
      <div class="qhead">${title ? esc(title) + ' · ' : ''}Câu ${i + 1}/${items.length}</div>
      <div class="bar"><i style="width:${(i / items.length) * 100}%"></i></div>
      ${it.lead ? `<p class="muted small">${esc(it.lead)}</p>` : ''}
      <p class="q">${esc(it.q)}</p>
      ${it.say ? '<button class="btn ghost" data-replay>🔊 Nghe lại</button>' : ''}
      <div class="ans"></div><div class="fb"></div></div>`;
    if (it.say) {
      const play = () => { stop(); say(it.say, { lang }); };
      root.querySelector('[data-replay]').onclick = play;
      play();
    }
    const ans = root.querySelector('.ans');
    if (it.type === 'text') {
      ans.innerHTML = `<input class="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${esc(it.ph || 'Gõ câu trả lời')}">
        <button class="btn" data-ok>Kiểm tra</button>`;
      const inp = ans.querySelector('input');
      const go = () => { if (inp.value.trim()) finish(checkText(inp.value, it.answer), inp.value.trim()); };
      ans.querySelector('[data-ok]').onclick = go;
      inp.onkeydown = e => { if (e.key === 'Enter') go(); };
      inp.focus();
    } else {
      ans.innerHTML = it.options.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('');
      ans.querySelectorAll('.opt').forEach(b => { b.onclick = () => finish(+b.dataset.k === it.answer, +b.dataset.k); });
    }
  }

  function finish(correct, given) {
    const it = items[i];
    const r = { item: it, correct, given, ms: Date.now() - t0 };
    results.push(r);
    onAnswer?.(r);
    if (!feedback) { i++; return show(); }

    root.querySelectorAll('.opt').forEach(b => {
      b.disabled = true;
      const k = +b.dataset.k;
      if (k === it.answer) b.classList.add('right');
      else if (k === given) b.classList.add('wrong');
    });
    const inp = root.querySelector('.inp');
    if (inp) { inp.disabled = true; root.querySelector('[data-ok]').remove(); }
    const fb = root.querySelector('.fb');
    fb.className = 'fb ' + (correct ? 'good' : 'bad');
    fb.innerHTML = `<b>${correct ? 'Đúng' : 'Chưa đúng'}</b>
      ${!correct && it.type === 'text' ? `<div>Đáp án: <b>${esc(it.answer[0])}</b></div>` : ''}
      ${it.explain ? `<div>${esc(it.explain)}</div>` : ''}
      <button class="btn" data-next>${i + 1 < items.length ? 'Câu tiếp' : 'Xem kết quả'}</button>`;
    const next = fb.querySelector('[data-next]');
    next.onclick = () => { i++; show(); };
    next.focus();
  }

  show();
}
