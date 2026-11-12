'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.CLIENT_URL = 'https://finance.example.test';
const User = require('../models/User');
const Installment = require('../models/Installment');
const Transaction = require('../models/Transaction');
const PushSubscription = require('../models/PushSubscription');
const { sendReminderEmails, sendDailyPushReminders, applyReminderChoice, reminderToken } = require('../utils/reminders');
const { validPushEndpoint, vapidConfig, vapidAuthorization } = require('../utils/webPush');
const { validPreferencesUpdate, preferenceUpdateFields } = require('../utils/cashFlowPreferences');
const { publicPreferences } = require('../utils/publicUser');

const today = '2026-09-21';
const now = new Date('2026-09-21T03:00:00.000Z'); // 10:00 giờ Việt Nam
let counter = 0;
const user = (notifications = { dueEmail: true }, extra = {}) => User.create({
    name: 'Reminder', email: `reminder${++counter}@example.test`, password: 'x'.repeat(60), emailVerified: true,
    preferences: { notifications }, ...extra
});
const item = (userId, nextDueDate, extra = {}) => Installment.create({
    userId, name: 'Bill ' + nextDueDate, amount: 150000, category: 'Bills', cycle: 'monthly', nextDueDate, ...extra
});
// createdAt là lúc GHI; date là ngày của giao dịch (có thể ghi bù cho ngày cũ).
const recorded = (userId, createdAt, date = createdAt) => Transaction.collection.insertOne({
    userId, type: 'expense', amount: 1000, category: 'Food', desc: '', fee: 0, date: new Date(date), createdAt: new Date(createdAt), updatedAt: new Date(createdAt)
});
const collect = () => { const mails = []; return { mails, send: async mail => { mails.push(mail); } }; };

