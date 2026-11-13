'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_RATE_LIMIT_MAX = '100000';
for (const name of ['MONGODB_URI', 'GMAIL_USER', 'GMAIL_PASS', 'CORS_WHITELIST', 'CLIENT_URL']) delete process.env[name];
const app = require('../server');
const Transaction = require('../models/Transaction');
const TransactionAttachment = require('../models/TransactionAttachment');
const User = require('../models/User');
const totp = require('../utils/totp');
const { getAllWalletBalances } = require('../utils/walletBalance');

const PASSWORD = 'Test-password-1234';
async function client(name = 'Extras test') {
    const agent = request.agent(app);
    let csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
    const email = crypto.randomUUID() + '@example.test';
    const response = await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ name, email, password: PASSWORD });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    csrf = response.body.csrfToken;
    return {
        agent, email, userId: response.body.user.id,
        send(method, url, body, key = crypto.randomUUID()) {
            return agent[method](url).set('X-CSRF-Token', csrf).set('Idempotency-Key', key).send(body);
        }
    };
}
/** A second browser signing in to an existing account. */
async function signIn(email, extra = {}, userAgent = 'Second device') {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
    const response = await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).set('User-Agent', userAgent)
        .send({ email, password: PASSWORD, ...extra });
    return { agent, response, csrf: response.body.csrfToken };
}
async function wallet(c, initialBalance = 1000000, name = 'Extras wallet') {
    const response = await c.send('post', '/api/wallets', { name, initialBalance });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.id;
}
const PNG = 'data:image/png;base64,' + Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)
]).toString('base64');

