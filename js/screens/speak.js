// Luyện nói: đọc to câu mẫu (máy nghe ra đúng chữ là phát âm đạt), trả lời Speaking Part 1, ôn từ hay đọc sai.
import * as store from '../store.js';
import { CONFIG } from '../config.js';
import { esc, bi, shuffle, wordCount, loadContent, xung } from '../util.js';

// Bộ câu hỏi nói theo người học (Phúc: giao tiếp công việc bác sĩ, hội thảo)
const qset = data => data['part1_' + CONFIG.user] || data.part1;
import { say, stop as stopTTS } from '../tts.js';
import { sttSupport, sttError, listen, compare, tokens } from '../speech.js';
import { recorderWidget, blobToBase64 } from '../recorder.js';
import { typeStats } from '../engine.js';

const PASS = 0.8; // đọc ra đúng từ 80% số từ thì tính là đạt
const accent = () => store.get().prefs?.accent || 'en-GB';

export default async function speakScreen(view, [mode, arg]) {
  const data = await loadContent('speaking');
  if (mode === 'read') return readAloud(view, data, arg || 'mix');
  if (mode === 'part1') return part1(view, data, Number(arg) || 0);
  if (mode === 'words') return wordsDrill(view);
  menu(view, data);
}

function noSTT() {
  return sttSupport() ? '' : `<div class="card"><h3>Máy này chưa nhận giọng nói được</h3><p class="meta">${esc(sttError('unsupported'))}</p></div>`;
}

function hardWords(s, min = 2) {
  return Object.entries(s.pron || {})
    .filter(([, p]) => p.miss >= min && p.miss / p.n >= 0.4)
    .sort((a, b) => b[1].miss - a[1].miss)
    .map(([w, p]) => ({ w, ...p }));
}

function menu(view, data) {
  const s = store.get();
  const stats = typeStats(s.attempts);
  const pct = t => { const b = stats[t]; return b ? `<span class="badge ${b.wrong / b.n > 0.3 ? 'warn' : 'done'}">đạt ${Math.round((1 - b.wrong / b.n) * 100)}%</span>` : ''; };
  const hard = hardWords(s);
  view.innerHTML = `<h1>${bi('Luyện nói', 'Speaking practice')}</h1>
    ${noSTT()}
    <div class="card"><p class="small">Máy nghe và chuyển lời em nói thành chữ. Máy ghi ra đúng từ nào thì từ đó em phát âm đủ rõ để người khác hiểu. Không cần giọng giống người bản xứ.</p></div>
    <h2>${bi('Đọc to', 'Read aloud')}</h2>
    <a class="card" href="#/speak/read/mix"><h3>5 câu hỗn hợp <span class="badge">5 phút</span></h3><div class="meta">Ưu tiên nhóm âm em còn đọc sai nhiều.</div></a>
    ${Object.entries(data.readTags).map(([t, g]) => `<a class="card" href="#/speak/read/${t}"><h3>${esc(g.name)} ${pct(t)}</h3><div class="meta">${esc(g.tip)}</div></a>`).join('')}
    ${hard.length ? `<a class="card" href="#/speak/words"><h3>Từ hay đọc sai <span class="badge warn">${hard.length} từ</span></h3><div class="meta">${esc(hard.slice(0, 8).map(x => x.w).join(', '))}</div></a>` : ''}
    <h2>${bi('Trả lời câu hỏi', 'Speaking Part 1')}</h2>
    <a class="card" href="#/speak/part1/0"><h3>${CONFIG.user === 'thao' ? 'Part 1' : 'Trò chuyện'}: ${qset(data).length} câu về bản thân ${xung('em')} ${pct('S-part1')}</h3>
      <div class="meta">${CONFIG.user === 'thao' ? 'Quê, chỗ ở, ngành Dược, dạy thêm, du lịch, tiền bạc.' : 'Tự giới thiệu, công việc bác sĩ, giải thích cho bệnh nhân, đặt câu hỏi và giao lưu ở hội thảo.'} Ghi âm kèm chữ máy nghe được, có câu trả lời mẫu để so.</div></a>`;
}

