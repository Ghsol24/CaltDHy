'use strict';

const crypto = require('node:crypto');
const User = require('../models/User');
const Installment = require('../models/Installment');
const Transaction = require('../models/Transaction');
const PushSubscription = require('../models/PushSubscription');
const { configuredProvider, sendAccountEmail } = require('./accountEmail');
const { sendPush, vapidConfig } = require('./webPush');
const { getVietnamTodayString, isValidDateString } = require('./localDate');

// Khoản định kỳ: nhắc một lần cho mỗi kỳ, từ 3 ngày trước hạn đến tối đa 7 ngày sau hạn.
const REMIND_BEFORE_DAYS = 3;
const OVERDUE_GRACE_DAYS = 7;
// Vắng mặt: một email khi đã 3 ngày chưa GHI giao dịch nào (tính theo lúc ghi, không theo ngày
// giao dịch), rồi im cho tới khi người dùng ghi lại.
const INACTIVE_DAYS = 3;
const PAUSE_DAYS = 30;
const DAY_MS = 86400000;

const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const formatVnd = amount => new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

function shiftDate(dateString, days) {
    const date = new Date(dateString + 'T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
const daysBetween = (from, to) => Math.round(
    (Date.parse(to + 'T00:00:00.000Z') - Date.parse(from + 'T00:00:00.000Z')) / DAY_MS);

const copy = {
    vi: {
        dueSubject: count => `CaltDHy: ${count} khoản định kỳ cần chú ý`,
        inactiveSubject: days => `CaltDHy: bạn chưa ghi chép ${days} ngày`,
        hello: name => `Xin chào ${name},`,
        dueIntro: 'Các khoản định kỳ sau sắp đến hạn hoặc đã đến hạn:',
        expense: 'Cần trả', income: 'Sẽ nhận',
        when: days => days === 0 ? 'hôm nay' : days > 0 ? `còn ${days} ngày` : `quá hạn ${-days} ngày`,
        dueAction: 'Mở CaltDHy để xác nhận từng khoản. Ứng dụng không tự trừ tiền.',
        inactive: days => `Bạn chưa ghi giao dịch nào trong ${days} ngày. Ghi lại vài khoản gần đây để số liệu tháng này vẫn đúng.`,
        open: 'Mở CaltDHy',
        footer: 'Bạn nhận email này vì đã bật nhắc trong Cài đặt > Thông báo.',
        manage: 'Tạm dừng 30 ngày hoặc tắt email nhắc'
    },
    en: {
        dueSubject: count => `CaltDHy: ${count} recurring item${count === 1 ? '' : 's'} need attention`,
        inactiveSubject: days => `CaltDHy: nothing recorded for ${days} days`,
        hello: name => `Hello ${name},`,
        dueIntro: 'These recurring items are due soon or already due:',
        expense: 'To pay', income: 'To receive',
        when: days => days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} overdue`,
        dueAction: 'Open CaltDHy to confirm each item. The app never moves money on its own.',
        inactive: days => `You have not recorded a transaction for ${days} days. Add your recent spending so this month stays accurate.`,
        open: 'Open CaltDHy',
        footer: 'You receive this email because reminders are on in Settings > Notifications.',
        manage: 'Pause for 30 days or turn reminder emails off'
    },
    'zh-CN': {
        dueSubject: count => `CaltDHy：${count} 个周期项目需要关注`,
        inactiveSubject: days => `CaltDHy：您已 ${days} 天没有记账`,
        hello: name => `${name}，您好：`,
        dueIntro: '以下周期项目即将到期或已到期：',
        expense: '待支付', income: '待收款',
        when: days => days === 0 ? '今天' : days > 0 ? `还有 ${days} 天` : `已逾期 ${-days} 天`,
        dueAction: '请打开 CaltDHy 逐项确认。应用不会自动扣款。',
        inactive: days => `您已 ${days} 天没有记录任何交易。补记最近的收支，让本月数据保持准确。`,
        open: '打开 CaltDHy',
        footer: '您已在“设置 > 通知”中开启提醒，因此收到此邮件。',
        manage: '暂停 30 天或关闭提醒邮件'
    }
};

function appBase() {
    try {
        const url = new URL(process.env.CLIENT_URL);
        if (url.protocol !== 'https:' || url.username || url.password) return null;
        url.search = ''; url.hash = '';
        url.pathname = url.pathname.replace(/\/+$/, '') + '/';
        return url;
    } catch { return null; }
}

// Mã trong link "tạm dừng / tắt": định danh người dùng + chữ ký HMAC, không cần đăng nhập.
// Mã chỉ mở được hai thao tác giảm email, nên không đặt hạn dùng.
function reminderToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) return null;
    const id = String(userId);
    return id + '.' + crypto.createHmac('sha256', secret).update('email-reminders:' + id).digest('hex');
}
function userIdFromReminderToken(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{24}\.[a-f0-9]{64}$/.test(token)) return null;
    const id = token.slice(0, 24), expected = reminderToken(id);
    return expected && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected)) ? id : null;
}
function manageLink(userId) {
    const base = appBase(), token = reminderToken(userId);
    if (!base || !token) return null;
    const link = new URL('email-preferences', base);
    link.searchParams.set('token', token);
    return link.toString();
}

/** Áp dụng lựa chọn từ trang quản lý email. Trả về false nếu mã không hợp lệ. */
async function applyReminderChoice(token, action, now = new Date()) {
    const userId = userIdFromReminderToken(token);
    if (!userId || !['pause', 'off'].includes(action)) return false;
    const update = action === 'pause'
        ? { 'preferences.notifications.emailPausedUntil': new Date(now.getTime() + PAUSE_DAYS * DAY_MS) }
        : { 'preferences.notifications.dueEmail': false, 'preferences.notifications.inactivityEmail': false,
            'preferences.notifications.emailPausedUntil': null };
    return (await User.updateOne({ _id: userId }, { $set: update })).matchedCount === 1;
}

function buildReminderEmail(user, { items = [], inactiveDays = 0 }, today) {
    const text = copy[user.preferences?.notifications?.locale] || copy.vi;
    const rows = [...items].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)).map(item => ({
        label: item.type === 'income' ? text.income : text.expense,
        name: item.name, amount: formatVnd(item.amount), date: item.nextDueDate,
        when: text.when(daysBetween(today, item.nextDueDate))
    }));
    const base = appBase(), link = base ? base.toString() : null, manage = manageLink(user._id);
    const plain = [text.hello(user.name), ''];
    let html = '<p>' + escapeHtml(text.hello(user.name)) + '</p>';
    if (inactiveDays) {
        plain.push(text.inactive(inactiveDays), '');
        html += '<p>' + escapeHtml(text.inactive(inactiveDays)) + '</p>';
    }
    if (rows.length) {
        plain.push(text.dueIntro, ...rows.map(row => `- ${row.label}: ${row.name} · ${row.amount} · ${row.date} (${row.when})`), '', text.dueAction, '');
        html += '<p>' + escapeHtml(text.dueIntro) + '</p><ul>' + rows.map(row => '<li><strong>' + escapeHtml(row.label) +
            ':</strong> ' + escapeHtml(row.name) + ' · ' + escapeHtml(row.amount) + ' · ' + escapeHtml(row.date) +
            ' (' + escapeHtml(row.when) + ')</li>').join('') + '</ul><p>' + escapeHtml(text.dueAction) + '</p>';
    }
    if (link) {
        plain.push(text.open + ': ' + link, '');
        html += '<p><a href="' + escapeHtml(link) + '">' + escapeHtml(text.open) + '</a></p>';
    }
    plain.push(text.footer);
    html += '<p style="color:#667085;font-size:12px">' + escapeHtml(text.footer);
    if (manage) {
        plain.push(text.manage + ': ' + manage);
        html += ' <a href="' + escapeHtml(manage) + '">' + escapeHtml(text.manage) + '</a>.';
    }
    html += '</p>';
    return { to: user.email, text: plain.join('\n'), html,
        subject: rows.length ? text.dueSubject(rows.length) : text.inactiveSubject(inactiveDays) };
}

/**
 * Gửi email nhắc: khoản định kỳ đến hạn và/hoặc "3 ngày chưa ghi", gộp thành MỘT email mỗi người.
 * Chạy lại bao nhiêu lần cũng an toàn: mỗi lý do được "nhận" bằng một cập nhật nguyên tử trước khi
 * gửi, nên hai tiến trình chạy đồng thời không gửi trùng; gửi lỗi thì trả lại để lần sau thử lại.
 * Hàm này không bao giờ đụng tới tiền.
 */
async function sendReminderEmails({ today = getVietnamTodayString(), now = new Date(), send = sendAccountEmail } = {}) {
    if (!isValidDateString(today)) throw new Error('Invalid reminder date.');
    if (send === sendAccountEmail && !configuredProvider()) return { skipped: 'email_unavailable', sent: 0, failed: 0 };
    const from = shiftDate(today, -OVERDUE_GRACE_DAYS), to = shiftDate(today, REMIND_BEFORE_DAYS);
    const users = await User.find({ emailVerified: true, $or: [
        { 'preferences.notifications.dueEmail': true }, { 'preferences.notifications.inactivityEmail': true }] })
        .select('name email preferences.notifications +lastInactivityEmailAt').lean();
    let sent = 0, failed = 0;
    for (const user of users) {
        const settings = user.preferences?.notifications || {};
        if (settings.emailPausedUntil && new Date(settings.emailPausedUntil) > now) continue;

        const claimed = [];
        if (settings.dueEmail) {
            const candidates = await Installment.find({
                userId: user._id, active: true, nextDueDate: { $gte: from, $lte: to }
            }).select('name type amount nextDueDate endDate lastReminderPeriod').lean();
            for (const item of candidates) {
                if (item.endDate && item.nextDueDate > item.endDate) continue;
                const claim = await Installment.updateOne(
                    { _id: item._id, active: true, nextDueDate: item.nextDueDate, lastReminderPeriod: { $ne: item.nextDueDate } },
                    { $set: { lastReminderPeriod: item.nextDueDate } }, { timestamps: false });
                if (claim.modifiedCount === 1) claimed.push(item);
            }
        }

        let inactiveDays = 0;
        const previousInactivityEmail = user.lastInactivityEmailAt || null;
        if (settings.inactivityEmail) {
            // Tài khoản chưa từng ghi giao dịch nào được bỏ qua: đó là "chưa bắt đầu", không phải "vắng mặt".
            const latest = await Transaction.findOne({ userId: user._id }).sort({ createdAt: -1 }).select('createdAt').lean();
            const idleMs = latest?.createdAt ? now - latest.createdAt : 0;
            if (idleMs >= INACTIVE_DAYS * DAY_MS && (!previousInactivityEmail || previousInactivityEmail < latest.createdAt)) {
                const claim = await User.updateOne({ _id: user._id, lastInactivityEmailAt: previousInactivityEmail },
                    { $set: { lastInactivityEmailAt: now } });
                if (claim.modifiedCount === 1) inactiveDays = Math.floor(idleMs / DAY_MS);
            }
        }

        if (!claimed.length && !inactiveDays) continue;
        try {
            await send(buildReminderEmail(user, { items: claimed, inactiveDays }, today));
            sent += 1;
        } catch {
            failed += 1;
            for (const item of claimed) {
                await Installment.updateOne({ _id: item._id, lastReminderPeriod: item.nextDueDate },
                    { $set: { lastReminderPeriod: null } }, { timestamps: false });
            }
            if (inactiveDays) {
                await User.updateOne({ _id: user._id, lastInactivityEmailAt: now }, { $set: { lastInactivityEmailAt: previousInactivityEmail } });
            }
        }
    }
    return { sent, failed };
}

/**
 * Thông báo đẩy "hôm nay bạn chưa ghi gì": gửi tối đa một lần mỗi ngày cho mỗi người, từ giờ họ chọn
 * (giờ Việt Nam) trở đi, và chỉ khi hôm đó chưa ghi giao dịch nào.
 */
async function sendDailyPushReminders({ now = new Date(), push = sendPush } = {}) {
    if (push === sendPush && !vapidConfig()) return { skipped: 'push_unavailable', sent: 0 };
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const hour = (now.getUTCHours() + 7) % 24;
    const startOfDay = new Date(today + 'T00:00:00.000+07:00');
    const users = await User.find({ 'preferences.notifications.dailyReminder.enabled': true,
        'preferences.notifications.dailyReminder.hour': { $lte: hour }, lastDailyPushDate: { $ne: today } }).select('_id').lean();
    let sent = 0;
    for (const user of users) {
        const claim = await User.updateOne({ _id: user._id, lastDailyPushDate: { $ne: today } }, { $set: { lastDailyPushDate: today } });
        if (claim.modifiedCount !== 1) continue;
        if (await Transaction.exists({ userId: user._id, createdAt: { $gte: startOfDay } })) continue;
        for (const device of await PushSubscription.find({ userId: user._id }).select('endpoint').lean()) {
            const outcome = await push(device.endpoint);
            if (outcome === 'sent') sent += 1;
            else if (outcome === 'gone') await PushSubscription.deleteOne({ _id: device._id });
        }
    }
    return { sent };
}

module.exports = { sendReminderEmails, sendDailyPushReminders, buildReminderEmail, applyReminderChoice, reminderToken };
