'use strict';

const User = require('../models/User');
const Installment = require('../models/Installment');
const { configuredProvider, sendAccountEmail } = require('./accountEmail');
const { getVietnamTodayString, isValidDateString } = require('./localDate');

// Nhắc một lần cho mỗi kỳ: từ 3 ngày trước hạn đến tối đa 7 ngày sau hạn.
const REMIND_BEFORE_DAYS = 3;
const OVERDUE_GRACE_DAYS = 7;

const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const formatVnd = amount => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

function shiftDate(dateString, days) {
    const date = new Date(dateString + 'T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
const daysBetween = (from, to) => Math.round(
    (Date.parse(to + 'T00:00:00.000Z') - Date.parse(from + 'T00:00:00.000Z')) / 86400000);

const copy = {
    vi: {
        subject: count => `CaltDHy: ${count} khoản định kỳ cần chú ý`,
        hello: name => `Xin chào ${name},`,
        intro: 'Các khoản định kỳ sau sắp đến hạn hoặc đã đến hạn:',
        expense: 'Cần trả', income: 'Sẽ nhận',
        when: days => days === 0 ? 'hôm nay' : days > 0 ? `còn ${days} ngày` : `quá hạn ${-days} ngày`,
        action: 'Mở CaltDHy để xác nhận từng khoản. Ứng dụng không tự trừ tiền.',
        footer: 'Bạn nhận email này vì đã bật nhắc hạn trong Cài đặt. Tắt tại Cài đặt > Chung.'
    },
    en: {
        subject: count => `CaltDHy: ${count} recurring item${count === 1 ? '' : 's'} need attention`,
        hello: name => `Hello ${name},`,
        intro: 'These recurring items are due soon or already due:',
        expense: 'To pay', income: 'To receive',
        when: days => days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} overdue`,
        action: 'Open CaltDHy to confirm each item. The app never moves money on its own.',
        footer: 'You receive this email because due reminders are on. Turn them off in Settings > General.'
    },
    'zh-CN': {
        subject: count => `CaltDHy：${count} 个周期项目需要关注`,
        hello: name => `${name}，您好：`,
        intro: '以下周期项目即将到期或已到期：',
        expense: '待支付', income: '待收款',
        when: days => days === 0 ? '今天' : days > 0 ? `还有 ${days} 天` : `已逾期 ${-days} 天`,
        action: '请打开 CaltDHy 逐项确认。应用不会自动扣款。',
        footer: '您已在设置中开启到期提醒，因此收到此邮件。可在“设置 > 常规”中关闭。'
    }
};

function appLink() {
    try {
        const url = new URL(process.env.CLIENT_URL);
        return url.protocol === 'https:' && !url.username && !url.password ? url.origin + url.pathname : null;
    } catch { return null; }
}

function buildReminderEmail(user, items, today) {
    const text = copy[user.preferences?.dueReminders?.locale] || copy.vi;
    const rows = [...items].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)).map(item => ({
        label: item.type === 'income' ? text.income : text.expense,
        name: item.name, amount: formatVnd(item.amount), date: item.nextDueDate,
        when: text.when(daysBetween(today, item.nextDueDate))
    }));
    const link = appLink();
    const lines = rows.map(row => `- ${row.label}: ${row.name} · ${row.amount} · ${row.date} (${row.when})`);
    return {
        to: user.email,
        subject: text.subject(rows.length),
        text: [text.hello(user.name), '', text.intro, ...lines, '', text.action, ...(link ? [link] : []), '', text.footer].join('\n'),
        html: '<p>' + escapeHtml(text.hello(user.name)) + '</p><p>' + escapeHtml(text.intro) + '</p><ul>' +
            rows.map(row => '<li><strong>' + escapeHtml(row.label) + ':</strong> ' + escapeHtml(row.name) + ' · ' +
                escapeHtml(row.amount) + ' · ' + escapeHtml(row.date) + ' (' + escapeHtml(row.when) + ')</li>').join('') +
            '</ul><p>' + escapeHtml(text.action) + (link ? ' <a href="' + escapeHtml(link) + '">CaltDHy</a>' : '') +
            '</p><p style="color:#667085;font-size:12px">' + escapeHtml(text.footer) + '</p>'
    };
}

/**
 * Gửi email nhắc hạn. Chạy lại bao nhiêu lần cũng an toàn: mỗi kỳ được "nhận" bằng một
 * cập nhật nguyên tử trên lastReminderPeriod trước khi gửi, nên hai tiến trình chạy đồng
 * thời không gửi trùng. Gửi lỗi thì trả lại kỳ để lần chạy sau thử lại.
 * Hàm này chỉ đọc khoản định kỳ và ghi lastReminderPeriod; không bao giờ đụng tới tiền.
 */
async function sendDueReminders({ today = getVietnamTodayString(), send = sendAccountEmail } = {}) {
    if (!isValidDateString(today)) throw new Error('Invalid reminder date.');
    if (send === sendAccountEmail && !configuredProvider()) return { skipped: 'email_unavailable', sent: 0, failed: 0 };
    const from = shiftDate(today, -OVERDUE_GRACE_DAYS), to = shiftDate(today, REMIND_BEFORE_DAYS);
    const users = await User.find({ emailVerified: true, 'preferences.dueReminders.email': true })
        .select('name email preferences.dueReminders').lean();
    let sent = 0, failed = 0;
    for (const user of users) {
        const candidates = await Installment.find({
            userId: user._id, active: true, nextDueDate: { $gte: from, $lte: to }
        }).select('name type amount nextDueDate endDate lastReminderPeriod').lean();
        const claimed = [];
        for (const item of candidates) {
            if (item.endDate && item.nextDueDate > item.endDate) continue;
            const claim = await Installment.updateOne(
                { _id: item._id, active: true, nextDueDate: item.nextDueDate, lastReminderPeriod: { $ne: item.nextDueDate } },
                { $set: { lastReminderPeriod: item.nextDueDate } }, { timestamps: false });
            if (claim.modifiedCount === 1) claimed.push(item);
        }
        if (!claimed.length) continue;
        try {
            await send(buildReminderEmail(user, claimed, today));
            sent += 1;
        } catch {
            failed += 1;
            for (const item of claimed) {
                await Installment.updateOne({ _id: item._id, lastReminderPeriod: item.nextDueDate },
                    { $set: { lastReminderPeriod: null } }, { timestamps: false });
            }
        }
    }
    return { sent, failed };
}

module.exports = { sendDueReminders, buildReminderEmail };
