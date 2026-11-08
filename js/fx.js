// Hiệu ứng ăn mừng nhẹ: pháo giấy khi xong một buổi hoặc đạt kết quả tốt.
// Tôn trọng cài đặt "giảm chuyển động" của máy.
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function confetti(n = 90) {
  if (reduce()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#7c3aed', '#2563eb', '#ea580c', '#16a34a', '#db2777', '#0d9488', '#facc15'];
  const parts = Array.from({ length: n }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 4,
    w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  (function frame(t) {
    const life = (t - t0) / 1600;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - life);
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (life < 1) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

// Vòng tiến độ SVG: value 0–1
export function ring(value, { size = 64, stroke = 7, label = '' } = {}) {
  const r = (size - stroke) / 2, len = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" class="ring-fg"
      stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - v)}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${label ? `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" class="ring-t">${label}</text>` : ''}
  </svg>`;
}
