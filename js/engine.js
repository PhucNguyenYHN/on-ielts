// Cá nhân hóa: chọn bài theo tỉ lệ sai thực tế của từng dạng câu.
import { today } from './util.js';

export const PLACEMENT_SECTIONS = ['grammar', 'vocab', 'listening', 'reading', 'writing', 'speaking'];

// Tỉ lệ sai của mỗi dạng, tính trên tối đa `last` lượt gần nhất
export function typeStats(attempts, last = 30) {
  const by = {};
  for (let k = attempts.length - 1; k >= 0; k--) {
    const a = attempts[k];
    const b = (by[a.t] ??= { n: 0, wrong: 0 });
    if (b.n >= last) continue;
    b.n++;
    if (!a.c) b.wrong++;
  }
  return by;
}

export function weakTypes(attempts, minN = 5) {
  return Object.entries(typeStats(attempts))
    .filter(([, b]) => b.n >= minN)
    .map(([t, b]) => ({ t, rate: b.wrong / b.n, n: b.n }))
    .sort((a, b) => b.rate - a.rate);
}

// Ưu tiên bài có dạng sai trên 30% gần đây; nếu không có thì bài tiếp theo chưa đạt 80%
export function recommendLesson(s, lessons) {
  const stats = typeStats(s.attempts);
  let best = null, bestRate = 0.3;
  for (const l of lessons) {
    const b = stats[l.tag];
    if (b && b.n >= 3 && b.wrong / b.n > bestRate) { best = l; bestRate = b.wrong / b.n; }
  }
  if (best) return { lesson: best, why: `Gần đây sai ${Math.round(bestRate * 100)}% ở dạng này` };
  const next = lessons.find(l => (s.grammar[l.id] ?? 0) < 80);
  if (!next) return null;
  return { lesson: next, why: s.grammar[next.id] != null ? `Lần trước đạt ${s.grammar[next.id]}%, cần 80%` : 'Bài tiếp theo' };
}

export function newWordsLeft(s, quota) {
  return s.newToday.date === today() ? Math.max(0, quota - s.newToday.n) : quota;
}

// Bảng quy đổi điểm thô (trên 40 câu) sang band, theo bảng công bố phổ biến
const LISTENING = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 2]];
const READING_AC = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 2]];
export function toBand(score, total, skill) {
  const raw = Math.round((score / total) * 40);
  const table = skill === 'listening' ? LISTENING : READING_AC;
  return table.find(([min]) => raw >= min)[1];
}
