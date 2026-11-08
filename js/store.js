// Trạng thái học: lưu trên máy (localStorage) và đồng bộ lên Apps Script để dùng chung giữa iPhone và máy tính.
import { CONFIG } from './config.js';
import { today } from './util.js';

const KEY = 'ielts.state.v1';
const QKEY = 'ielts.queue.v1';

const blank = () => ({
  v: 1, updatedAt: 0,
  srs: {},                      // từ -> thẻ ôn lặp ngắt quãng
  newToday: { date: '', n: 0 }, // số từ mới đã học hôm nay
  days: {},                     // ngày -> số phút học
  attempts: [],                 // 400 lượt làm gần nhất: { t: dạng, c: 1/0, ts }
  grammar: {},                  // mã bài -> điểm cao nhất (%)
  placement: {},                // phần -> kết quả kiểm tra đầu vào
  device: null,                 // kết quả thử micro
  pron: {},                     // từ -> { n lần đọc, miss lần máy không nghe ra }
  prefs: { accent: 'en-GB' },
});

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}

let state = { ...blank(), ...read(KEY, {}) };
let queue = read(QKEY, []);

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(QKEY, JSON.stringify(queue));
  } catch { /* trình duyệt chặn lưu: vẫn chạy, chỉ mất khi tải lại */ }
}

export const get = () => state;

export function update(fn) {
  fn(state);
  state.updatedAt = Date.now();
  persist();
  schedulePush();
}

// Ghi một lượt làm bài. skill: V từ vựng, G ngữ pháp, L nghe, R đọc, W viết, S nói
export function logAttempt({ item, skill, type, correct, ms = 0, detail = '' }) {
  const ts = Date.now();
  update(s => {
    s.attempts.push({ t: type, c: correct ? 1 : 0, ts });
    if (s.attempts.length > 400) s.attempts.splice(0, s.attempts.length - 400);
  });
  queue.push({ ts, date: today(), item, skill, type, correct: !!correct, ms, detail });
  persist();
  flushSoon();
}

export function addMinutes(m) {
  update(s => { const d = today(); s.days[d] = Math.round(((s.days[d] || 0) + m) * 10) / 10; });
}

// ---- Đồng bộ ----
const listeners = new Set();
let status = CONFIG.apiUrl ? 'ok' : 'off';
export function onStatus(fn) { listeners.add(fn); fn(status); }
function setStatus(s) { status = s; listeners.forEach(fn => fn(s)); }
export const apiOn = () => !!CONFIG.apiUrl;

// Gửi dạng text/plain để trình duyệt không phải hỏi CORS trước (Apps Script không trả lời OPTIONS)
export async function api(payload) {
  if (!apiOn()) throw new Error('Chưa cấu hình máy chủ');
  const r = await fetch(CONFIG.apiUrl, { method: 'POST', body: JSON.stringify({ ...payload, token: CONFIG.token }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Lỗi máy chủ');
  return j;
}

let flushing = false, flushT;
function flushSoon() { clearTimeout(flushT); flushT = setTimeout(flush, 1500); }
export async function flush() {
  if (!apiOn() || flushing || !queue.length) return;
  flushing = true;
  setStatus('busy');
  const rows = queue.slice(0, 200);
  try {
    await api({ action: 'log', rows });
    queue.splice(0, rows.length);
    persist();
    setStatus('ok');
  } catch { setStatus('err'); }
  finally { flushing = false; }
  if (queue.length && status === 'ok') flushSoon();
}

let pushT;
function schedulePush() { clearTimeout(pushT); pushT = setTimeout(pushState, 5000); }
export async function pushState() {
  if (!apiOn()) return;
  clearTimeout(pushT);
  try { await api({ action: 'state', state }); setStatus('ok'); } catch { setStatus('err'); }
}

// Lấy trạng thái từ máy chủ; bản nào mới hơn thì dùng bản đó
export async function pullState(force = false) {
  if (!apiOn()) return false;
  try {
    const r = await fetch(`${CONFIG.apiUrl}?action=state&token=${encodeURIComponent(CONFIG.token)}`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    setStatus('ok');
    if (j.state && (force || j.state.updatedAt > state.updatedAt)) {
      state = { ...blank(), ...j.state };
      persist();
      return true;
    }
    if (!j.state || j.state.updatedAt < state.updatedAt) pushState();
  } catch { setStatus('err'); }
  return false;
}

// ---- Bài viết đã nộp và điểm chấm (đọc từ tab BaiViet, lưu đệm trên máy) ----
const WKEY = 'ielts.writings.v1';
export const cachedWritings = () => read(WKEY, []);
export async function fetchWritings() {
  if (!apiOn()) return cachedWritings();
  const r = await fetch(`${CONFIG.apiUrl}?action=writings&token=${encodeURIComponent(CONFIG.token)}`);
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.writings)) throw new Error(j.error || 'Máy chủ chưa có lệnh đọc bài viết');
  try { localStorage.setItem(WKEY, JSON.stringify(j.writings)); } catch { /* bỏ qua */ }
  return j.writings;
}
// Bài đã có điểm mà em chưa mở xem
export function unseenGraded(list = cachedWritings()) {
  const seen = state.seenGrades || {};
  return list.filter(w => (w.score || w.comment) && seen[w.ts] !== w.score + '|' + w.comment);
}
export function markSeen(w) {
  update(s => { s.seenGrades ||= {}; s.seenGrades[w.ts] = w.score + '|' + w.comment; });
}

export function resetLocal() {
  state = blank();
  queue = [];
  persist();
}

export const pendingCount = () => queue.length;

addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { flush(); if (pushT) pushState(); }
});
addEventListener('online', () => { flush(); pushState(); });