describe('Reminder emails and daily push', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_reminder_test'));
        await PushSubscription.createIndexes();
    });
    after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

    it('sends one email per user for periods inside the window and never repeats a period', async () => {
        const owner = await user();
        await item(owner._id, '2026-09-24');                                   // 3 ngày nữa
        await item(owner._id, today, { type: 'income', name: 'Lương' });       // hôm nay, khoản thu
        await item(owner._id, '2026-09-15');                                   // quá hạn 6 ngày
        await item(owner._id, '2026-09-25');                                   // còn 4 ngày: chưa nhắc
        await item(owner._id, '2026-09-13');                                   // quá hạn 8 ngày: thôi nhắc
        await item(owner._id, today, { active: false });                       // đang tạm dừng
        await item(owner._id, today, { endDate: '2026-09-20' });               // đã hết kỳ hạn
        const { mails, send } = collect();
        assert.deepEqual(await sendReminderEmails({ today, now, send }), { sent: 1, failed: 0 });
        assert.equal(mails.length, 1);
        assert.equal(mails[0].to, owner.email);
        assert.match(mails[0].subject, /3 khoản/);
        assert.match(mails[0].text, /Sẽ nhận: Lương · 150\.000 ₫ · 2026-09-21 \(hôm nay\)/);
        assert.match(mails[0].text, /Cần trả: Bill 2026-09-24 .*còn 3 ngày/);
        assert.match(mails[0].text, /quá hạn 6 ngày/);
        assert.doesNotMatch(mails[0].text, /2026-09-25|2026-09-13/);
        assert.match(mails[0].text, /https:\/\/finance\.example\.test\/email-preferences\?token=[a-f0-9]{24}\.[a-f0-9]{64}/);
        assert.deepEqual(await sendReminderEmails({ today, now, send }), { sent: 0, failed: 0 });
        assert.equal(mails.length, 1);
        assert.equal(await Transaction.countDocuments({ userId: owner._id }), 0);
    });

    it('skips users who did not opt in or have an unverified address, and escapes names in HTML', async () => {
        const off = await user({ dueEmail: false });
        const unverified = await user({ dueEmail: true }, { emailVerified: false });
        const english = await user({ dueEmail: true, locale: 'en' }, { name: '<b>Eve</b>' });
        for (const owner of [off, unverified, english]) await item(owner._id, today, { name: '<i>Rent</i>' });
        const { mails, send } = collect();
        await sendReminderEmails({ today, now, send });
        assert.deepEqual(mails.map(mail => mail.to), [english.email]);
        assert.match(mails[0].subject, /1 recurring item need/);
        assert.match(mails[0].text, /To pay: <i>Rent<\/i> .*\(today\)/);
        assert.doesNotMatch(mails[0].html, /<b>|<i>/);
    });

    it('a failed delivery releases the period so the next run retries it, and a new period is reminded again', async () => {
        const owner = await user();
        const bill = await item(owner._id, today);
        const failing = async () => { throw new Error('smtp down'); };
        assert.deepEqual(await sendReminderEmails({ today, now, send: failing }), { sent: 0, failed: 1 });
        assert.equal((await Installment.findById(bill._id)).lastReminderPeriod, null);
        const { mails, send } = collect();
        assert.deepEqual(await sendReminderEmails({ today, now, send }), { sent: 1, failed: 0 });
        await Installment.updateOne({ _id: bill._id }, { $set: { nextDueDate: '2026-10-21' } });
        assert.deepEqual(await sendReminderEmails({ today: '2026-10-19', now: new Date('2026-10-19T03:00:00Z'), send }), { sent: 1, failed: 0 });
        assert.equal(mails.length, 2);
    });

    it('emails once after 3 days without recording, measured by when the entry was made', async () => {
        const idle = await user({ inactivityEmail: true });
        await recorded(idle._id, '2026-09-17T03:00:00Z');                       // ghi lần cuối 4 ngày trước
        const backfilled = await user({ inactivityEmail: true });
        await recorded(backfilled._id, '2026-09-20T03:00:00Z', '2026-09-01');   // hôm qua ghi bù cho ngày cũ
        const fresh = await user({ inactivityEmail: true });                    // chưa từng ghi: bỏ qua
        const optedOut = await user({ inactivityEmail: false });
        await recorded(optedOut._id, '2026-09-01T03:00:00Z');
        // Chỉ xét thư gửi tới các tài khoản của test này (các test trước còn khoản định kỳ trong DB).
        const mine = new Set([idle, backfilled, fresh, optedOut].map(owner => owner.email));
        const mails = [];
        const send = async mail => { if (mine.has(mail.to)) mails.push(mail); };
        await sendReminderEmails({ today, now, send });
        assert.deepEqual(mails.map(mail => mail.to), [idle.email]);
        assert.match(mails[0].subject, /chưa ghi chép 4 ngày/);
        assert.match(mails[0].text, /chưa ghi giao dịch nào trong 4 ngày/);

        // Vẫn vắng: không nhắc lại. Ghi một giao dịch rồi vắng tiếp 3 ngày: nhắc một lần nữa.
        await sendReminderEmails({ today: '2026-09-25', now: new Date('2026-09-25T03:00:00Z'), send });
        assert.deepEqual(mails.map(mail => mail.to), [idle.email, backfilled.email]);
        await recorded(idle._id, '2026-09-26T03:00:00Z');
        await sendReminderEmails({ today: '2026-09-28', now: new Date('2026-09-28T03:00:00Z'), send });
        assert.equal(mails.length, 2);
        await sendReminderEmails({ today: '2026-09-30', now: new Date('2026-09-30T03:00:00Z'), send });
        assert.deepEqual(mails.map(mail => mail.to), [idle.email, backfilled.email, idle.email]);
    });

    it('merges a due item and inactivity into one email, and a failed send releases both', async () => {
        const owner = await user({ dueEmail: true, inactivityEmail: true });
        await item(owner._id, today, { name: 'Internet' });
        await recorded(owner._id, '2026-09-16T03:00:00Z');
        assert.deepEqual(await sendReminderEmails({ today, now, send: async () => { throw new Error('down'); } }), { sent: 0, failed: 1 });
        const { mails, send } = collect();
        assert.deepEqual(await sendReminderEmails({ today, now, send }), { sent: 1, failed: 0 });
        assert.equal(mails.length, 1);
        assert.match(mails[0].subject, /1 khoản định kỳ/);
        assert.match(mails[0].text, /chưa ghi giao dịch nào trong 5 ngày[\s\S]*Cần trả: Internet/);
    });

    it('the signed link pauses for 30 days or turns reminder emails off, and rejects forged tokens', async () => {
        const owner = await user({ dueEmail: true, inactivityEmail: true });
        await item(owner._id, today);
        const token = reminderToken(owner._id);
        const other = await user();
        assert.equal(await applyReminderChoice(token.slice(0, -1) + (token.endsWith('0') ? '1' : '0'), 'pause', now), false);
        assert.equal(await applyReminderChoice(other._id + '.' + token.split('.')[1], 'off', now), false);
        assert.equal(await applyReminderChoice(token, 'delete', now), false);
        assert.equal(await applyReminderChoice('nonsense', 'pause', now), false);

        assert.equal(await applyReminderChoice(token, 'pause', now), true);
        const { mails, send } = collect();
        await sendReminderEmails({ today, now, send });
        assert.equal(mails.length, 0);
        const paused = (await User.findById(owner._id)).preferences.notifications;
        assert.equal(paused.emailPausedUntil.toISOString(), '2026-10-21T03:00:00.000Z');
        assert.equal(paused.dueEmail, true);
        assert.equal(publicPreferences({ notifications: { emailPausedUntil: new Date(Date.now() + 1000) } }).notifications.emailPausedUntil !== null, true);
        assert.equal(publicPreferences({ notifications: { emailPausedUntil: new Date(Date.now() - 1000) } }).notifications.emailPausedUntil, null);
        // Hết 30 ngày thì nhắc lại bình thường.
        await sendReminderEmails({ today: '2026-10-22', now: new Date('2026-10-22T03:00:00Z'), send });
        assert.equal(mails.length, 0); // kỳ 21/09 đã quá hạn hơn 7 ngày
        await Installment.updateOne({ userId: owner._id }, { $set: { nextDueDate: '2026-10-22' } });
        await sendReminderEmails({ today: '2026-10-22', now: new Date('2026-10-22T03:00:00Z'), send });
        assert.equal(mails.length, 1);

        assert.equal(await applyReminderChoice(token, 'off', now), true);
        const off = (await User.findById(owner._id)).preferences.notifications;
        assert.deepEqual([off.dueEmail, off.inactivityEmail, off.emailPausedUntil], [false, false, null]);
    });

    it('daily push goes out once, from the chosen hour, only when nothing was recorded that day', async () => {
        const daily = hour => ({ dailyReminder: { enabled: true, hour } });
        const due = await user(daily(21)), early = await user(daily(22)), logged = await user(daily(21)), off = await user({});
        for (const owner of [due, early, logged, off]) {
            await PushSubscription.create({ userId: owner._id, endpoint: 'https://fcm.googleapis.com/fcm/send/' + owner._id });
        }
        await PushSubscription.create({ userId: due._id, endpoint: 'https://fcm.googleapis.com/fcm/send/gone-' + due._id });
        await recorded(logged._id, '2026-09-21T02:00:00Z');                     // 09:00 hôm nay giờ VN
        await recorded(due._id, '2026-09-20T16:59:00Z');                        // 23:59 hôm qua giờ VN
        const pushed = [];
        const push = async endpoint => { pushed.push(endpoint); return endpoint.includes('gone-') ? 'gone' : 'sent'; };
        const at = iso => ({ now: new Date(iso), push });
        assert.deepEqual(await sendDailyPushReminders(at('2026-09-21T13:50:00Z')), { sent: 0 });   // 20:50
        assert.deepEqual(await sendDailyPushReminders(at('2026-09-21T14:05:00Z')), { sent: 1 });   // 21:05
        assert.deepEqual(pushed.sort(), ['https://fcm.googleapis.com/fcm/send/' + due._id, 'https://fcm.googleapis.com/fcm/send/gone-' + due._id].sort());
        assert.equal(await PushSubscription.countDocuments({ userId: due._id }), 1);
        assert.deepEqual(await sendDailyPushReminders(at('2026-09-21T14:15:00Z')), { sent: 0 });   // không lặp lại
        assert.deepEqual(await sendDailyPushReminders(at('2026-09-21T15:05:00Z')), { sent: 1 });   // 22:05: người chọn 22h
        assert.deepEqual(await sendDailyPushReminders(at('2026-09-21T17:30:00Z')), { sent: 0 });   // 00:30 hôm sau: chưa tới giờ
        assert.equal(pushed.length, 3);
    });

    it('push endpoints are limited to browser push services and VAPID signs a verifiable token', () => {
        for (const good of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc',
            'https://web.push.apple.com/abc', 'https://wns2-par02p.notify.windows.com/w/?token=abc']) assert.equal(validPushEndpoint(good), true, good);
        for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.example/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.example/x',
            'https://127.0.0.1/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', '', null, 'x'.repeat(1200)]) {
            assert.equal(validPushEndpoint(bad), false, String(bad).slice(0, 40));
        }
        assert.equal(vapidConfig(), null);
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
        const jwk = privateKey.export({ format: 'jwk' });
        process.env.VAPID_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
        process.env.VAPID_PRIVATE_KEY = jwk.d;
        try {
            const config = vapidConfig();
            assert.equal(config.subject, 'https://finance.example.test');
            const header = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', config, Date.parse('2026-09-21T00:00:00Z'));
            const [, jwt, key] = header.match(/^vapid t=([\w.-]+), k=([\w-]+)$/);
            assert.equal(key, process.env.VAPID_PUBLIC_KEY);
            const [head, body, signature] = jwt.split('.');
            assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url')), { typ: 'JWT', alg: 'ES256' });
            assert.deepEqual(JSON.parse(Buffer.from(body, 'base64url')),
                { aud: 'https://fcm.googleapis.com', exp: Date.parse('2026-09-21T12:00:00Z') / 1000, sub: 'https://finance.example.test' });
            assert.equal(crypto.verify('sha256', Buffer.from(head + '.' + body), { key: publicKey, dsaEncoding: 'ieee-p1363' },
                Buffer.from(signature, 'base64url')), true);
        } finally { delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY; }
    });

    it('validates and stores notification preferences', () => {
        for (const good of [{ dueEmail: true, locale: 'en' }, { inactivityEmail: false }, { promptDismissed: true },
            { dailyReminder: { enabled: true, hour: 6 } }, { emailPausedUntil: null }]) {
            assert.equal(validPreferencesUpdate({ notifications: good }), true, JSON.stringify(good));
        }
        for (const bad of [true, {}, { dueEmail: 'yes' }, { locale: 'fr' }, { extra: 1 }, { dailyReminder: { enabled: true } },
            { dailyReminder: { enabled: true, hour: 5 } }, { dailyReminder: { enabled: true, hour: 21.5 } },
            { dailyReminder: { enabled: true, hour: 21, more: 1 } }, { emailPausedUntil: '2030-01-01' }]) {
            assert.equal(validPreferencesUpdate({ notifications: bad }), false, JSON.stringify(bad));
        }
        assert.deepEqual(preferenceUpdateFields({ notifications: { dueEmail: true, locale: 'zh-CN', dailyReminder: { enabled: true, hour: 20 }, emailPausedUntil: null } }, {}), {
            'preferences.notifications.dueEmail': true, 'preferences.notifications.locale': 'zh-CN',
            'preferences.notifications.dailyReminder.enabled': true, 'preferences.notifications.dailyReminder.hour': 20,
            'preferences.notifications.emailPausedUntil': null });
        assert.deepEqual(publicPreferences({}).notifications, { dueEmail: false, inactivityEmail: false,
            dailyReminder: { enabled: false, hour: 21 }, locale: 'vi', emailPausedUntil: null, promptDismissed: false });
    });
});
