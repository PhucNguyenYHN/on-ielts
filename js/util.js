export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Nhãn song ngữ: tiếng Việt, dòng nhỏ tiếng Anh bên dưới
export const bi = (vn, en) => `${esc(vn)}<span class="en">${esc(en)}</span>`;

const pad = n => String(n).padStart(2, '0');
export function today(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return today(d);
}

// Số ngày học liên tục, tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa học)
export function streak(days) {
  let d = today();
  if (!(days[d] > 0)) d = addDays(d, -1);
  let n = 0;
  while (days[d] > 0) { n++; d = addDays(d, -1); }
  return n;
}

// Số buổi trong tuần hiện tại (thứ Hai đến Chủ nhật)
export function weekCount(days, minMinutes) {
  const dow = (new Date().getDay() + 6) % 7;
  let d = addDays(today(), -dow), n = 0;
  for (let i = 0; i < 7; i++) { if ((days[d] || 0) >= minMinutes) n++; d = addDays(d, 1); }
  return n;
}

export function norm(s) {
  return String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// So câu trả lời gõ tay với danh sách đáp án chấp nhận, bỏ qua hoa thường, dấu câu, khoảng trắng
export function checkText(value, answers) {
  const a = norm(value);
  return answers.some(x => { const b = norm(x); return b === a || b.replace(/ /g, '') === a.replace(/ /g, ''); });
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const wordCount = s => (String(s).trim().match(/[A-Za-z0-9'’-]+/g) || []).length;

export function mmss(sec) {
  const s = Math.abs(Math.round(sec));
  return `${sec < 0 ? '-' : ''}${Math.floor(s / 60)}:${pad(s % 60)}`;
}

// Đồng hồ đếm ngược; trả về hàm dừng
export function countdown(el, seconds, onEnd) {
  const end = Date.now() + seconds * 1000;
  let ended = false;
  const tick = () => {
    const left = (end - Date.now()) / 1000;
    el.textContent = mmss(left);
    el.classList.toggle('over', left < 0);
    if (left <= 0 && !ended) { ended = true; onEnd?.(); }
  };
  tick();
  const id = setInterval(tick, 500);
  return () => clearInterval(id);
}

const cache = {};
export const loadContent = name => (cache[name] ??= fetch(`content/${name}.json`).then(r => r.json()));
