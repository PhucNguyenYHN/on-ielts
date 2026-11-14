// Giải mã đề thi đã mã hóa trong thư mục tests/ bằng mã mở đề (nhập một lần trên mỗi máy).
// Mã mở đề chỉ lưu trên máy này; trong kho chỉ có dữ liệu đã mã hóa.
const KEY = 'ielts.vault';
let cached = null; // CryptoKey của phiên này

const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function meta() {
  const r = await fetch('tests/meta.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('nometa');
  return r.json();
}
async function derive(pass, m) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(m.salt), iterations: m.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}
const open = (key, buf) => crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));

export const hasVault = async () => { try { await meta(); return true; } catch { return false; } };
export const savedPass = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const forget = () => { cached = null; try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ } };

// Thử mã mở đề; đúng thì lưu lại trên máy
export async function unlock(pass) {
  const m = await meta();
  const key = await derive(pass.trim(), m);
  try {
    const out = new TextDecoder().decode(await open(key, b64(m.check)));
    if (out !== 'hi-ielts') return false;
  } catch { return false; }
  cached = key;
  try { localStorage.setItem(KEY, pass.trim()); } catch { /* bỏ qua */ }
  return true;
}
async function key() {
  if (cached) return cached;
  const p = savedPass();
  if (!p || !(await unlock(p))) throw new Error('locked');
  return cached;
}
async function bytes(file) {
  const r = await fetch(`tests/${file}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error('missing ' + file);
  return new Uint8Array(await r.arrayBuffer());
}
export async function readJSON(file) {
  return JSON.parse(new TextDecoder().decode(await open(await key(), await bytes(file))));
}
export async function readBlobURL(file, type = 'audio/mpeg') {
  return URL.createObjectURL(new Blob([await open(await key(), await bytes(file))], { type }));
}
