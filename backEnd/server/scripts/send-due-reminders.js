'use strict';
// Gửi email nhắc khoản định kỳ sắp đến hạn rồi thoát. Dùng cho cron ngoài (ví dụ mỗi sáng 08:00
// giờ Việt Nam) khi không bật DUE_REMINDER_EMAILS trong tiến trình web. Chạy lại không gửi trùng.
// Cách chạy: node backEnd/server/scripts/send-due-reminders.js
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env')});
const mongoose = require('mongoose');
const { sendDueReminders } = require('../utils/dueReminders');

(async () => {
    const uri = process.env.MONGODB_URI;
    if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    try {
        const result = await sendDueReminders();
        console.log('[reminders] ' + JSON.stringify(result));
        if (result.failed) process.exitCode = 1;
    } finally { await mongoose.disconnect(); }
})().catch(() => { console.error('[reminders] failed'); process.exitCode = 1; });
