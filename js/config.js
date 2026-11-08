// Cấu hình app. Sau khi triển khai Apps Script, dán URL web app (đuôi /exec) vào apiUrl.
export const CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbxsCNkhl7c4ikcSUBvQzyM_ASKUMTT5LvLmfakHTcs0iBybMawdxS3e7t7Vd9qr7UomKg/exec',
  token: 'ielts-thao-k7q2m9x4', // phải trùng TOKEN trong apps-script/Code.gs
  learner: 'Thảo',
  examDate: '2027-07-15',       // dự kiến, chưa đăng ký
  weeklyGoal: 4,                // số buổi mỗi tuần
  sessionMinutes: 10,           // học từ 10 phút trong ngày thì tính là một buổi
  newWordsPerDay: 30,
};