describe('Tags, split bills, attachments, debts, settings, restore, sessions and 2FA', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_extras_test'));
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection(); await model.createIndexes();
        }
    });
    after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

    it('stores tags and notes, and filters by tag, amount range and text', async () => {
        const c = await client(), walletId = await wallet(c);
        const base = { type: 'expense', walletId, category: 'Food', date: '2025-12-28' };
        const lunch = await c.send('post', '/api/spending', { ...base, amount: 50000, desc: 'Bún chả',
            tags: [' Công Tác ', 'công tác', 'Hà Nội'], note: 'Đi với khách hàng' });
        assert.equal(lunch.status, 201, JSON.stringify(lunch.body));
        assert.deepEqual(lunch.body.data.tags, ['công tác', 'hà nội']);
        assert.equal(lunch.body.data.note, 'Đi với khách hàng');
        assert.equal((await c.send('post', '/api/spending', { ...base, amount: 300000, desc: 'Siêu thị' })).status, 201);

        const ids = async query => (await c.agent.get('/api/spending?' + query)).body.data.map(item => item.desc).sort();
        assert.deepEqual(await ids('tag=' + encodeURIComponent('công tác')), ['Bún chả']);
        assert.deepEqual(await ids('minAmount=100000'), ['Siêu thị']);
        assert.deepEqual(await ids('maxAmount=100000'), ['Bún chả']);
        assert.deepEqual(await ids('q=' + encodeURIComponent('khách hàng')), ['Bún chả']);
        assert.deepEqual(await ids('q=' + encodeURIComponent('siêu')), ['Siêu thị']);

        const edited = await c.send('put', '/api/spending/' + lunch.body.data.id, { ...base, amount: 50000, desc: 'Bún chả', tags: ['ăn trưa'], note: '' });
        assert.equal(edited.status, 200, JSON.stringify(edited.body));
        assert.deepEqual(edited.body.data.tags, ['ăn trưa']);
        assert.equal(edited.body.data.note, '');
        for (const bad of [{ tags: 'x' }, { tags: Array(11).fill(0).map((_, i) => 't' + i) }, { note: 'a'.repeat(2001) }, { tags: ['a'.repeat(31)] }]) {
            assert.equal((await c.send('post', '/api/spending', { ...base, amount: 1000, ...bad })).status, 400, JSON.stringify(bad).slice(0, 60));
        }
    });

    it('splits one bill into sibling transactions atomically and exactly once', async () => {
        const c = await client(), walletId = await wallet(c, 500000);
        const body = { type: 'expense', walletId, date: '2025-12-28', desc: 'Siêu thị', tags: ['tuần'],
            parts: [{ category: 'Food', amount: 200000 }, { category: 'Home', amount: 100000 }] };
        const key = crypto.randomUUID();
        const created = await c.send('post', '/api/spending/split', body, key);
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.deepEqual((await c.send('post', '/api/spending/split', body, key)).body, created.body);
        const [first, second] = created.body.data;
        assert.equal(first.splitGroupId, second.splitGroupId);
        assert.match(first.splitGroupId, /^[a-f0-9]{24}$/);
        assert.deepEqual(created.body.data.map(item => [item.category, item.amount, item.desc, item.tags[0]]),
            [['Food', 200000, 'Siêu thị', 'tuần'], ['Home', 100000, 'Siêu thị', 'tuần']]);
        assert.equal(await Transaction.countDocuments({ userId: c.userId }), 2);
        assert.equal((await getAllWalletBalances(c.userId))[walletId], 200000);

        // Overspending the wallet rejects the whole bill, not just the part that tips it over.
        const tooMuch = await c.send('post', '/api/spending/split', { ...body,
            parts: [{ category: 'Food', amount: 150000 }, { category: 'Home', amount: 150000 }] });
        assert.ok(tooMuch.status >= 400, String(tooMuch.status));
        assert.equal(await Transaction.countDocuments({ userId: c.userId }), 2);
        for (const parts of [[{ category: 'Food', amount: 1 }], [{ category: 'Food', amount: 1 }, { category: '', amount: 1 }],
            [{ category: 'Food', amount: 1.5 }, { category: 'Home', amount: 1 }], 'x']) {
            assert.equal((await c.send('post', '/api/spending/split', { ...body, parts })).status, 400);
        }
        const other = await client('Other');
        assert.ok((await other.send('post', '/api/spending/split', body)).status >= 400);
        assert.equal(await Transaction.countDocuments({ userId: other.userId }), 0);
    });

    it('keeps receipt images private, typed, capped and removed with reset', async () => {
        const c = await client(), other = await client('Other'), walletId = await wallet(c);
        const txn = (await c.send('post', '/api/spending', { type: 'expense', walletId, amount: 1000, category: 'Food', date: '2025-12-28' })).body.data;
        const url = '/api/spending/' + txn.id + '/attachments';
        for (const dataUrl of [undefined, 'data:image/gif;base64,AAAA', 'data:image/jpeg;base64,' + PNG.split(',')[1],
            'data:image/png;base64,' + Buffer.alloc(601 * 1024, 1).toString('base64')]) {
            assert.equal((await c.send('post', url, { dataUrl })).status, 400);
        }
        const saved = await c.send('post', url, { dataUrl: PNG });
        assert.equal(saved.status, 201, JSON.stringify(saved.body));
        assert.equal(saved.body.data.mime, 'image/png');
        assert.equal(saved.body.data.dataUrl, undefined);
        const list = await c.agent.get(url);
        assert.deepEqual(list.body.data.map(item => item.id), [saved.body.data.id]);
        assert.equal((await c.agent.get(url + '/' + saved.body.data.id)).body.data.dataUrl, PNG);
        assert.equal((await other.agent.get(url)).status, 404);
        assert.equal((await other.agent.get(url + '/' + saved.body.data.id)).status, 404);
        assert.equal((await other.send('post', url, { dataUrl: PNG })).status, 404);
        assert.equal((await other.send('delete', url + '/' + saved.body.data.id)).status, 404);
        assert.equal((await c.send('post', url, { dataUrl: PNG })).status, 201);
        assert.equal((await c.send('post', url, { dataUrl: PNG })).status, 201);
        assert.equal((await c.send('post', url, { dataUrl: PNG })).status, 400);
        assert.equal((await c.send('delete', url + '/' + saved.body.data.id)).status, 200);
        assert.equal(await TransactionAttachment.countDocuments({ userId: c.userId }), 2);
        assert.equal((await request(app).get(url)).status, 401);
    });

    it('saves filters and advanced budget options per account', async () => {
        const c = await client(), other = await client('Other'), walletId = await wallet(c);
        assert.deepEqual((await c.agent.get('/api/spending/settings')).body.data,
            { savedFilters: [], budget: { totalLimit: 0, weeklyLimit: 0, rollover: false } });
        const saved = await c.send('put', '/api/spending/saved-filters', { filters: [
            { name: ' Ăn ngoài ', criteria: { query: 'phở', type: 'expense', walletId, minAmount: 20000, tag: 'công tác', datePreset: 'thisMonth' } }] });
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
        const [filter] = saved.body.data.savedFilters;
        assert.equal(filter.name, 'Ăn ngoài');
        assert.deepEqual(filter.criteria, { query: 'phở', type: 'expense', category: 'all', walletId, tag: 'công tác',
            minAmount: 20000, maxAmount: null, datePreset: 'thisMonth', startDate: '', endDate: '', excludeRecurring: false });
        for (const filters of [Array(13).fill({ name: 'a', criteria: {} }), [{ name: '', criteria: {} }],
            [{ name: 'a', criteria: { type: 'bogus' } }], [{ name: 'a', criteria: { minAmount: -1 } }], [{ name: 'a' }]]) {
            assert.equal((await c.send('put', '/api/spending/saved-filters', { filters })).status, 400);
        }
        const budget = await c.send('put', '/api/spending/budget-settings', { totalLimit: 9000000, weeklyLimit: 2000000, rollover: true });
        assert.deepEqual(budget.body.data.budget, { totalLimit: 9000000, weeklyLimit: 2000000, rollover: true });
        assert.equal(budget.body.data.savedFilters.length, 1);
        for (const bad of [{ totalLimit: -1 }, { weeklyLimit: 1.5 }, { rollover: 'yes' }, { totalLimit: 1e12 }]) {
            assert.equal((await c.send('put', '/api/spending/budget-settings', bad)).status, 400);
        }
        assert.deepEqual((await other.agent.get('/api/spending/settings')).body.data.savedFilters, []);
    });

    it('tracks debts with repayments without touching wallet balances', async () => {
        const c = await client(), other = await client('Other'), walletId = await wallet(c, 1000);
        const created = await c.send('post', '/api/debts', { direction: 'lent', person: ' An ', amount: 500000,
            startDate: '2025-12-01', dueDate: '2026-01-01', note: 'Mượn mua xe' });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const debt = created.body.data, url = '/api/debts/' + debt.id;
        assert.deepEqual([debt.person, debt.paid, debt.remaining, debt.settled], ['An', 0, 500000, false]);
        const paid = await c.send('post', url + '/payments', { amount: 200000, date: '2025-12-10' });
        assert.equal(paid.status, 201, JSON.stringify(paid.body));
        assert.deepEqual([paid.body.data.paid, paid.body.data.remaining], [200000, 300000]);
        assert.equal((await c.send('post', url + '/payments', { amount: 300001, date: '2025-12-11' })).status, 400);
        assert.equal((await c.send('put', url, { amount: 100000 })).status, 400);
        const settled = await c.send('post', url + '/payments', { amount: 300000, date: '2025-12-12', note: 'Hết' });
        assert.equal(settled.body.data.settled, true);
        const undone = await c.send('delete', url + '/payments/' + settled.body.data.payments[1].id);
        assert.deepEqual([undone.body.data.payments.length, undone.body.data.settled], [1, false]);
        const edited = await c.send('put', url, { person: 'Anh An', dueDate: null, direction: 'borrowed' });
        assert.deepEqual([edited.body.data.person, edited.body.data.dueDate, edited.body.data.direction], ['Anh An', null, 'lent']);
        for (const bad of [{ direction: 'gift' }, { person: '' }, { amount: 0 }, { startDate: '2025-13-01' }, { dueDate: '2025-11-01' }]) {
            assert.equal((await c.send('post', '/api/debts', { direction: 'lent', person: 'B', amount: 1, startDate: '2025-12-01', ...bad })).status, 400);
        }
        assert.deepEqual((await other.agent.get('/api/debts')).body.data, []);
        assert.equal((await other.send('put', url, { person: 'X' })).status, 404);
        assert.equal((await other.send('post', url + '/payments', { amount: 1, date: '2025-12-10' })).status, 404);
        assert.equal((await other.send('delete', url)).status, 404);
        assert.equal((await getAllWalletBalances(c.userId))[walletId], 1000);
        assert.equal((await c.agent.get('/api/debts')).body.data.length, 1);
        assert.equal((await c.send('delete', url)).status, 200);
        assert.equal((await request(app).get('/api/debts')).status, 401);
    });

    it('restores an exported backup into another account and leaves data alone on a bad file', async () => {
        const source = await client('Source'), walletId = await wallet(source, 1000000, 'Ví chính');
        await source.send('post', '/api/spending', { type: 'expense', walletId, amount: 120000, category: 'Food', date: '2025-12-20', tags: ['a'], note: 'n' });
        await source.send('post', '/api/spending/split', { walletId, date: '2025-12-21', desc: 'Bill',
            parts: [{ category: 'Food', amount: 10000 }, { category: 'Home', amount: 20000 }] });
        await source.send('post', '/api/debts', { direction: 'borrowed', person: 'Bình', amount: 70000, startDate: '2025-12-01' });
        await source.send('put', '/api/spending/saved-filters', { filters: [{ name: 'Ví', criteria: { walletId } }] });
        await source.send('put', '/api/spending/budget-settings', { totalLimit: 5000000, rollover: true });
        const backup = (await source.agent.get('/api/spending/export')).body.data;
        assert.equal(backup.transactions.length, 3);

        const target = await client('Target'), oldWallet = await wallet(target, 42, 'Ví cũ');
        const url = '/api/spending/restore-backup';
        assert.equal((await target.send('post', url, { backup })).status, 400);
        const broken = structuredClone(backup);
        broken.transactions[0].walletId = new mongoose.Types.ObjectId().toString();
        for (const bad of [{ ...backup, version: 2 }, { ...backup, wallets: 'x' }, broken, null]) {
            assert.equal((await target.send('post', url, { backup: bad, confirm: 'RESTORE' })).status, 400);
        }
        assert.equal((await getAllWalletBalances(target.userId))[oldWallet], 42);

        const restored = await target.send('post', url, { backup, confirm: 'RESTORE' });
        assert.equal(restored.status, 200, JSON.stringify(restored.body));
        assert.deepEqual(restored.body.data, { wallets: backup.wallets.length, transactions: 3, jars: 0, installments: 0, budgets: 0, debts: 1 });
        const wallets = (await target.agent.get('/api/wallets')).body.data.filter(item => item.name === 'Ví chính');
        assert.ok(!(await target.agent.get('/api/wallets')).body.data.some(item => item.name === 'Ví cũ'));
        assert.deepEqual(wallets.map(item => item.name), ['Ví chính']);
        assert.notEqual(wallets[0].id, walletId);
        assert.equal((await getAllWalletBalances(target.userId))[wallets[0].id], 850000);
        const rows = (await target.agent.get('/api/spending')).body.data;
        assert.equal(rows.length, 3);
        assert.ok(rows.every(row => row.walletId === wallets[0].id));
        const groups = rows.filter(row => row.splitGroupId).map(row => row.splitGroupId);
        assert.equal(groups.length, 2);
        assert.equal(groups[0], groups[1]);
        assert.deepEqual(rows.find(row => row.amount === 120000).tags, ['a']);
        assert.equal((await target.agent.get('/api/debts')).body.data[0].person, 'Bình');
        const settings = (await target.agent.get('/api/spending/settings')).body.data;
        assert.equal(settings.savedFilters[0].criteria.walletId, wallets[0].id);
        assert.deepEqual(settings.budget, { totalLimit: 5000000, weeklyLimit: 0, rollover: true });
        // The source account is untouched, and the restored ledger still accepts new writes.
        assert.equal(await Transaction.countDocuments({ userId: source.userId }), 3);
        assert.equal((await target.send('post', '/api/spending', { type: 'expense', walletId: wallets[0].id, amount: 1, category: 'Food', date: '2025-12-28' })).status, 201);
    });

    it('lists signed-in devices and signs them out remotely', async () => {
        const c = await client();
        const phone = await signIn(c.email, {}, 'Phone browser'), tablet = await signIn(c.email, {}, 'Tablet browser');
        assert.equal(phone.response.status, 200, JSON.stringify(phone.response.body));
        const listed = (await c.agent.get('/api/auth/sessions')).body.data;
        assert.equal(listed.length, 3);
        assert.equal(listed.filter(item => item.current).length, 1);
        const phoneRow = listed.find(item => item.userAgent === 'Phone browser');
        assert.ok(phoneRow && !phoneRow.current);
        assert.equal((await c.send('post', '/api/auth/sessions/revoke', { id: listed.find(item => item.current).id })).status, 400);
        assert.equal((await c.send('post', '/api/auth/sessions/revoke', { id: 'nope' })).status, 400);
        const stranger = await client('Stranger');
        assert.equal((await stranger.send('post', '/api/auth/sessions/revoke', { id: phoneRow.id })).status, 404);
        assert.equal((await c.send('post', '/api/auth/sessions/revoke', { id: phoneRow.id })).status, 200);
        assert.equal((await phone.agent.get('/api/auth/session')).status, 401);
        assert.equal((await tablet.agent.get('/api/auth/session')).status, 200);
        const others = await c.send('post', '/api/auth/sessions/revoke-others');
        assert.equal(others.body.revoked, 1);
        assert.equal((await tablet.agent.get('/api/auth/session')).status, 401);
        assert.equal((await c.agent.get('/api/auth/session')).status, 200);
    });

    it('requires a fresh TOTP or one-time recovery code once 2FA is on', async () => {
        const c = await client(), elsewhere = await signIn(c.email);
        assert.equal((await c.send('post', '/api/auth/2fa/setup', { currentPassword: 'wrong-password-123' })).status, 400);
        assert.equal((await c.send('post', '/api/auth/2fa/enable', { code: '000000' })).status, 400);
        const setup = await c.send('post', '/api/auth/2fa/setup', { currentPassword: PASSWORD });
        assert.equal(setup.status, 200, JSON.stringify(setup.body));
        assert.match(setup.body.secret, /^[A-Z2-7]{32}$/);
        assert.ok(setup.body.otpauthUri.startsWith('otpauth://totp/CaltDHy'));
        // Steps are pinned up front so the test does not depend on where a 30 s boundary falls.
        const start = totp.currentStep();
        const code = offset => totp.codeAt(setup.body.secret, start + offset);
        const nearby = [-2, -1, 0, 1, 2, 3].map(code);
        const wrong = ['000000', '111111', '222222', '333333', '444444', '555555', '666666'].find(value => !nearby.includes(value));
        assert.equal((await c.send('post', '/api/auth/2fa/enable', { code: wrong })).status, 400);
        // Not enabled yet: a password alone still signs in.
        assert.equal((await signIn(c.email)).response.status, 200);
        const enabled = await c.send('post', '/api/auth/2fa/enable', { code: code(0) });
        assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
        assert.equal(enabled.body.recoveryCodes.length, 10);
        assert.equal((await c.agent.get('/api/auth/session')).body.user.twoFactorEnabled, true);
        assert.equal((await elsewhere.agent.get('/api/auth/session')).status, 401);
        const stored = await User.findById(c.userId).select('+twoFactor.secret +twoFactor.recoveryCodes').lean();
        assert.ok(!JSON.stringify(stored.twoFactor).includes(setup.body.secret));
        assert.ok(!JSON.stringify(stored.twoFactor).includes(enabled.body.recoveryCodes[0]));

        const needsCode = await signIn(c.email);
        assert.deepEqual([needsCode.response.status, needsCode.response.body.code], [401, 'TOTP_REQUIRED']);
        assert.equal((await signIn(c.email, { totpCode: wrong })).response.body.code, 'TOTP_INVALID');
        // The step used to enable is spent; the next ones each work once.
        assert.equal((await signIn(c.email, { totpCode: code(0) })).response.body.code, 'TOTP_INVALID');
        assert.equal((await signIn(c.email, { totpCode: code(1) })).response.status, 200);
        assert.equal((await signIn(c.email, { totpCode: code(1) })).response.body.code, 'TOTP_INVALID');
        const [recovery, spare] = enabled.body.recoveryCodes;
        assert.equal((await signIn(c.email, { totpCode: recovery.toUpperCase() })).response.status, 200);
        assert.equal((await signIn(c.email, { totpCode: recovery })).response.body.code, 'TOTP_INVALID');
        assert.equal((await signIn(c.email, { totpCode: 'x' })).response.body.code, 'TOTP_INVALID');

        assert.equal((await c.send('post', '/api/auth/2fa/setup', { currentPassword: PASSWORD })).status, 409);
        assert.equal((await c.send('post', '/api/auth/2fa/disable', { currentPassword: PASSWORD, code: wrong })).status, 400);
        assert.equal((await c.send('post', '/api/auth/2fa/disable', { currentPassword: 'wrong-password-123', code: spare })).status, 400);
        assert.equal((await c.send('post', '/api/auth/2fa/disable', { currentPassword: PASSWORD, code: spare })).status, 200);
        assert.equal((await signIn(c.email)).response.status, 200);
        assert.equal((await c.agent.get('/api/auth/session')).body.user.twoFactorEnabled, false);
    });
});