// ---------- Đọc to ----------
function pickSentences(data, tag) {
  if (tag !== 'mix') return shuffle(data.read.filter(r => r.tag === tag));
  const stats = typeStats(store.get().attempts);
  const rate = t => (stats[t] ? stats[t].wrong / stats[t].n : 0.5);
  const tags = Object.keys(data.readTags).sort((a, b) => rate(b) - rate(a));
  const out = [];
  // hai câu từ nhóm yếu nhất, mỗi nhóm kế tiếp một câu
  [tags[0], tags[0], tags[1], tags[2], tags[3]].forEach(t => {
    const c = shuffle(data.read.filter(r => r.tag === t && !out.includes(r)))[0];
    if (c) out.push(c);
  });
  return out;
}

function renderWords(words) {
  return words.map(x => `<span style="color:var(${x.ok ? '--good' : '--bad'});${x.ok ? '' : 'text-decoration:underline;font-weight:700'}">${esc(x.w)}</span>`).join(' ');
}

export function recordPron(result) {
  store.update(s => {
    s.pron ||= {};
    result.words.forEach(x => {
      if (!x.key || x.key.split(' ').length > 1 && /^\d/.test(x.w)) return;
      const p = (s.pron[x.key] ||= { n: 0, miss: 0 });
      p.n++;
      if (!x.ok) p.miss++;
    });
  });
}

