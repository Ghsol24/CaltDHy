'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet, MongoMemoryServer } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '1h';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_RATE_LIMIT_MAX = '100000';
delete process.env.MONGODB_URI;
delete process.env.GMAIL_USER;
delete process.env.GMAIL_PASS;
delete process.env.CORS_WHITELIST;
delete process.env.CLIENT_URL;
const app = require('../server');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Jar = require('../models/Jar');
const Transaction = require('../models/Transaction');
const Installment = require('../models/Installment');
const AuthSession = require('../models/AuthSession');
const Receipt = require('../models/IdempotencyReceipt');
const { getAllWalletBalances } = require('../utils/walletBalance');
const { runWithTransaction } = require('../utils/mongoTransaction');
const password = 'Test-password-1234';
const date = '2026-09-21';
async function client(label) {
    const agent = request.agent(app);
    let csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
    const email = label + '-' + crypto.randomUUID() + '@example.test';
    const response = await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ name: label, email, password });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    csrf = response.body.csrfToken;
    return {
        agent, email, user: response.body.user, response,
        async send(method, url, body, key = crypto.randomUUID()) {
            return agent[method](url).set('X-CSRF-Token', csrf).set('Idempotency-Key', key).send(body);
        },
        async refresh() { csrf = (await agent.get('/api/auth/csrf')).body.csrfToken; }
    };
}
async function wallet(c, amount = 1000, extra = {}) {
    const response = await c.send('post', '/api/wallets', { name: 'Wallet', initialBalance: amount, ...extra });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.id;
}
const expense = (walletId, amount) => ({ walletId, amount, type: 'expense', category: 'Food', date, desc: 'Test' });

