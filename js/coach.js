// Huấn luyện viên: lời khen, lời động viên, và hướng dẫn sửa khi làm sai.
import { esc, loadContent, xung } from './util.js';
import { ring } from './fx.js';

const pick = a => a[(Math.random() * a.length) | 0];

export const praise = streak => xung(praise0(streak));
const praise0 = streak => streak >= 5
  ? pick([`${streak} câu đúng liên tiếp! Em đang vào phong độ 🔥`, `Chuỗi ${streak} câu đúng, giữ nhịp này nhé 🔥`, `${streak} câu liền không sai, tuyệt vời 🔥`])
  : streak >= 3
    ? pick([`${streak} câu đúng liên tiếp 👏`, `Đúng ${streak} câu liền rồi đấy 👏`])
    : pick(['Chính xác!', 'Đúng rồi!', 'Giỏi lắm!', 'Chuẩn!', 'Làm tốt lắm!', 'Đúng, em nắm được rồi!']);

export const comfort = () => xung(pick([
  'Chưa đúng, nhưng sai ở đây là để nhớ lâu hơn.',
  'Không sao, câu này nhiều người nhầm.',
  'Gần đúng rồi, xem lại chỗ sai bên dưới nhé.',
  'Sai một lần, nhớ cả đời. Đọc kỹ phần sửa nhé.',
  'Đừng nản, mỗi lỗi sửa được là thêm một bước tới 5.5.',
]));

// Lời kết buổi theo tỉ lệ đúng
export function endMessage(pct) {
  if (pct >= 90) return { title: 'Xuất sắc!', text: 'Em gần như không sai câu nào. Giữ phong độ này mỗi ngày nhé.', party: true };
  if (pct >= 80) return { title: 'Đạt rồi!', text: 'Kết quả rất tốt. Xem lại vài câu sai bên dưới là chắc kiến thức.', party: true };
  if (pct >= 60) return { title: 'Khá lắm', text: 'Em đã nắm phần lớn. Đọc kỹ phần sửa lỗi rồi làm lại để vượt 80%.', party: false };
  if (pct >= 40) return { title: 'Đang tiến bộ', text: 'Đây là phần cần luyện thêm. Mỗi lần làm lại em sẽ thấy dễ hơn.', party: false };
  return { title: 'Bắt đầu thôi', text: 'Phần này còn mới với em, hoàn toàn bình thường. Đọc lại bài học rồi thử lại nhé.', party: false };
}

// Khối kết quả lớn có vòng phần trăm
export function resultCard(pct, extra = '') {
  const m = endMessage(pct);
  return { html: `<div class="card result-big">${ring(pct / 100, { size: 110, stroke: 10, label: pct + '%' })}
    <h3>${m.title}</h3><p class="meta">${xung(m.text)}</p>${extra}</div>`, party: m.party };
}

let tipsP = null;
export const tips = () => (tipsP ??= loadContent('tips').catch(() => ({})));

// Hướng dẫn sửa: em chọn gì, đúng là gì, vì sao, mẹo nhớ
export function fixBox({ given, right, explain, tag, sentence }, T = {}) {
  const t = T[tag] || {};
  return `<div class="fix">
    ${given != null ? `<div class="fix-row"><span class="fix-k no">Em chọn</span><span class="strike">${esc(given)}</span></div>` : ''}
    <div class="fix-row"><span class="fix-k ok">Đúng là</span><b>${esc(right)}</b></div>
    ${sentence ? `<div class="fix-row"><span class="fix-k">Câu đúng</span><span>${sentence}</span></div>` : ''}
    ${explain || t.rule ? `<div class="fix-row"><span class="fix-k">Vì sao</span><span>${esc(explain || t.rule)}</span></div>` : ''}
    ${t.tip ? `<div class="fix-tip">💡 <b>Mẹo nhớ:</b> ${esc(t.tip)}</div>` : ''}
    ${t.trap ? `<div class="fix-trap">⚠️ <b>Lỗi hay gặp:</b> ${esc(t.trap)}</div>` : ''}
  </div>`;
}

// Điền đáp án vào chỗ trống ___ để em thấy cả câu đúng
export const fillBlank = (q, ans) => q.includes('___') ? esc(q).replace('___', `<mark>${esc(ans)}</mark>`) : '';

// So từng chữ cái giữa từ em gõ và từ đúng, kèm gợi ý quy tắc chính tả
export function spellingDiff(given, right) {
  const a = String(given).toLowerCase().trim(), b = String(right).toLowerCase().trim();
  // dãy con chung dài nhất theo chữ cái
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0, mine = '', fix = '';
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { mine += esc(a[i]); fix += esc(b[j]); i++; j++; }
    else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) { fix += `<ins>${esc(b[j])}</ins>`; mine += '<span class="gap">_</span>'; j++; }
    else { mine += `<del>${esc(a[i])}</del>`; i++; }
  }
  const hints = [];
  if (/(.)\1/.test(b) && !/(.)\1/.test(a)) hints.push(`Từ này có chữ cái đôi: ${esc(b.match(/(.)\1/)[0])}.`);
  if (b.endsWith('e') && !a.endsWith('e')) hints.push('Đừng quên chữ e câm ở cuối từ.');
  if (b.endsWith('ly') && !a.endsWith('ly')) hints.push('Trạng từ thường kết thúc bằng -ly (sharp → sharply).');
  if (/tion$/.test(b) && !/tion$/.test(a)) hints.push('Âm "sần" cuối từ thường viết là -tion.');
  if (b.endsWith('s') && a === b.slice(0, -1)) hints.push('Thiếu -s ở cuối. Trong Listening thiếu -s là mất điểm.');
  if (/[aeiou]{2}/.test(b) && !/[aeiou]{2}/.test(a)) hints.push(`Chú ý cụm nguyên âm "${esc(b.match(/[aeiou]{2}/)[0])}".`);
  if (!hints.length && a.length && Math.abs(a.length - b.length) <= 2) hints.push('Gần đúng rồi, chỉ sai vài chữ cái. Đọc to từ đó và đánh vần từng chữ.');
  return `<div class="spell"><div><span class="fix-k no">Em gõ</span> <span class="mono">${mine || '(trống)'}</span></div>
    <div><span class="fix-k ok">Đúng là</span> <span class="mono">${fix}</span></div>
    ${hints.length ? `<div class="fix-tip">💡 ${hints.join(' ')}</div>` : ''}</div>`;
}
