'use strict';
// Gửi email nhắc (khoản định kỳ đến hạn, 3 ngày chưa ghi) và thông báo đẩy hằng ngày rồi thoát.
// Dùng cho cron ngoài khi không bật REMINDERS_ENABLED trong tiến trình web, ví dụ khi dịch vụ web
// ngủ lúc không có truy cập. Chạy lại không gửi trùng. Muốn nhắc hằng ngày đúng giờ người dùng chọn,
// hãy cho cron chạy mỗi giờ; email chỉ nên gửi từ 08:00 giờ Việt Nam nên truyền --push-only cho các
// lần chạy khác giờ đó.
// Cách chạy: node backEnd/server/scripts/send-reminders.js [--push-only]
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { sendReminderEmails, sendDailyPushReminders } = require('../utils/reminders');

(async () => {
    const uri = process.env.MONGODB_URI;
    if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    try {
        const pushOnly = process.argv.includes('--push-only');
        const emails = pushOnly ? { skipped: 'push_only' } : await sendReminderEmails();
        const pushes = await sendDailyPushReminders();
        console.log('[reminders] ' + JSON.stringify({ emails, pushes }));
        if (emails.failed) process.exitCode = 1;
    } finally { await mongoose.disconnect(); }
})().catch(() => { console.error('[reminders] failed'); process.exitCode = 1; });
