// Bài viết của em: danh sách bài đã nộp, điểm và nhận xét anh ghi trong bảng tính.
import * as store from '../store.js';
import { esc, bi } from '../util.js';

const fmt = ts => new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const para = s => esc(s).replace(/\n/g, '<br>');

export default async function writingScreen(view, [id]) {
  let list = store.cachedWritings(), err = '';
  try { list = await store.fetchWritings(); } catch (e) { err = e.message; }
  if (id) return detail(view, list, Number(id));
  const unseen = new Set(store.unseenGraded(list).map(w => w.ts));
  view.innerHTML = `<h1>${bi('Bài viết của em', 'My writing')}</h1>
    ${err ? `<div class="card"><p class="meta">Chưa tải được bài mới (${esc(err)}). Đang hiện bản lưu trên máy.</p></div>` : ''}
    ${list.length ? list.map(w => `<a class="card" href="#/writing/${w.ts}">
      <h3>${w.score ? `Band ${esc(w.score)}` : 'Chờ chấm'} ${unseen.has(w.ts) ? '<span class="badge warn">Mới chấm</span>' : w.score ? '<span class="badge done">Đã xem</span>' : ''}</h3>
      <div class="meta">${fmt(w.ts)} · ${esc(w.source || '')} · ${w.words} từ trong ${w.minutes} phút</div>
      <div class="meta">${esc(w.prompt.slice(0, 110))}${w.prompt.length > 110 ? '…' : ''}</div></a>`).join('')
    : '<div class="card"><p>Em chưa nộp bài viết nào.</p></div>'}`;
}

function detail(view, list, ts) {
  const w = list.find(x => x.ts === ts);
  if (!w) { view.innerHTML = '<p><a href="#/writing">← Bài viết của em</a></p><div class="card"><p>Không tìm thấy bài này.</p></div>'; return; }
  if (w.score || w.comment) store.markSeen(w);
  view.innerHTML = `<p><a href="#/writing">← Bài viết của em</a></p>
    <h1>${w.score ? bi(`Band ${w.score}`, 'Estimated score') : bi('Chờ chấm', 'Not graded yet')}</h1>
    <div class="card"><p class="meta">${fmt(w.ts)} · ${esc(w.source || '')} · ${w.words} từ trong ${w.minutes} phút</p>
      <p><b>${esc(w.prompt)}</b></p></div>
    ${w.comment ? `<div class="card"><h3>Nhận xét</h3><p>${para(w.comment)}</p></div>` : '<div class="card"><p class="meta">Bài chưa có nhận xét. Khi anh chấm xong, nhận xét sẽ hiện ở đây.</p></div>'}
    <div class="card"><h3>Bài em viết</h3><p class="small" style="white-space:pre-wrap">${esc(w.text)}</p></div>`;
}
