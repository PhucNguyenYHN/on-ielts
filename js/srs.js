// Ôn lặp ngắt quãng rút gọn từ SM-2. Điểm: 0 quên, 1 khó, 2 nhớ.
const DAY = 864e5;
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function review(card, grade, now = Date.now()) {
  const c = card ? { ...card } : { ease: 2.5, ivl: 0, reps: 0, lapses: 0 };
  if (grade === 0) {
    c.reps = 0;
    c.ivl = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.lapses = (c.lapses || 0) + 1;
    c.due = now;
  } else {
    c.reps += 1;
    if (c.reps === 1) c.ivl = 1;
    else if (c.reps === 2) c.ivl = grade === 1 ? 2 : 3;
    else c.ivl = Math.max(c.ivl + 1, Math.round(c.ivl * (grade === 1 ? 1.2 : c.ease)));
    c.ease = grade === 1 ? Math.max(1.3, c.ease - 0.15) : c.ease + 0.05;
    c.due = startOfDay(now) + c.ivl * DAY; // đến hạn từ đầu ngày, không phụ thuộc giờ học
  }
  c.last = now;
  return c;
}

export function dueIds(srs, now = Date.now()) {
  return Object.keys(srs).filter(k => srs[k].due <= now).sort((a, b) => srs[a].due - srs[b].due);
}

export const learnedCount = srs => Object.values(srs).filter(c => c.ivl >= 1).length;
