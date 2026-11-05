// Thử micro: xác nhận ghi âm và nhận giọng nói chạy trên máy này, gửi kết quả về Sheets để anh biết.
import * as store from '../store.js';
import { esc, bi } from '../util.js';
import { micSupport, recorderWidget, blobToBase64 } from '../recorder.js';
import { sttSupport, sttError, listen, compare } from '../speech.js';

const SENT = 'My name is Thao and I study pharmacy.';

export default function mic(view) {
  const sup = micSupport();
  const stt = sttSupport();
  const yes = v => (v ? '✔ có' : '✘ không');
  view.innerHTML = `<h1>${bi('Thử micro', 'Microphone check')}</h1>
    <div class="card"><table class="res">
      <tr><th>Kết nối bảo mật (https)</th><td>${yes(sup.secure)}</td></tr>
      <tr><th>Truy cập micro</th><td>${yes(sup.getUserMedia)}</td></tr>
      <tr><th>Ghi âm (MediaRecorder)</th><td>${yes(sup.mediaRecorder)}</td></tr>
      <tr><th>Định dạng</th><td>${esc(sup.mime || 'mặc định')}</td></tr>
      <tr><th>Nhận giọng nói thành chữ</th><td>${yes(stt)}</td></tr>
    </table></div>
    <div class="card"><h3>1. Nhận giọng nói</h3>
      <p>Bấm nút rồi đọc: <i>"${esc(SENT)}"</i></p>
      <button class="btn" data-stt ${stt ? '' : 'disabled'}>🎙 Bắt đầu</button>
      <p class="small" data-sst>${stt ? '' : esc(sttError('unsupported'))}</p></div>
    <div class="card"><h3>2. Ghi âm (kèm nhận chữ)</h3>
      <p>Bấm Ghi âm, nói lại câu trên, bấm Dừng rồi nghe lại.</p>
      <div data-rec></div><p class="small" data-st></p></div>
    <div class="card"><h3>Nếu không chạy trên iPhone</h3>
      <ul class="points meta">
        <li>Mở app bằng Safari, không mở trong Zalo hay Messenger.</li>
        <li>Cài đặt → Safari → Micrô: chọn Hỏi hoặc Cho phép.</li>
        <li>Nhận giọng nói cần bật Cài đặt → Chung → Bàn phím → <b>Đọc chính tả</b>.</li>
      </ul></div>`;
  const report = extra => {
    const d = { ...(store.get().device || {}), ...extra, at: Date.now() };
    store.update(s => { s.device = d; });
    if (store.apiOn()) store.api({ action: 'device', ua: navigator.userAgent, ok: !!d.ok, mime: d.mime || '', error: d.error || '', stt: d.stt || '' }).catch(() => {});
  };

  // ---- Thử nhận giọng nói riêng ----
  let session = null;
  const sbtn = view.querySelector('[data-stt]'), sst = view.querySelector('[data-sst]');
  sbtn.onclick = async () => {
    if (!session) {
      sbtn.textContent = '■ Xong';
      sst.textContent = 'Đang nghe…';
      session = listen({ onText: t => { sst.textContent = t; }, onError: e => { sst.textContent = sttError(e); } });
      return;
    }
    const s = session; session = null;
    sbtn.textContent = '🎙 Thử lại';
    const { text, error } = await s.stop();
    if (!text) { sst.textContent = sttError(error || 'no-speech'); report({ stt: 'Không: ' + (error || 'no-speech') }); return; }
    const c = compare(SENT, text);
    sst.innerHTML = `Máy nghe được: <i>${esc(text)}</i><br><b>${Math.round(c.score * 100)}%</b> số từ khớp. ${c.score >= 0.8 ? 'Nhận giọng nói chạy tốt.' : 'Thử đọc chậm và rõ hơn.'}`;
    report({ stt: `Có (${Math.round(c.score * 100)}%)` });
  };

  // ---- Thử ghi âm, đồng thời nhận chữ ----
  const st = view.querySelector('[data-st]');
  if (!sup.getUserMedia || !sup.mediaRecorder) {
    st.textContent = 'Trình duyệt này không hỗ trợ ghi âm.';
    report({ ok: false, mime: '', error: 'unsupported' });
    return () => session?.stop();
  }
  const stopWidget = recorderWidget(view.querySelector('[data-rec]'), {
    maxSec: 15,
    transcribe: true,
    onLive: t => { st.textContent = t; },
    onDone: async (blob, mime, info) => {
      if (blob.size < 500) { st.textContent = 'Bản ghi rỗng, micro có thể bị chặn.'; report({ ok: false, mime, error: 'empty' }); return; }
      const both = info.text ? ` Máy nghe được cùng lúc: "${info.text}".` : stt ? ` Khi đang ghi âm, máy không nhận ra chữ (${info.error || 'không có chữ'}).` : '';
      st.textContent = `Ghi được ${Math.round(blob.size / 1024)} KB. Nghe lại thấy rõ là micro chạy tốt.${both}`;
      report({ ok: true, mime, error: '', stt: stt ? (info.text ? 'Có, cả khi ghi âm' : `Khi ghi âm: không (${info.error || 'rỗng'})`) : 'Không hỗ trợ' });
      if (store.apiOn()) {
        try {
          await store.api({ action: 'audio', data: await blobToBase64(blob), mime, question: 'Thử micro', label: 'thu-micro', source: 'Thử micro', transcript: info.text || '', seconds: info.sec || 0 });
          st.textContent += ' Đã gửi thử lên Google Drive.';
        } catch (e) { st.textContent += ' Gửi lên Drive không được: ' + e.message; }
      }
    },
  });
  const obs = new MutationObserver(() => {
    const t = view.querySelector('[data-rec] [data-st]')?.textContent || '';
    if (t.startsWith('Không mở được micro')) report({ ok: false, mime: sup.mime, error: t });
  });
  obs.observe(view.querySelector('[data-rec]'), { subtree: true, childList: true, characterData: true });
  return () => { obs.disconnect(); stopWidget(); session?.stop(); };
}
