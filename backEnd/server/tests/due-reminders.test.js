'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
const User = require('../models/User');
const Installment = require('../models/Installment');
const Transaction = require('../models/Transaction');
const { sendDueReminders } = require('../utils/dueReminders');
const { validPreferencesUpdate, preferenceUpdateFields } = require('../utils/cashFlowPreferences');
const { publicPreferences } = require('../utils/publicUser');

const today = '2026-09-21';
let counter = 0;
const user = (extra = {}) => User.create({
    name: 'Reminder', email: `reminder${++counter}@example.test`, password: 'x'.repeat(60), emailVerified: true,
    preferences: { dueReminders: { email: true, locale: 'vi' } }, ...extra
});
const item = (userId, nextDueDate, extra = {}) => Installment.create({
    userId, name: 'Bill ' + nextDueDate, amount: 150000, category: 'Bills', cycle: 'monthly', nextDueDate, ...extra
});

describe('Due reminder emails', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_reminder_test'));
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
        const mails = [];
        const send = async mail => { mails.push(mail); };
        assert.deepEqual(await sendDueReminders({ today, send }), { sent: 1, failed: 0 });
        assert.equal(mails.length, 1);
        assert.equal(mails[0].to, owner.email);
        assert.match(mails[0].subject, /3 khoản/);
        assert.match(mails[0].text, /Sẽ nhận: Lương · 150\.000 ₫ · 2026-09-21 \(hôm nay\)/);
        assert.match(mails[0].text, /Cần trả: Bill 2026-09-24 .*còn 3 ngày/);
        assert.match(mails[0].text, /quá hạn 6 ngày/);
        assert.doesNotMatch(mails[0].text, /2026-09-25|2026-09-13/);
        assert.deepEqual(await sendDueReminders({ today, send }), { sent: 0, failed: 0 });
        assert.equal(mails.length, 1);
        assert.equal(await Transaction.countDocuments({ userId: owner._id }), 0);
    });

    it('skips users who did not opt in or have an unverified address, and escapes names in HTML', async () => {
        const off = await user({ preferences: { dueReminders: { email: false } } });
        const unverified = await user({ emailVerified: false });
        const english = await user({ name: '<b>Eve</b>', preferences: { dueReminders: { email: true, locale: 'en' } } });
        for (const owner of [off, unverified, english]) await item(owner._id, today, { name: '<i>Rent</i>' });
        const mails = [];
        await sendDueReminders({ today, send: async mail => { mails.push(mail); } });
        assert.deepEqual(mails.map(mail => mail.to), [english.email]);
        assert.match(mails[0].subject, /1 recurring item need/);
        assert.match(mails[0].text, /To pay: <i>Rent<\/i> .*\(today\)/);
        assert.doesNotMatch(mails[0].html, /<b>|<i>/);
    });

    it('a failed delivery releases the period so the next run retries it, and a new period is reminded again', async () => {
        const owner = await user();
        const bill = await item(owner._id, today);
        const failing = async () => { throw new Error('smtp down'); };
        assert.deepEqual(await sendDueReminders({ today, send: failing }), { sent: 0, failed: 1 });
        assert.equal((await Installment.findById(bill._id)).lastReminderPeriod, null);
        const mails = [];
        const send = async mail => { mails.push(mail); };
        assert.deepEqual(await sendDueReminders({ today, send }), { sent: 1, failed: 0 });
        await Installment.updateOne({ _id: bill._id }, { $set: { nextDueDate: '2026-10-21' } });
        assert.deepEqual(await sendDueReminders({ today: '2026-10-19', send }), { sent: 1, failed: 0 });
        assert.equal(mails.length, 2);
        assert.equal((await Installment.findById(bill._id)).toJSON().lastReminderPeriod, undefined);
    });

    it('validates and stores the reminder preference', () => {
        assert.equal(validPreferencesUpdate({ dueReminders: { email: true, locale: 'en' } }), true);
        assert.equal(validPreferencesUpdate({ dueReminders: { email: false } }), true);
        for (const bad of [{ dueReminders: true }, { dueReminders: {} }, { dueReminders: { email: 'yes' } },
            { dueReminders: { email: true, locale: 'fr' } }, { dueReminders: { email: true, extra: 1 } }]) {
            assert.equal(validPreferencesUpdate(bad), false, JSON.stringify(bad));
        }
        assert.deepEqual(preferenceUpdateFields({ dueReminders: { email: true, locale: 'zh-CN' } }, {}),
            { 'preferences.dueReminders.email': true, 'preferences.dueReminders.locale': 'zh-CN' });
        assert.deepEqual(publicPreferences({}).dueReminders, { email: false, locale: 'vi' });
    });
});