describe('Security and financial invariants on a real replica set', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_test'));
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection(); await model.createIndexes();
        }
    });
    after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

    it('credentials are HttpOnly cookies, never response JWT; session verifies persisted identity', async () => {
        const c = await client('cookies');
        assert.equal(c.response.body.token, undefined);
        assert.equal(c.user.emailVerified, false);
        const cookie = c.response.headers['set-cookie'].find(value => value.startsWith('caltdhy_session='));
        assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
        const session = await c.agent.get('/api/auth/session');
        assert.equal(session.status, 200); assert.equal(session.body.user.id, c.user.id);
        const raw = cookie.split(';')[0].split('=')[1];
        assert.equal(await AuthSession.countDocuments({ tokenHash: raw }), 0);
        assert.equal(await AuthSession.countDocuments({ tokenHash: require('../utils/sessionSecurity').hash(raw) }), 1);
    });
    it('CSRF rejects missing/forged tokens and token copied from another browser', async () => {
        const c = await client('csrf');
        assert.equal((await c.agent.post('/api/wallets').send({ name: 'NoCSRF' })).status, 403);
        const stranger = request.agent(app);
        const other = (await stranger.get('/api/auth/csrf')).body.csrfToken;
        assert.equal((await c.agent.post('/api/auth/logout').set('X-CSRF-Token', other)).status, 403);
        assert.equal((await request(app).get('/api/wallets').set('Authorization', 'Bearer obsolete')).status, 401);
    });
    it('logout revokes the server session, copied cookies cannot be replayed', async () => {
        const c = await client('logout');
        const cookies = c.response.headers['set-cookie'].map(value => value.split(';')[0]).join('; ');
        assert.equal((await c.send('post', '/api/auth/logout', {})).status, 200);
        assert.equal((await request(app).get('/api/auth/session').set('Cookie', cookies)).status, 401);
    });
    it('expiry is enforced immediately, independently of MongoDB TTL cleanup', async () => {
        const c = await client('expiry');
        await AuthSession.updateMany({ userId: c.user.id }, { $set: { expiresAt: new Date(0) } });
        assert.equal((await c.agent.get('/api/auth/session')).status, 401);
    });
    it('password reset consumes a token once and revokes all sessions', async () => {
        const c = await client('reset');
        const token = crypto.randomBytes(32).toString('hex');
        await User.updateOne({ _id: c.user.id }, { $set: {
            resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'), resetPasswordExpiry: new Date(Date.now() + 60000)
        } });
        const body = { email: c.email, token, newPassword: password + 'new' };
        const responses = await Promise.all([c.send('post', '/api/auth/reset-password', body), c.send('post', '/api/auth/reset-password', body)]);
        assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
        assert.equal((await c.agent.get('/api/auth/session')).status, 401);
    });
    it('BOLA rejects foreign wallet/jar/installment links and operator-shaped IDs', async () => {
        const a = await client('ownerA'), b = await client('ownerB');
        const foreign = await wallet(b);
        for (const payload of [expense(foreign, 1), expense({ $ne: null }, 1)]) {
            assert.equal((await a.send('post', '/api/spending', payload)).status, 400);
        }
        const response = await a.send('post', '/api/jars/installments', {
            name: 'Rent', amount: 1, category: 'Bills', cycle: 'monthly', nextDueDate: date, walletId: foreign
        });
        assert.equal(response.status, 400);
        assert.equal(await Transaction.countDocuments({ userId: a.user.id }), 0);
    });
    it('expected high-spend dates are validated and scoped to each account', async () => {
        const owner = await client('expected-owner'), other = await client('expected-other');
        const url = '/api/spending/expected-days/2026-09-03';
        assert.equal((await owner.send('put', url, { expected: true })).status, 200);
        assert.deepEqual((await owner.agent.get('/api/spending/expected-days?month=2026-09')).body.data, ['2026-09-03']);
        assert.deepEqual((await other.agent.get('/api/spending/expected-days?month=2026-09')).body.data, []);
        assert.equal((await other.send('put', url, { expected: true })).status, 200);
        assert.equal((await owner.send('put', url, { expected: false })).status, 200);
        assert.deepEqual((await owner.agent.get('/api/spending/expected-days?month=2026-09')).body.data, []);
        assert.deepEqual((await other.agent.get('/api/spending/expected-days?month=2026-09')).body.data, ['2026-09-03']);
        assert.equal((await owner.send('put', '/api/spending/expected-days/2026-02-30', { expected: true })).status, 400);
        assert.equal((await owner.send('put', url, { expected: 'yes' })).status, 400);
        assert.equal((await owner.agent.get('/api/spending/expected-days?month=2026-13')).status, 400);
        assert.equal((await owner.send('put', url, { expected: true })).status, 200);
        assert.equal((await owner.send('post', '/api/spending/reset-data', {})).status, 200);
        assert.deepEqual((await owner.agent.get('/api/spending/expected-days?month=2026-09')).body.data, []);
        assert.deepEqual((await other.agent.get('/api/spending/expected-days?month=2026-09')).body.data, ['2026-09-03']);
    });
    it('rejects decimal, coercible and unsafe money without persisting a write', async () => {
        const c = await client('money'); const id = await wallet(c);
        for (const amount of [0.1, 1.005, '100', null, true, Number.MAX_SAFE_INTEGER + 1]) {
            assert.equal((await c.send('post', '/api/spending', expense(id, amount))).status, 400);
        }
        assert.equal(await Transaction.countDocuments({ userId: c.user.id }), 0);
    });
    it('foreign resource IDs cannot read or mutate wallets, jars, installments or ledger entries', async () => {
        const owner = await client('resource-owner'), other = await client('resource-attacker');
        const id = await wallet(owner, 1000), ownWallet = await wallet(other, 1000);
        const jar = (await owner.send('post', '/api/jars', { name: 'Private jar', target: 1000, current: 0 })).body.data;
        const recurring = (await owner.send('post', '/api/jars/installments', {
            name: 'Private recurring', amount: 10, category: 'Bills', cycle: 'monthly', nextDueDate: date, walletId: id
        })).body.data;
        const row = (await owner.send('post', '/api/spending', expense(id, 10))).body.data;
        for (const [method, url, body] of [
            ['get', '/api/wallets/' + id + '/pre-archive'],
            ['put', '/api/wallets/' + id, { name: 'Hijacked' }],
            ['post', '/api/wallets/' + id + '/archive', { transferToWalletId: ownWallet }],
            ['delete', '/api/wallets/' + id],
            ['put', '/api/jars/' + jar.id, { name: 'Hijacked' }],
            ['patch', '/api/jars/' + jar.id + '/deposit', { amount: 1, walletId: ownWallet }],
            ['delete', '/api/jars/' + jar.id],
            ['patch', '/api/jars/installments/' + recurring.id + '/pay', { period: date, walletId: ownWallet }],
            ['delete', '/api/jars/installments/' + recurring.id],
            ['put', '/api/spending/' + row.id, expense(ownWallet, 1)],
            ['delete', '/api/spending/' + row.id]
        ]) {
            const response = await other.send(method, url, body);
            assert.equal(response.status, 404, method + ' ' + url + ': ' + JSON.stringify(response.body));
        }
        for (const url of ['/api/wallets', '/api/jars', '/api/jars/installments', '/api/spending']) {
            const response = await other.agent.get(url);
            assert.equal(response.status, 200);
            for (const privateId of [id, jar.id, recurring.id, row.id]) assert.ok(!response.text.includes(privateId));
        }
        assert.equal((await getAllWalletBalances(owner.user.id))[id], 990);
        assert.equal((await Jar.findById(jar.id)).current, 0);
        assert.equal((await Installment.findById(recurring.id)).totalPaid, 0);
        assert.equal(await Transaction.countDocuments({ userId: owner.user.id }), 1);
        assert.equal(await Transaction.countDocuments({ userId: other.user.id }), 0);
    });
    it('concurrent repeated key produces exactly one entry and identical responses', async () => {
        const c = await client('replay'); const id = await wallet(c); const key = crypto.randomUUID();
        const responses = await Promise.all(Array.from({ length: 8 }, () => c.send('post', '/api/spending', expense(id, 100), key)));
        assert.ok(responses.every(r => r.status === 201), responses.map(r => r.status).join(','));
        assert.equal(new Set(responses.map(r => r.body.data.id)).size, 1);
        assert.equal(await Transaction.countDocuments({ userId: c.user.id }), 1);
        assert.equal((await getAllWalletBalances(c.user.id))[id], 900);
        assert.equal((await c.send('post', '/api/spending', expense(id, 200), key)).status, 409);
    });
    it('concurrent distinct spends cannot overdraw a cash wallet', async () => {
        const c = await client('concurrent'); const id = await wallet(c, 100);
        const responses = await Promise.all(Array.from({ length: 4 }, () => c.send('post', '/api/spending', expense(id, 80))));
        assert.equal(responses.filter(r => r.status === 201).length, 1);
        assert.ok(responses.every(r => [201, 409].includes(r.status)));
        assert.equal((await getAllWalletBalances(c.user.id))[id], 20);
        assert.equal(await Transaction.countDocuments({ userId: c.user.id }), 1);
    });
    it('wallet close serializes with transfer and preserves the total', async () => {
        const c = await client('close'); const source = await wallet(c, 100); const target = await wallet(c, 0);
        const transfer = { ...expense(source, 80), type: 'transfer', toWalletId: target };
        const responses = await Promise.all([
            c.send('post', '/api/wallets/' + source + '/archive', { transferToWalletId: target }),
            c.send('post', '/api/spending', transfer)
        ]);
        assert.equal(responses[0].status, 200, JSON.stringify(responses[0].body));
        assert.ok([201, 400].includes(responses[1].status));
        const balances = await getAllWalletBalances(c.user.id);
        assert.equal(balances[source], 0); assert.equal(balances[target], 100);
        assert.equal((await Wallet.findById(source)).archived, true);
    });
    it('jar transfer rollback restores jar and ledger on insufficient wallet balance', async () => {
        const c = await client('jar'); const id = await wallet(c, 100);
        const jar = (await c.send('post', '/api/jars', { name: 'Save', target: 1000, current: 0 })).body.data;
        assert.equal((await c.send('patch', '/api/jars/' + jar.id + '/deposit', { amount: 150, walletId: id })).status, 409);
        assert.equal((await Jar.findById(jar.id)).current, 0);
        assert.equal(await Transaction.countDocuments({ userId: c.user.id }), 0);
        assert.equal((await c.send('patch', '/api/jars/' + jar.id + '/deposit', { amount: 80, walletId: id })).status, 200);
        const balance = (await getAllWalletBalances(c.user.id))[id];
        assert.equal(balance + (await Jar.findById(jar.id)).current, 100);
        assert.equal((await c.send('delete', '/api/jars/' + jar.id)).status, 409);
    });
    it('a recurring period cannot be paid twice even with different request keys', async () => {
        const c = await client('period'); const id = await wallet(c, 1000);
        const item = (await c.send('post', '/api/jars/installments', {
            name: 'Bill', amount: 100, category: 'Bills', cycle: 'monthly', nextDueDate: date, walletId: id
        })).body.data;
        const results = await Promise.all([
            c.send('patch', '/api/jars/installments/' + item.id + '/pay', { period: date }),
            c.send('patch', '/api/jars/installments/' + item.id + '/pay', { period: date })
        ]);
        assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
        assert.equal(await Transaction.countDocuments({ installmentId: item.id }), 1);
        assert.equal((await Installment.findById(item.id)).totalPaid, 100);
        assert.equal((await getAllWalletBalances(c.user.id))[id], 900);
    });
    it('failure inserting an idempotency receipt rolls back the entire money operation', async () => {
        const c = await client('rollback'); const id = await wallet(c, 100);
        const original = Receipt.create;
        Receipt.create = async () => { throw new Error('Injected failure after financial write'); };
        try { assert.equal((await c.send('post', '/api/spending', expense(id, 30))).status, 503); }
        finally { Receipt.create = original; }
        assert.equal(await Transaction.countDocuments({ userId: c.user.id }), 0);
        assert.equal((await getAllWalletBalances(c.user.id))[id], 100);
    });
    it('mandatory transaction helper rolls back changes when work throws', async () => {
        const c = await client('txn');
        await assert.rejects(runWithTransaction(async () => {
            await Wallet.create({ userId: c.user.id, name: 'Must roll back', initialBalance: 1 });
            throw new Error('Injected fault');
        }));
        assert.equal(await Wallet.countDocuments({ userId: c.user.id, name: 'Must roll back' }), 0);
    });
    it('no raw parser errors or blocked origins are reflected', async () => {
        assert.equal((await request(app).get('/api/health').set('Origin', 'https://untrusted.example')).status, 403);
        const c = await client('parser'); const csrf = (await c.agent.get('/api/auth/csrf')).body.csrfToken;
        const response = await c.agent.post('/api/auth/login').set('X-CSRF-Token', csrf)
            .set('Content-Type', 'application/json').send('{"private":"SECRET_SENTINEL"');
        assert.equal(response.status, 400); assert.ok(!response.text.includes('SECRET_SENTINEL'));
    });
});

describe('Standalone MongoDB is never a fallback', () => {
    it('a write requiring transaction is refused without any persisted mutation', async () => {
        const db = await MongoMemoryServer.create();
        try {
            await mongoose.connect(db.getUri('caltdhy_standalone_test'));
            await User.init();
            await assert.rejects(runWithTransaction(async () => {
                await User.create({ name: 'No fallback', email: 'no-fallback@example.test', password: 'hash' });
            }));
            assert.equal(await User.countDocuments(), 0);
        } finally { await mongoose.disconnect(); await db.stop(); }
    });
});
