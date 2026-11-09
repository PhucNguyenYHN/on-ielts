import * as store from '../store.js';
import { CONFIG, USERS, switchUser } from '../config.js';
import { forgetPin } from '../lock.js';
import { esc, bi } from '../util.js';

export default function settings(view) {
  const s = store.get();
  view.innerHTML = `<h1>${bi('Cài đặt', 'Settings')}</h1>
    <div class="card">
      <h3>Người học</h3>
      <p class="meta">Đang học với hồ sơ <b>${esc(CONFIG.learner)}</b>. Mỗi hồ sơ có tiến độ, từ vựng và bài viết riêng.</p>
      <div class="row">${Object.entries(USERS).map(([id, u]) => `<button class="btn ${id === CONFIG.user ? '' : 'ghost'}" data-user="${id}" ${id === CONFIG.user ? 'disabled' : ''}>${esc(u.learner)}</button>`).join('')}</div>
      ${CONFIG.pin ? '<p class="muted small" style="margin-top:8px">🔒 Tài khoản này có mã PIN. Dùng chung máy với người khác thì bấm Khóa trước khi đưa máy.</p><button class="btn ghost" data-lock>🔒 Khóa trên máy này</button>' : ''}
    </div>
    <div class="card">
      <label for="accent"><b>Giọng phát âm mẫu</b></label>
      <select id="accent">
        <option value="en-GB">Anh–Anh</option>
        <option value="en-US">Anh–Mỹ</option>
      </select>
      <p class="muted small">Dùng khi tự đọc từ và câu ví dụ. Thẻ từ vựng luôn có nút nghe cả hai giọng.</p>
    </div>
    <div class="card">
      <h3>Đồng bộ</h3>
      <p class="meta">${store.apiOn() ? 'Đã nối Google Sheets. Tiến độ dùng chung giữa iPhone và máy tính.' : 'Chưa nối máy chủ: tiến độ chỉ lưu trên máy này.'}</p>
      <p class="meta">Lượt làm bài chờ gửi: <b data-pending>${store.pendingCount()}</b></p>
      <div class="row">
        <button class="btn" data-sync ${store.apiOn() ? '' : 'disabled'}>Đồng bộ ngay</button>
        <button class="btn ghost" data-pull ${store.apiOn() ? '' : 'disabled'}>Lấy dữ liệu từ máy chủ</button>
      </div>
      <p class="small muted" data-msg></p>
    </div>
    <div class="card">
      <h3>Khác</h3>
      <p class="meta">Người học: ${esc(CONFIG.learner)}${CONFIG.examDate ? ` · Kỳ thi dự kiến: ${esc(new Date(CONFIG.examDate + 'T00:00:00').toLocaleDateString('vi-VN'))}` : ''}</p>
      <div class="row">
        <a class="btn ghost" href="#/mic">Thử micro</a>
        <button class="btn ghost" data-export>Tải bản sao lưu</button>
        <button class="btn danger" data-reset>Xóa dữ liệu trên máy này</button>
      </div>
    </div>`;
  view.querySelectorAll('[data-user]').forEach(b => { b.onclick = () => { if (confirm(`Chuyển sang hồ sơ ${USERS[b.dataset.user].learner}?`)) switchUser(b.dataset.user); }; });
  view.querySelector('[data-lock]')?.addEventListener('click', () => { forgetPin(); switchUser('thao'); });
  const msg = view.querySelector('[data-msg]');
  const sel = view.querySelector('#accent');
  sel.value = s.prefs.accent;
  sel.onchange = () => store.update(st => { st.prefs.accent = sel.value; });

  view.querySelector('[data-sync]').onclick = async () => {
    msg.textContent = 'Đang đồng bộ…';
    await store.flush();
    await store.pushState();
    view.querySelector('[data-pending]').textContent = store.pendingCount();
    msg.textContent = store.pendingCount() ? 'Còn lượt chưa gửi được, kiểm tra mạng.' : 'Đã đồng bộ xong.';
  };
  view.querySelector('[data-pull]').onclick = async () => {
    if (!confirm('Thay dữ liệu trên máy này bằng bản trên máy chủ?')) return;
    msg.textContent = 'Đang tải…';
    const changed = await store.pullState(true);
    msg.textContent = changed ? 'Đã lấy dữ liệu từ máy chủ.' : 'Máy chủ chưa có dữ liệu hoặc không kết nối được.';
  };
  view.querySelector('[data-export]').onclick = () => {
    const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ielts-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  view.querySelector('[data-reset]').onclick = () => {
    if (!confirm('Xóa toàn bộ tiến độ trên máy này? Bản trên máy chủ (nếu có) vẫn giữ.')) return;
    store.resetLocal();
    location.hash = '#/';
    location.reload();
  };
}
