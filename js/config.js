// Cấu hình app. Sau khi triển khai Apps Script, dán URL web app (đuôi /exec) vào apiUrl.
// Mỗi người học có hồ sơ riêng; dữ liệu lưu riêng trên máy và trên máy chủ.
export const USERS = {
  thao: { learner: 'Thảo', xung: 'em', examDate: '2027-07-15', target: '5.5', ielts: true,
    tabs: ['home', 'vocab', 'grammar', 'speak', 'settings'] },
  // Phúc: mục tiêu B1 giao tiếp, nghe được hội thảo, không luyện thi IELTS
  phuc: { learner: 'Phúc', xung: 'anh', examDate: '', target: '', ielts: false, goal: 'B1 giao tiếp',
    tabs: ['home', 'vocab', 'listen', 'speak', 'settings'],
    focusTopics: ['Hội thảo y khoa', 'Sức khỏe', 'Khoa học và Dược'],
    laterTopics: ['Xu hướng (Task 1)', 'Từ dùng cho Writing', 'Từ học thuật'] },
};

// Chọn người học: link có ?u=phuc thì nhớ luôn trên máy này; không có thì dùng lần chọn trước, mặc định Thảo
function pickUser() {
  let u = null;
  try {
    u = new URLSearchParams(location.search).get('u');
    if (u && USERS[u]) localStorage.setItem('ielts.user', u);
    else u = localStorage.getItem('ielts.user');
  } catch { /* trình duyệt chặn bộ nhớ */ }
  return USERS[u] ? u : 'thao';
}
export const USER = pickUser();

export const CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbxsCNkhl7c4ikcSUBvQzyM_ASKUMTT5LvLmfakHTcs0iBybMawdxS3e7t7Vd9qr7UomKg/exec',
  token: 'ielts-thao-k7q2m9x4', // phải trùng TOKEN trong apps-script/Code.gs
  user: USER,
  ...USERS[USER],               // learner, examDate (để trống nếu chưa có), target
  weeklyGoal: 4,                // số buổi mỗi tuần
  sessionMinutes: 10,           // học từ 10 phút trong ngày thì tính là một buổi
  newWordsPerDay: 15,
};

// Khóa lưu trên máy: Thảo giữ khóa cũ để không mất dữ liệu đã học
export const storeKey = base => (USER === 'thao' ? base : `${base}.${USER}`);

export function switchUser(u) {
  try { localStorage.setItem('ielts.user', u); } catch { /* bỏ qua */ }
  location.replace(location.pathname + '#/');
  location.reload();
}
