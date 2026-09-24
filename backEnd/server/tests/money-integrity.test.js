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
const Wallet = require('../models/Wallet');
const Jar = require('../models/Jar');
const Installment = require('../models/Installment');
const Transaction = require('../models/Transaction');
const Receipt = require('../models/IdempotencyReceipt');
const { getAllWalletBalances } = require('../utils/walletBalance');
const date = '2026-09-21';
async function client() {
    const agent = request.agent(app);
    let csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
    const response = await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({
        name: 'Money test', email: crypto.randomUUID() + '@example.test', password: 'Test-password-1234'
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    csrf = response.body.csrfToken;
    return {
        agent, userId: response.body.user.id,
        send(method, url, body, key = crypto.randomUUID()) {
            return agent[method](url).set('X-CSRF-Token', csrf).set('Idempotency-Key', key).send(body);
        }
    };
}
async function wallet(c, initialBalance = 1000, extra = {}) {
    const response = await c.send('post', '/api/wallets', { name: 'Test wallet', initialBalance, ...extra });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.id;
}
async function jar(c, current = 0) {
    const response = await c.send('post', '/api/jars', { name: 'Savings', target: 1000, current });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.id;
}
async function installment(c, walletId) {
    const response = await c.send('post', '/api/jars/installments', {
        name: 'Bill', amount: 100, category: 'Bills', cycle: 'monthly', nextDueDate: date, walletId
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.id;
}
const spending = (walletId, amount, extra = {}) => ({ type: 'expense', walletId, amount, category: 'Food', date, ...extra });

describe('Financial regression cases on a temporary replica set', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_money_test'));
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection(); await model.createIndexes();
        }
    });
    after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

    it('concurrent jar withdrawals preserve wallet plus jar money and reject overdraft', async () => {
        const c = await client(), w = await wallet(c, 0), j = await jar(c, 100);
        const responses = await Promise.all(Array.from({ length: 5 }, () =>
            c.send('patch', '/api/jars/' + j + '/withdraw', { amount: 70, walletId: w })));
        assert.equal(responses.filter(r => r.status === 200).length, 1);
        assert.ok(responses.every(r => [200, 400].includes(r.status)));
        assert.equal((await getAllWalletBalances(c.userId))[w], 70);
        assert.equal((await Jar.findById(j)).current, 30);
        assert.equal(await Transaction.countDocuments({ userId: c.userId }), 1);
    });

    it('concurrent default selection leaves exactly one default wallet', async () => {
        const c = await client(), a = await wallet(c), b = await wallet(c);
        const results = await Promise.all([a, b].map(id => c.send('put', '/api/wallets/' + id, { isDefault: true })));
        assert.ok(results.every(r => r.status === 200), JSON.stringify(results.map(r => r.body)));
        assert.equal(await Wallet.countDocuments({ userId: c.userId, isDefault: true, archived: false }), 1);
    });

    it('deleting the default wallet merges balances and keeps transfer fees exactly once', async () => {
        const c = await client();
        const source = (await Wallet.findOne({ userId: c.userId, isDefault: true })).id;
        assert.equal((await c.send('put', '/api/wallets/' + source, { initialBalance: 200 })).status, 200);
        const target = await wallet(c, 100);
        assert.equal((await c.send('post', '/api/spending', spending(source, 50, { type: 'transfer', toWalletId: target, fee: 7 }))).status, 201);
        const result = await c.send('delete', '/api/wallets/' + source);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal((await getAllWalletBalances(c.userId))[target], 293);
        assert.equal(await Wallet.countDocuments({ userId: c.userId, isDefault: true }), 1);
        const fees = await Transaction.find({ userId: c.userId }).lean();
        assert.equal(fees.length, 1); assert.equal(fees[0].amount, 7); assert.equal(fees[0].type, 'expense');
    });

    it('archive failure after settlement creation rolls back ledger, balance and receipt', async () => {
        const c = await client(), source = await wallet(c, 200), target = await wallet(c, 0);
        const key = crypto.randomUUID(), original = Wallet.prototype.save;
        Wallet.prototype.save = async function (...args) {
            if (this.archived && this.id === source) throw new Error('Injected failure after settlement');
            return original.apply(this, args);
        };
        try {
            const response = await c.send('post', '/api/wallets/' + source + '/archive', { transferToWalletId: target }, key);
            assert.equal(response.status, 500);
        } finally { Wallet.prototype.save = original; }
        assert.equal(await Transaction.countDocuments({ userId: c.userId }), 0);
        assert.equal(await Receipt.countDocuments({ userId: c.userId, key }), 0);
        assert.equal((await Wallet.findById(source)).archived, false);
        const balances = await getAllWalletBalances(c.userId);
        assert.equal(balances[source], 200); assert.equal(balances[target], 0);
        assert.equal((await c.send('post', '/api/wallets/' + source + '/archive', { transferToWalletId: target }, key)).status, 200);
    });

    it('receipts are account-bound and canonical object order does not cause another write', async () => {
        const a = await client(), b = await client(), aw = await wallet(a), bw = await wallet(b), key = crypto.randomUUID();
        const body = spending(aw, 100);
        const first = await a.send('post', '/api/spending', body, key);
        const retry = await a.send('post', '/api/spending', Object.fromEntries(Object.entries(body).reverse()), key);
        assert.equal(first.status, 201); assert.deepEqual(retry.body, first.body);
        assert.equal((await b.send('post', '/api/spending', spending(bw, 200), key)).status, 201);
        assert.equal(await Receipt.countDocuments({ key }), 2);
        assert.equal((await getAllWalletBalances(a.userId))[aw], 900);
        assert.equal((await getAllWalletBalances(b.userId))[bw], 800);
    });

    it('deleting two paid installments in the same period retains distinct immutable histories', async () => {
        const c = await client(), w = await wallet(c), a = await installment(c, w), b = await installment(c, w);
        for (const id of [a, b]) {
            assert.equal((await c.send('patch', '/api/jars/installments/' + id + '/pay', { period: date })).status, 200);
            const response = await c.send('delete', '/api/jars/installments/' + id);
            assert.equal(response.status, 200, JSON.stringify(response.body));
        }
        const ledger = await Transaction.find({ userId: c.userId });
        assert.equal(ledger.length, 2);
        assert.equal(new Set(ledger.map(tx => tx.installmentId.toString())).size, 2);
        assert.equal((await getAllWalletBalances(c.userId))[w], 800);
        for (const tx of ledger) assert.equal((await c.send('delete', '/api/spending/' + tx.id)).status, 400);
    });

    it('backdating a recurring due date never allows charging an already paid period', async () => {
        const c = await client(), w = await wallet(c), id = await installment(c, w);
        assert.equal((await c.send('patch', '/api/jars/installments/' + id + '/pay', { period: date })).status, 200);
        assert.equal((await c.send('put', '/api/jars/installments/' + id, { nextDueDate: date })).status, 200);
        assert.equal((await c.send('patch', '/api/jars/installments/' + id + '/pay', { period: date })).status, 409);
        assert.equal(await Transaction.countDocuments({ installmentId: id }), 1);
        assert.equal((await Installment.findById(id)).totalPaid, 100);
    });

    it('a foreign legacy installment wallet link is refused rather than charging a fallback wallet', async () => {
        const a = await client(), b = await client(), aw = await wallet(a), bw = await wallet(b);
        const id = await installment(a, aw);
        await Installment.updateOne({ _id: id }, { $set: { walletId: bw } });
        assert.equal((await a.send('patch', '/api/jars/installments/' + id + '/pay', { period: date })).status, 400);
        assert.equal(await Transaction.countDocuments({ userId: a.userId }), 0);
        assert.equal((await getAllWalletBalances(a.userId))[aw], 1000);
        assert.equal((await getAllWalletBalances(b.userId))[bw], 1000);
    });

    it('deleting an empty legacy jar does not unlock its old generated transfers for editing', async () => {
        const c = await client(), w = await wallet(c, 100), j = await jar(c);
        await Transaction.collection.insertOne({ userId: new mongoose.Types.ObjectId(c.userId), type: 'transfer',
            walletId: new mongoose.Types.ObjectId(w), jarId: new mongoose.Types.ObjectId(j), amount: 10, fee: 0, date: new Date(date), category: 'Jar' });
        assert.equal((await c.send('delete', '/api/jars/' + j)).status, 200);
        const tx = await Transaction.findOne({ userId: c.userId });
        assert.equal(tx.systemGenerated, true);
        assert.equal((await c.send('delete', '/api/spending/' + tx.id)).status, 400);
        assert.equal((await getAllWalletBalances(c.userId))[w], 90);
    });

    it('rejects unsafe sum across wallets and jars without committing the new jar', async () => {
        const c = await client(); await wallet(c, Number.MAX_SAFE_INTEGER);
        const response = await c.send('post', '/api/jars', { name: 'Overflow', target: 10, current: 1 });
        assert.equal(response.status, 409);
        assert.equal(await Jar.countDocuments({ userId: c.userId }), 0);
    });

    it('income deletion rolls back when its money has already been spent', async () => {
        const c = await client(), w = await wallet(c, 0);
        const income = await c.send('post', '/api/spending', spending(w, 100, { type: 'income' }));
        assert.equal(income.status, 201);
        assert.equal((await c.send('post', '/api/spending', spending(w, 80))).status, 201);
        assert.equal((await c.send('delete', '/api/spending/' + income.body.data.id)).status, 409);
        assert.equal((await getAllWalletBalances(c.userId))[w], 20);
        assert.equal(await Transaction.countDocuments({ userId: c.userId }), 2);
    });

    it('a transient error after a ledger insert retries without duplicate money or receipt', async () => {
        const c = await client(), w = await wallet(c, 100), key = crypto.randomUUID();
        const original = Transaction.create;
        let attempts = 0;
        Transaction.create = async function (...args) {
            const result = await original.apply(this, args);
            if (++attempts === 1) {
                const error = new mongoose.mongo.MongoServerError({ message: 'Injected transient failure' });
                error.addErrorLabel('TransientTransactionError');
                throw error;
            }
            return result;
        };
        try {
            const response = await c.send('post', '/api/spending', spending(w, 70), key);
            assert.equal(response.status, 201, JSON.stringify(response.body));
        } finally { Transaction.create = original; }
        assert.equal(attempts, 2);
        assert.equal(await Transaction.countDocuments({ userId: c.userId }), 1);
        assert.equal(await Receipt.countDocuments({ userId: c.userId, key }), 1);
        assert.equal((await getAllWalletBalances(c.userId))[w], 30);
    });

    it('wallet removal racing an expense has a serial outcome and conserved remaining funds', async () => {
        const c = await client(), source = await wallet(c, 100), target = await wallet(c, 0, { isDefault: true });
        const results = await Promise.all([
            c.send('delete', '/api/wallets/' + source),
            c.send('post', '/api/spending', spending(source, 70))
        ]);
        assert.equal(results[0].status, 200);
        assert.ok([201, 400].includes(results[1].status));
        const spent = results[1].status === 201 ? 70 : 0;
        assert.equal((await getAllWalletBalances(c.userId))[target], 100 - spent);
        assert.equal(await Transaction.countDocuments({ userId: c.userId, walletId: source }), 0);
        assert.equal(await Transaction.countDocuments({ userId: c.userId }), spent ? 1 : 0);
    });

    it('deeply nested bodies are rejected without an unhandled async failure or mutation', async () => {
        const c = await client(), w = await wallet(c, 100);
        let value = {};
        for (let depth = 0; depth < 40; depth += 1) value = { nested: value };
        const response = await c.send('post', '/api/spending', { ...spending(w, 1), extra: value });
        assert.equal(response.status, 400);
        assert.equal(await Transaction.countDocuments({ userId: c.userId }), 0);
        assert.equal((await c.agent.get('/api/health')).status, 200);
    });

    it('development cleanup removes only the selected account sessions, receipts, money fence and expected days', async () => {
        const connection = await mongoose.createConnection(db.getUri('caltdhy_test')).asPromise();
        try {
            const selected = new mongoose.Types.ObjectId(), untouched = new mongoose.Types.ObjectId();
            for (const name of ['users', 'moneylocks']) {
                await connection.db.collection(name).insertMany([{ _id: selected }, { _id: untouched }]);
            }
            for (const name of ['authsessions', 'idempotencyreceipts', 'expectedhighspenddays']) {
                await connection.db.collection(name).insertMany([{ userId: selected }, { userId: untouched }]);
            }
            const { cleanup } = require('../scripts/cleanup-users');
            const options = { mongoUri: db.getUri('caltdhy_test'), expectedDb: 'caltdhy_test', userIds: [selected.toString()] };
            const preview = await cleanup(options);
            assert.equal(preview.counts.moneylocks, 1); assert.equal(preview.counts.authsessions, 1);
            assert.equal(preview.counts.expectedhighspenddays, 1);
            assert.equal(await connection.db.collection('users').countDocuments(), 2);
            const result = await cleanup({ ...options, apply: true, confirm: preview.confirmation });
            assert.equal(result.deleted.idempotencyreceipts, 1);
            assert.equal(result.deleted.expectedhighspenddays, 1);
            for (const name of ['users', 'moneylocks', 'authsessions', 'idempotencyreceipts', 'expectedhighspenddays']) {
                const filter = ['users', 'moneylocks'].includes(name) ? { _id: untouched } : { userId: untouched };
                assert.equal(await connection.db.collection(name).countDocuments(), 1);
                assert.equal(await connection.db.collection(name).countDocuments(filter), 1);
            }
        } finally { await connection.close(); }
    });
});
