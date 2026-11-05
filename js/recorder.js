// Ghi âm bằng micro. iPhone (Safari) ghi ra audio/mp4, Chrome ra audio/webm.
export function pickMime() {
  if (!window.MediaRecorder) return '';
  for (const m of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

export function micSupport() {
  return {
    secure: window.isSecureContext,
    getUserMedia: !!navigator.mediaDevices?.getUserMedia,
    mediaRecorder: !!window.MediaRecorder,
    mime: pickMime(),
  };
}

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  return {
    mime: rec.mimeType || mime || 'audio/mp4',
    stop: () => new Promise(resolve => {
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        resolve(new Blob(chunks, { type: rec.mimeType || mime || 'audio/mp4' }));
      };
      rec.stop();
    }),
  };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Khối giao diện ghi âm dùng chung: nút ghi/dừng, nghe lại, gọi onDone(blob, mime)
export function recorderWidget(el, { maxSec = 60, onDone } = {}) {
  let rec = null, timer = null, t0 = 0, url = null;
  el.innerHTML = `<div class="row"><button class="btn" data-rec>● Ghi âm</button><span class="rec muted small" data-st></span></div><div data-play></div>`;
  const btn = el.querySelector('[data-rec]'), st = el.querySelector('[data-st]'), play = el.querySelector('[data-play]');
  async function stopRec() {
    clearInterval(timer);
    const r = rec; rec = null;
    const blob = await r.stop();
    btn.textContent = '● Ghi lại';
    st.textContent = '';
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    play.innerHTML = `<audio controls src="${url}"></audio>`;
    onDone?.(blob, r.mime);
  }
  btn.onclick = async () => {
    if (rec) return stopRec();
    try {
      rec = await startRecording();
    } catch (e) {
      st.textContent = 'Không mở được micro: ' + (e.name || e.message);
      return;
    }
    t0 = Date.now();
    btn.textContent = '■ Dừng';
    st.innerHTML = '<span class="dot"></span><span>0:00</span>';
    timer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      st.lastChild.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (s >= maxSec) stopRec();
    }, 250);
  };
  return () => { clearInterval(timer); if (rec) rec.stop(); };
}
