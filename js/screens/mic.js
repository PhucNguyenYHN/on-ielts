// Thử micro: xác nhận ghi âm chạy trên máy này và gửi kết quả về Sheets để anh biết.
import * as store from '../store.js';
import { esc, bi } from '../util.js';
import { micSupport, recorderWidget, blobToBase64 } from '../recorder.js';

export default function mic(view) {
  const sup = micSupport();
  const yes = v => (v ? '✔ có' : '✘ không');
  view.innerHTML = `<h1>${bi('Thử micro', 'Microphone check')}</h1>
    <div class="card"><table class="res">
      <tr><th>Kết nối bảo mật (https)</th><td>${yes(sup.secure)}</td></tr>
      <tr><th>Truy cập micro</th><td>${yes(sup.getUserMedia)}</td></tr>
      <tr><th>Ghi âm (MediaRecorder)</th><td>${yes(sup.mediaRecorder)}</td></tr>
      <tr><th>Định dạng</th><td>${esc(sup.mime || 'mặc định')}</td></tr>
    </table></div>
    <div class="card"><p>Bấm Ghi âm, nói một câu như <i>"My name is Thao and I study pharmacy"</i>, bấm Dừng rồi nghe lại.</p>
      <div data-rec></div><p class="small" data-st></p></div>
    <div class="card"><h3>Nếu không ghi âm được trên iPhone</h3>
      <p class="meta">Vào Cài đặt → Safari → Micrô, chọn Hỏi hoặc Cho phép. Sau đó mở lại app bằng Safari (không mở trong Zalo hay Messenger).</p></div>`;
  const st = view.querySelector('[data-st]');
  const report = (ok, mime, error = '') => {
    store.update(s => { s.device = { ok, mime, at: Date.now() }; });
    if (store.apiOn()) store.api({ action: 'device', ua: navigator.userAgent, ok, mime, error }).catch(() => {});
  };
  if (!sup.getUserMedia || !sup.mediaRecorder) {
    st.textContent = 'Trình duyệt này không hỗ trợ ghi âm.';
    report(false, '', 'unsupported');
    return;
  }
  const stopWidget = recorderWidget(view.querySelector('[data-rec]'), {
    maxSec: 15,
    onDone: async (blob, mime) => {
      if (blob.size < 500) { st.textContent = 'Bản ghi rỗng, micro có thể bị chặn.'; report(false, mime, 'empty'); return; }
      st.textContent = `Ghi được ${Math.round(blob.size / 1024)} KB. Nghe lại thấy rõ là micro chạy tốt.`;
      report(true, mime);
      if (store.apiOn()) {
        try {
          await store.api({ action: 'audio', data: await blobToBase64(blob), mime, question: 'Thử micro', label: 'thu-micro', source: 'Thử micro' });
          st.textContent += ' Đã gửi thử lên Google Drive.';
        } catch (e) { st.textContent += ' Gửi lên Drive không được: ' + e.message; }
      }
    },
  });
  // Lỗi mở micro hiện trong khối ghi âm; ghi lại để anh biết máy nào không chạy
  const obs = new MutationObserver(() => {
    const t = view.querySelector('[data-rec] [data-st]')?.textContent || '';
    if (t.startsWith('Không mở được micro')) report(false, sup.mime, t);
  });
  obs.observe(view.querySelector('[data-rec]'), { subtree: true, childList: true, characterData: true });
  return () => { obs.disconnect(); stopWidget(); };
}
