// Khóa tài khoản bằng mã PIN 4 số. Máy chủ giữ mã đã băm và kiểm tra mọi yêu cầu của tài khoản có khóa.
// Mã chỉ băm trên máy rồi mới gửi đi; trên máy này lưu bản băm để không phải nhập lại.
import { CONFIG, USER, switchUser } from './config.js';
import { esc } from './util.js';

const KEY = `ielts.pin.${USER}`;
export const getPin = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const setPin = h => { try { localStorage.setItem(KEY, h); } catch { /* bỏ qua */ } };
export const forgetPin = () => { try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ } };

async function hash(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ielts-pin:${USER}:${pin}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hỏi máy chủ: chưa đặt mã (NOPIN), cần mã (PIN), hay mã đang lưu còn đúng ('')
async function status(pinHash) {
  const r = await fetch(`${CONFIG.apiUrl}?action=state&token=${encodeURIComponent(CONFIG.token)}&user=${USER}&pin=${pinHash}`);
  const j = await r.json();
  return j.ok ? '' : j.error;
}

// Trả về Promise, xong khi đã mở khóa. Tài khoản không có khóa hoặc chưa nối máy chủ thì qua luôn.
export async function unlock(root) {
  if (!CONFIG.pin || !CONFIG.apiUrl) return;
  let st;
  try { st = await status(getPin()); } catch { if (getPin()) return; st = 'PIN'; } // mất mạng mà đã có mã thì cho học offline
  if (!st) return;
  forgetPin();
  const creating = st === 'NOPIN';
  return new Promise(resolve => {
    let first = '';
    const draw = (msg = '') => {
      const title = creating ? (first ? 'Nhập lại mã để xác nhận' : 'Tạo mã PIN 4 số') : 'Nhập mã PIN';
      root.innerHTML = `<div class="card result-big lock">
        <div class="lock-ic">🔒</div>
        <h3>Tài khoản ${esc(CONFIG.learner)}</h3>
        <p class="meta">${title}</p>
        <input class="inp pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" type="password" aria-label="Mã PIN">
        <p class="small" style="color:var(--bad)" data-msg>${esc(msg)}</p>
        ${creating && !first ? '<p class="muted small">Mã này bảo vệ tiến độ và bài viết của tài khoản. Trên mỗi máy chỉ cần nhập một lần.</p>' : ''}
        <button class="btn ghost" data-back>Quay lại hồ sơ Thảo</button></div>`;
      const inp = root.querySelector('.pin');
      inp.focus();
      root.querySelector('[data-back]').onclick = () => switchUser('thao');
      inp.oninput = async () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 4);
        if (inp.value.length < 4) return;
        const pin = inp.value;
        inp.disabled = true;
        try {
          if (creating && !first) { first = pin; return draw(); }
          if (creating) {
            if (pin !== first) { first = ''; return draw('Hai lần nhập không khớp, làm lại nhé.'); }
            const h = await hash(pin);
            const r = await fetch(CONFIG.apiUrl, { method: 'POST', body: JSON.stringify({ action: 'setpin', token: CONFIG.token, user: USER, pinNew: h }) });
            const j = await r.json();
            if (!j.ok) return draw(j.error || 'Không đặt được mã.');
            setPin(h); return resolve();
          }
          const h = await hash(pin);
          if (await status(h)) return draw('Mã chưa đúng.');
          setPin(h); resolve();
        } catch { draw('Mất kết nối, thử lại sau.'); }
      };
    };
    draw();
  });
}