function readAloud(view, data, tag) {
  const list = pickSentences(data, tag);
  const results = [];
  let idx = 0, session = null, cancelled = false;
  const title = tag === 'mix' ? '5 câu hỗn hợp' : data.readTags[tag]?.name || 'Đọc to';

  function show() {
    const r = list[idx];
    const g = data.readTags[r.tag];
    view.innerHTML = `<p><a href="#/speak">← Luyện nói</a></p>
      <h1>${esc(title)} <span class="muted small">${idx + 1}/${list.length}</span></h1>
      ${noSTT()}
      <div class="card">
        <p class="meta">${esc(g.tip)}</p>
        <p class="q" style="font-size:1.25rem;font-weight:600" data-target>${esc(r.text)}</p>
        <div class="row"><button class="say" data-model>🔊 Nghe mẫu</button><button class="say" data-slow>🐢 Nghe chậm</button></div>
        <button class="btn block" data-go ${sttSupport() ? '' : 'disabled'}>🎙 Bấm rồi đọc to</button>
        <p class="small muted" data-live></p>
        <div data-res></div>
      </div>`;
    const target = view.querySelector('[data-target]');
    const live = view.querySelector('[data-live]');
    const res = view.querySelector('[data-res]');
    const go = view.querySelector('[data-go]');
    view.querySelector('[data-model]').onclick = () => { stopTTS(); say(r.text, { lang: accent() }); };
    view.querySelector('[data-slow]').onclick = () => { stopTTS(); say(r.text, { lang: accent(), rate: 0.65 }); };
    let tries = 0, best = null;

    async function finish() {
      const s = session; session = null;
      clearTimeout(finish.t);
      go.textContent = '…';
      go.disabled = true;
      const { text, error } = await s.stop();
      if (cancelled) return;
      go.disabled = false;
      go.textContent = '🎙 Đọc lại';
      if (!text) { live.textContent = error ? sttError(error) : sttError('no-speech'); return; }
      tries++;
      const c = compare(r.text, text);
      target.innerHTML = renderWords(c.words);
      live.innerHTML = `Máy nghe được: <i>${esc(text)}</i>`;
      const ok = c.score >= PASS;
      recordPron(c);
      store.logAttempt({ item: `SP-${r.id}`, skill: 'S', type: r.tag, correct: ok, detail: `nhận ra ${Math.round(c.score * 100)}%${c.missed.length ? ' | thiếu: ' + c.missed.join(', ') : ''}` });
      if (!best || c.score > best.score) best = c;
      res.innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}"><b>${ok ? 'Đạt' : 'Chưa đạt'}: máy nhận ra ${Math.round(c.score * 100)}% số từ</b>
        ${c.missed.length ? `<p class="small">Từ máy chưa nghe ra: ${c.missed.map(w => `<button class="say" data-w="${esc(w)}">🔊 ${esc(w)}</button>`).join(' ')}</p><p class="small muted">Nghe mẫu từng từ, đọc chậm, rõ âm cuối rồi thử lại.</p>` : '<p class="small">Mọi từ đều rõ.</p>'}
        <div class="row"><button class="btn" data-next>${idx + 1 < list.length ? 'Câu tiếp' : 'Xem kết quả'}</button></div></div>`;
      res.querySelectorAll('[data-w]').forEach(b => { b.onclick = () => { stopTTS(); say(b.dataset.w, { lang: accent(), rate: 0.7 }); }; });
      res.querySelector('[data-next]').onclick = () => {
        results.push({ r, score: best.score, tries });
        idx++;
        if (idx < list.length) show(); else summary();
      };
    }

    go.onclick = () => {
      if (session) return finish();
      stopTTS();
      target.textContent = r.text;
      res.innerHTML = '';
      live.textContent = 'Đang nghe… đọc xong máy tự dừng, hoặc bấm Xong.';
      go.textContent = '■ Xong';
      session = listen({
        lang: 'en-US',
        onText: t => {
          live.innerHTML = `<i>${esc(t)}</i>`;
          if (compare(r.text, t).score === 1) { clearTimeout(finish.t); finish.t = setTimeout(() => session && finish(), 600); }
        },
        onError: e => { live.textContent = sttError(e); },
      });
      finish.t = setTimeout(() => session && finish(), 25000);
    };
  }

  function summary() {
    const passed = results.filter(x => x.score >= PASS).length;
    view.innerHTML = `<h1>${bi('Kết quả đọc to', 'Read aloud results')}</h1>
      <div class="card"><h3>Đạt ${passed}/${results.length} câu</h3>
      <table class="res">${results.map(x => `<tr><td>${esc(x.r.text)}</td><td><b>${Math.round(x.score * 100)}%</b></td></tr>`).join('')}</table>
      <p class="muted small">Câu chưa đạt sẽ được ưu tiên ở lần luyện sau. Từ sai nhiều lần được gom vào mục "Từ hay đọc sai".</p>
      <div class="row" style="margin-top:10px"><a class="btn" href="#/speak">Luyện nói</a><a class="btn ghost" href="#/">Về Hôm nay</a></div></div>`;
  }

  if (!list.length) { view.innerHTML = '<p>Không có câu nào.</p>'; return; }
  show();
  return () => { cancelled = true; session?.stop(); stopTTS(); };
}

// ---------- Từ hay đọc sai ----------
function wordsDrill(view) {
  const hard = hardWords(store.get()).slice(0, 15);
  let session = null;
  view.innerHTML = `<p><a href="#/speak">← Luyện nói</a></p>
    <h1>${bi('Từ hay đọc sai', 'Tricky words')}</h1>
    ${noSTT()}
    <p class="muted small">Bấm 🔊 nghe mẫu, rồi bấm 🎙 và đọc từ đó hai lần, cách nhau một chút. Máy ghi ra đúng từ là đạt.</p>
    ${hard.length ? hard.map((x, i) => `<div class="card row" style="justify-content:space-between" data-i="${i}">
      <div><b style="font-size:1.15rem">${esc(x.w)}</b> <span class="muted small">sai ${x.miss}/${x.n} lần</span><div class="small" data-st></div></div>
      <div class="row"><button class="say" data-say>🔊</button><button class="say" data-go>🎙</button></div></div>`).join('')
    : '<div class="card"><p>Chưa có từ nào sai từ 2 lần trở lên.</p></div>'}`;
  view.querySelectorAll('.card[data-i]').forEach(card => {
    const x = hard[+card.dataset.i];
    const st = card.querySelector('[data-st]');
    const btn = card.querySelector('[data-go]');
    card.querySelector('[data-say]').onclick = () => { stopTTS(); say(x.w, { lang: accent(), rate: 0.7 }); };
    btn.onclick = async () => {
      if (session) { const s = session; session = null; btn.textContent = '🎙'; await done(s); return; }
      stopTTS();
      btn.textContent = '■';
      st.textContent = 'Đang nghe…';
      session = listen({
        lang: 'en-US',
        onText: t => { st.textContent = t; if (` ${tokens(t).join(' ')} `.includes(` ${want()} `)) { const s = session; session = null; btn.textContent = '🎙'; done(s); } },
        onError: e => { st.textContent = sttError(e); },
      });
      setTimeout(() => { if (session) { const s = session; session = null; btn.textContent = '🎙'; done(s); } }, 8000);
    };
    async function done(s) {
      const { text } = await s.stop();
      const ok = ` ${tokens(text).join(' ')} `.includes(` ${want()} `);
      store.update(st0 => { st0.pron ||= {}; const p = (st0.pron[x.w] ||= { n: 0, miss: 0 }); p.n++; if (!ok) p.miss++; });
      store.logAttempt({ item: `SW-${x.w}`, skill: 'S', type: 'S-word', correct: ok, detail: text });
      st.innerHTML = ok ? '<span style="color:var(--good)">✔ Máy đã nghe ra</span>' : `<span style="color:var(--bad)">✘ Máy nghe thành: ${esc(text || '(không có gì)')}</span>`;
    }
    const want = () => tokens(x.w).join(' ');
  });
  return () => { session?.stop(); stopTTS(); };
}

// ---------- Speaking Part 1 ----------
function part1(view, data, i) {
  const list = qset(data);
  i = Math.max(0, Math.min(list.length - 1, i));
  const q = list[i];
  let cleanupRec = null;
  view.innerHTML = `<p><a href="#/speak">← Luyện nói</a></p>
    <h1>${bi(`Part 1 · ${q.topic}`, `Question ${i + 1}/${list.length}`)}</h1>
    <div class="card">
      <p class="q" style="font-size:1.15rem;font-weight:600">${esc(q.q)} <button class="say" data-q>🔊</button></p>
      <p class="meta">Gợi ý: ${esc(q.hint)} Nói 20–40 giây, khoảng 3 câu: trả lời, lý do, ví dụ.</p>
      <div data-rec></div>
      <p class="small muted" data-live></p>
      <div data-res></div>
    </div>
    <div class="card"><details><summary><b>Câu trả lời mẫu</b> <span class="muted small">(xem sau khi đã tự nói)</span></summary>
      <p>${esc(q.sample)}</p><button class="say" data-sample>🔊 Nghe mẫu</button></details></div>
    <div class="row">${i > 0 ? `<a class="btn ghost" href="#/speak/part1/${i - 1}">← Câu trước</a>` : ''}${i + 1 < list.length ? `<a class="btn" href="#/speak/part1/${i + 1}">Câu tiếp →</a>` : '<a class="btn" href="#/speak">Xong</a>'}</div>`;
  view.querySelector('[data-q]').onclick = () => { stopTTS(); say(q.q, { lang: accent() }); };
  view.querySelector('[data-sample]').onclick = () => { stopTTS(); say(q.sample, { lang: accent() }); };
  const live = view.querySelector('[data-live]');
  const res = view.querySelector('[data-res]');
  cleanupRec = recorderWidget(view.querySelector('[data-rec]'), {
    maxSec: 60,
    transcribe: true,
    onLive: t => { live.innerHTML = `<i>${esc(t)}</i>`; },
    onDone: async (blob, mime, info) => {
      const text = info?.text || '';
      const words = wordCount(text);
      const wpm = info?.sec >= 5 ? Math.round(words / (info.sec / 60)) : 0;
      const ok = words >= 25;
      store.logAttempt({ item: `SP-${q.id}`, skill: 'S', type: 'S-part1', correct: ok, detail: `${words} từ, ${wpm} từ/phút | ${text.slice(0, 300)}` });
      res.innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}">
        <b>${text ? `Máy nghe được ${words} từ trong ${info.sec} giây${wpm ? ` (${wpm} từ/phút)` : ''}` : 'Máy không nghe ra chữ nào'}</b>
        ${text ? `<p class="small">${esc(text)}</p>` : `<p class="small">${esc(sttError(info?.error || 'no-speech'))} Bản ghi âm vẫn được lưu.</p>`}
        <p class="small muted">${!text ? '' : words < 25 ? 'Câu trả lời còn ngắn. Thử thêm lý do và một ví dụ để đủ khoảng 3 câu.' : 'Độ dài tốt cho Part 1.'} Khoảng 90–120 từ/phút là tốc độ nói tự nhiên; chậm hơn cũng được, miễn không ngắt quá lâu.</p>
        <p class="small" data-up>${store.apiOn() ? 'Đang gửi bản ghi…' : ''}</p></div>`;
      if (!store.apiOn()) return;
      const up = res.querySelector('[data-up]');
      try {
        await store.api({ action: 'audio', data: await blobToBase64(blob), mime, question: q.q, label: `part1-${q.id}`, source: 'Luyện nói Part 1', transcript: text, words, seconds: info?.sec || 0 });
        up.textContent = 'Đã gửi bản ghi và phần chữ về bảng tính để chấm.';
      } catch (e) { up.textContent = 'Gửi không được: ' + e.message; }
    },
  });
  return () => { cleanupRec?.(); stopTTS(); };
}
