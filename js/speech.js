// Nhận giọng nói thành chữ (Web Speech API). Safari trên iPhone dùng bộ nhận giọng của Apple,
// cần bật Đọc chính tả trong Cài đặt. Chrome trên máy tính gửi tiếng lên máy chủ Google.
import { norm } from './util.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const sttSupport = () => !!SR;

// Giải thích lỗi bằng tiếng Việt để em tự sửa được
export function sttError(code) {
  return ({
    'not-allowed': 'Máy chưa cho phép nhận giọng nói. Trên iPhone: Cài đặt → Safari → Micrô chọn Cho phép, và Cài đặt → Chung → Bàn phím → bật Đọc chính tả.',
    'service-not-allowed': 'Nhận giọng nói đang tắt. Trên iPhone: Cài đặt → Chung → Bàn phím → bật Đọc chính tả, rồi mở lại app.',
    'audio-capture': 'Không lấy được tiếng từ micro.',
    'network': 'Mất mạng nên máy không nhận được giọng nói.',
    'no-speech': 'Máy chưa nghe thấy tiếng nói. Nói to và gần micro hơn.',
    'unsupported': 'Trình duyệt này không có chức năng nhận giọng nói. Trên iPhone dùng Safari, trên máy tính dùng Chrome hoặc Edge.',
  })[code] || `Lỗi nhận giọng nói (${code}).`;
}

/**
 * Bắt đầu nghe. Trả về { stop(): Promise<{text, error}> }.
 * onText(text) được gọi liên tục khi máy nghe ra chữ mới.
 * Safari hay tự dừng khi im lặng; trong lúc còn nghe thì tự mở lại và giữ phần chữ đã có.
 */
export function listen({ lang = 'en-US', onText, onError } = {}) {
  if (!SR) {
    onError?.('unsupported');
    return { stop: async () => ({ text: '', error: 'unsupported' }) };
  }
  let active = true, committed = '', session = '', error = '', rec = null, endResolve = null, restarts = 0;
  const full = () => [committed, session].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  function start() {
    rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = e => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += ' ' + e.results[i][0].transcript;
      session = t.trim();
      onText?.(full());
    };
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      error = e.error;
      active = false;
      onError?.(e.error);
    };
    rec.onend = () => {
      committed = full();
      session = '';
      if (active && restarts < 20) { restarts++; try { start(); return; } catch { /* dừng hẳn */ } }
      active = false;
      ended = true;
      endResolve?.();
    };
    rec.start();
  }
  let ended = false;
  try { start(); } catch (e) { error = e.name || 'start'; active = false; ended = true; onError?.(error); }

  return {
    stop: () => new Promise(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve({ text: full(), error }); } };
      if (ended) return finish();
      active = false;
      endResolve = finish;
      setTimeout(finish, 1500); // Safari đôi khi không báo kết thúc
      try { rec.stop(); } catch { finish(); }
    }),
  };
}

// ---- So câu đọc với câu mẫu ----
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth', 30: 'thirtieth' };

function numWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numWords(n % 100) : '');
  if (n < 10000) return numWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numWords(n % 1000) : '');
  return String(n);
}

const CONTR = {
  "i'm": 'i am', "it's": 'it is', "that's": 'that is', "there's": 'there is', "he's": 'he is', "she's": 'she is',
  "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not', cannot: 'can not', "won't": 'will not',
  "isn't": 'is not', "aren't": 'are not', "i've": 'i have', "we're": 'we are', "they're": 'they are', "you're": 'you are',
  "i'd": 'i would', "i'll": 'i will', ok: 'okay',
};

// Chữ → danh sách từ đã chuẩn hóa (bỏ dấu câu, đổi số ra chữ, tách từ viết tắt)
export function tokens(s) {
  const out = [];
  norm(String(s).replace(/(\d),(\d{3})/g, '$1$2').replace(/\$(\d+)/g, '$1 dollars').replace(/(\d):(\d)/g, '$1 $2').replace(/%/g, ' percent')).split(' ').filter(Boolean).forEach(w => {
    let m;
    if (CONTR[w]) out.push(...CONTR[w].split(' '));
    else if ((m = w.match(/^(\d+)(st|nd|rd|th)$/))) {
      const n = +m[1];
      out.push(...(ORD[n] || (n > 20 && n < 100 && ORD[n % 10] ? TENS[Math.floor(n / 10)] + ' ' + ORD[n % 10] : w)).split(' '));
    } else if (/^\d+$/.test(w)) out.push(...numWords(+w).split(' '));
    else out.push(w.replace(/^'+|'+$/g, ''));
  });
  return out.filter(Boolean);
}

/**
 * So chữ máy nghe được với câu mẫu (dãy con chung dài nhất).
 * Trả về words: [{ w: từ hiển thị, ok }], score 0–1, missed: các từ đọc chưa ra.
 */
export function compare(target, heard) {
  const display = String(target).split(/\s+/).filter(Boolean);
  const parts = display.map(w => tokens(w));
  const T = parts.flat();
  const H = tokens(heard);
  const dp = Array.from({ length: T.length + 1 }, () => new Uint16Array(H.length + 1));
  for (let i = T.length - 1; i >= 0; i--) {
    for (let j = H.length - 1; j >= 0; j--) {
      dp[i][j] = T[i] === H[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(T.length).fill(false);
  for (let i = 0, j = 0; i < T.length && j < H.length;) {
    if (T[i] === H[j]) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  let k = 0;
  const words = display.map((w, idx) => {
    const n = parts[idx].length;
    const ok = n === 0 || hit.slice(k, k + n).every(Boolean);
    k += n;
    return { w, ok, key: parts[idx].join(' ') };
  });
  const scored = words.filter(x => x.key);
  const good = scored.filter(x => x.ok).length;
  return {
    words,
    score: scored.length ? good / scored.length : 0,
    missed: [...new Set(scored.filter(x => !x.ok).map(x => x.key))],
  };
}
