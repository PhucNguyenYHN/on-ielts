// Bộ chạy câu hỏi dùng chung. item: { q, type: 'mcq'|'text', options, answer, explain, say, tag }
// mcq: answer là chỉ số đáp án đúng; text: answer là mảng các câu trả lời chấp nhận.
// Đúng thì khen (có chuỗi đúng liên tiếp); sai thì chỉ rõ sai ở đâu, đúng là gì, vì sao, mẹo nhớ.
import { esc, checkText } from './util.js';
import { say, stop } from './tts.js';
import { praise, comfort, fixBox, fillBlank, spellingDiff, tips } from './coach.js';
import { confetti } from './fx.js';

export function runQuiz(root, items, { title = '', feedback = true, lang = 'en-GB', tag = '', onAnswer, onDone } = {}) {
  let i = 0, t0 = 0, streak = 0, T = {};
  tips().then(x => { T = x || {}; });
  const results = [];

  function show() {
    if (i >= items.length) return onDone?.(results);
    const it = items[i];
    t0 = Date.now();
    root.innerHTML = `<div class="quiz">
      <div class="row" style="justify-content:space-between"><div class="qhead">${title ? esc(title) + ' · ' : ''}Câu ${i + 1}/${items.length}</div>
        ${streak >= 2 ? `<span class="badge streak">🔥 ${streak}</span>` : ''}</div>
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
      ans.innerHTML = it.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="opt-k">${'ABCDEF'[k]}</span>${esc(o)}</button>`).join('');
      ans.querySelectorAll('.opt').forEach(b => { b.onclick = () => finish(+b.dataset.k === it.answer, +b.dataset.k); });
    }
  }

  function finish(correct, given) {
    const it = items[i];
    const r = { item: it, correct, given, ms: Date.now() - t0 };
    results.push(r);
    onAnswer?.(r);
    streak = correct ? streak + 1 : 0;
    if (!feedback) { i++; return show(); }

    root.querySelectorAll('.opt').forEach(b => {
      b.disabled = true;
      const k = +b.dataset.k;
      if (k === it.answer) b.classList.add('right');
      else if (k === given) b.classList.add('wrong');
    });
    const inp = root.querySelector('.inp');
    if (inp) { inp.disabled = true; inp.classList.add(correct ? 'ok' : 'no'); root.querySelector('[data-ok]').remove(); }
    const fb = root.querySelector('.fb');
    fb.className = 'fb ' + (correct ? 'good' : 'bad');
    const tg = it.tag || tag;
    let body = '';
    if (correct) {
      body = it.explain ? `<div class="small">${esc(it.explain)}</div>` : '';
    } else if (it.type === 'text') {
      const right = it.answer[0];
      body = !/\s/.test(right) && right.length < 25
        ? spellingDiff(given, right) + (it.explain ? `<div class="small" style="margin-top:6px">${esc(it.explain)}</div>` : '')
        : fixBox({ given, right, explain: it.explain, tag: tg }, T);
    } else {
      const right = it.options[it.answer];
      body = fixBox({ given: it.options[given], right, explain: it.explain, tag: tg, sentence: fillBlank(it.q, right) }, T);
    }
    fb.innerHTML = `<b>${correct ? praise(streak) : comfort()}</b>${body}
      <button class="btn" data-next>${i + 1 < items.length ? 'Câu tiếp' : 'Xem kết quả'}</button>`;
    if (correct && (streak === 5 || streak === 10)) confetti(60);
    const next = fb.querySelector('[data-next]');
    next.onclick = () => { i++; show(); };
    next.focus({ preventScroll: true });
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  show();
}
