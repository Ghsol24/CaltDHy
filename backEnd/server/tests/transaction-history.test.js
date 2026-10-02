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
const TransactionRevision = require('../models/TransactionRevision');
const Receipt = require('../models/IdempotencyReceipt');
const { getAllWalletBalances } = require('../utils/walletBalance');

async function client(name = 'History test') {
    const agent = request.agent(app);
    const csrfResponse = await agent.get('/api/auth/csrf');
    assert.equal(csrfResponse.status, 200, JSON.stringify(csrfResponse.body));
    let csrf = csrfResponse.body.csrfToken;
    assert.equal(typeof csrf, 'string');
    const response = await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({
        name, email: crypto.randomUUID() + '@example.test', password: 'Test-password-1234'
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
async function wallet(c, initialBalance = 1000) {
    const response = await c.send('post', '/api/wallets', { name: 'History wallet', initialBalance });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.id;
}
const spending = (walletId, amount, extra = {}) => ({
    type: 'expense', walletId, amount, category: 'Food', date: '2025-12-28', desc: 'Original', ...extra
});
async function create(c, body) {
    const response = await c.send('post', '/api/spending', body);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data;
}

describe('Transaction change history on a temporary replica set', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_history_test'));
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection(); await model.createIndexes();
        }
    });
    after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

    it('captures legacy historical edits and deletion with actor, snapshots and exactly-once retries', async () => {
        const c = await client(), oldWallet = await wallet(c), newWallet = await wallet(c);
        // Existing rows need no migration or pre-existing audit to be safely revised.
        const original = await Transaction.create({ userId: c.userId, ...spending(oldWallet, 100) });
        const url = '/api/spending/' + original.id, editKey = crypto.randomUUID();
        const corrected = spending(newWallet, 250, {
            date: '2026-10-02', category: 'Health', desc: 'Corrected', fee: 7
        });
        const startedAt = Date.now();
        const edited = await c.send('put', url, corrected, editKey);
        assert.equal(edited.status, 200, JSON.stringify(edited.body));
        assert.deepEqual((await c.send('put', url, corrected, editKey)).body, edited.body);
        const history = await c.agent.get(url + '/history');
        assert.equal(history.status, 200, JSON.stringify(history.body));
        assert.match(history.headers['cache-control'], /no-store/);
        assert.equal(history.body.data.length, 1);
        const revision = history.body.data[0];
        assert.equal(revision.transactionId, original.id);
        assert.equal(revision.actorId, c.userId);
        assert.equal(revision.actorName, 'History test');
        assert.equal(revision.action, 'update');
        assert.ok(Date.parse(revision.occurredAt) >= startedAt && Date.parse(revision.occurredAt) <= Date.now());
        assert.deepEqual(revision.changedFields.sort(), ['amount', 'category', 'date', 'desc', 'fee', 'walletId']);
        assert.equal(revision.before.amount, 100);
        assert.equal(revision.before.category, 'Food');
        assert.equal(revision.before.date, '2025-12-28');
        assert.equal(revision.before.walletId, oldWallet);
        assert.equal(revision.after.amount, 250);
        assert.equal(revision.after.fee, 7);
        assert.equal(revision.after.date, '2026-10-02');
        assert.equal(revision.after.walletId, newWallet);
        assert.equal((await getAllWalletBalances(c.userId))[oldWallet], 1000);
        assert.equal((await getAllWalletBalances(c.userId))[newWallet], 743);

        const deleteKey = crypto.randomUUID();
        const deleted = await c.send('delete', url, undefined, deleteKey);
        assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
        assert.deepEqual((await c.send('delete', url, undefined, deleteKey)).body, deleted.body);
        assert.equal(await Transaction.countDocuments({ _id: original.id }), 0);
        const afterDelete = await c.agent.get(url + '/history');
        assert.equal(afterDelete.status, 200);
        assert.equal(afterDelete.body.data.length, 2);
        assert.equal(afterDelete.body.data[0].action, 'delete');
        assert.equal(afterDelete.body.data[0].after, null);
        assert.deepEqual(afterDelete.body.data[0].before, revision.after);
        assert.equal(afterDelete.body.data[1].id, revision.id);
        assert.equal(await TransactionRevision.countDocuments({ transactionId: original.id }), 2);
        assert.equal((await getAllWalletBalances(c.userId))[newWallet], 1000);
    });

    it('does not record creations or unchanged saves, but records note-only edits', async () => {
        const c = await client(), w = await wallet(c), body = spending(w, 100);
        const tx = await create(c, body), url = '/api/spending/' + tx.id;
        assert.equal(await TransactionRevision.countDocuments({ userId: c.userId }), 0);
        assert.equal((await c.send('put', url, body)).status, 200);
        assert.equal(await TransactionRevision.countDocuments({ userId: c.userId }), 0);
        assert.equal((await c.send('put', url, { ...body, desc: 'Correct note' })).status, 200);
        const history = await c.agent.get(url + '/history');
        assert.deepEqual(history.body.data[0].changedFields, ['desc']);
        assert.equal(history.body.data[0].before.desc, 'Original');
        assert.equal(history.body.data[0].after.desc, 'Correct note');
        assert.equal((await getAllWalletBalances(c.userId))[w], 900);
    });

    it('keeps live and deleted history private and validates identifiers and pagination', async () => {
        const owner = await client('Owner'), other = await client('Other'), w = await wallet(owner);
        const body = spending(w, 100), tx = await create(owner, body), url = '/api/spending/' + tx.id;
        assert.equal((await request(app).get(url + '/history')).status, 401);
        const empty = await owner.agent.get(url + '/history');
        assert.equal(empty.status, 200);
        assert.deepEqual(empty.body.data, []);
        assert.equal((await other.agent.get(url + '/history')).status, 404);
        assert.equal((await owner.send('put', url, { ...body, amount: 120 })).status, 200);
        assert.equal((await other.agent.get(url + '/history')).status, 404);
        assert.equal((await owner.send('delete', url)).status, 200);
        assert.equal((await owner.agent.get(url + '/history')).status, 200);
        assert.equal((await other.agent.get(url + '/history')).status, 404);
        assert.equal((await owner.agent.get('/api/spending/' + new mongoose.Types.ObjectId() + '/history')).status, 404);
        assert.equal((await owner.agent.get('/api/spending/not-an-id/history')).status, 400);
        for (const query of ['page=0', 'page=-1', 'page=1.5', 'page[]=1', 'limit=0', 'limit=abc', 'page=9007199254740991&limit=100']) {
            assert.equal((await owner.agent.get(url + '/history?' + query)).status, 400, query);
        }
        const page = await owner.agent.get(url + '/history?page=2&limit=1');
        assert.equal(page.status, 200, JSON.stringify(page.body));
        assert.equal(page.body.data[0].action, 'update');
        assert.deepEqual(page.body.pagination, { page: 2, limit: 1, total: 2, totalPages: 2 });
        const capped = await owner.agent.get(url + '/history?limit=1000');
        assert.equal(capped.body.pagination.limit, 100);
    });

    it('rolls back revisions, edits and receipts when a balance check rejects the change', async () => {
        const c = await client(), w = await wallet(c, 100), body = spending(w, 20);
        const tx = await create(c, body), editKey = crypto.randomUUID();
        const edit = await c.send('put', '/api/spending/' + tx.id, { ...body, amount: 200 }, editKey);
        assert.equal(edit.status, 409, JSON.stringify(edit.body));
        assert.equal((await Transaction.findById(tx.id)).amount, 20);
        assert.equal(await TransactionRevision.countDocuments({ userId: c.userId }), 0);
        assert.equal(await Receipt.countDocuments({ userId: c.userId, key: editKey }), 0);
        assert.equal((await getAllWalletBalances(c.userId))[w], 80);

        const zeroWallet = await wallet(c, 0);
        const income = await create(c, spending(zeroWallet, 100, { type: 'income' }));
        await create(c, spending(zeroWallet, 80));
        const deleteKey = crypto.randomUUID();
        const deleted = await c.send('delete', '/api/spending/' + income.id, undefined, deleteKey);
        assert.equal(deleted.status, 409, JSON.stringify(deleted.body));
        assert.ok(await Transaction.exists({ _id: income.id }));
        assert.equal(await TransactionRevision.countDocuments({ userId: c.userId }), 0);
        assert.equal(await Receipt.countDocuments({ userId: c.userId, key: deleteKey }), 0);
        assert.equal((await getAllWalletBalances(c.userId))[zeroWallet], 20);
    });

    it('rejects an edit atomically when its audit cannot be saved and accepts a safe retry', async () => {
        const c = await client(), w = await wallet(c), body = spending(w, 100);
        const tx = await create(c, body), key = crypto.randomUUID(), originalCreate = TransactionRevision.create;
        TransactionRevision.create = async function () { throw new Error('Injected audit storage failure'); };
        try {
            const response = await c.send('put', '/api/spending/' + tx.id, { ...body, amount: 150 }, key);
            assert.equal(response.status, 500);
        } finally { TransactionRevision.create = originalCreate; }
        assert.equal((await Transaction.findById(tx.id)).amount, 100);
        assert.equal(await TransactionRevision.countDocuments({ transactionId: tx.id }), 0);
        assert.equal(await Receipt.countDocuments({ userId: c.userId, key }), 0);
        const retry = await c.send('put', '/api/spending/' + tx.id, { ...body, amount: 150 }, key);
        assert.equal(retry.status, 200, JSON.stringify(retry.body));
        assert.equal(await TransactionRevision.countDocuments({ transactionId: tx.id }), 1);
    });

    it('a transient failure after audit insertion retries without duplicate revisions', async () => {
        const c = await client(), w = await wallet(c), body = spending(w, 100);
        const tx = await create(c, body), key = crypto.randomUUID(), originalCreate = TransactionRevision.create;
        let attempts = 0;
        TransactionRevision.create = async function (...args) {
            const result = await originalCreate.apply(this, args);
            if (++attempts === 1) {
                const error = new mongoose.mongo.MongoServerError({ message: 'Injected audit retry' });
                error.addErrorLabel('TransientTransactionError');
                throw error;
            }
            return result;
        };
        try {
            const response = await c.send('put', '/api/spending/' + tx.id, { ...body, amount: 150 }, key);
            assert.equal(response.status, 200, JSON.stringify(response.body));
        } finally { TransactionRevision.create = originalCreate; }
        assert.equal(attempts, 2);
        assert.equal((await Transaction.findById(tx.id)).amount, 150);
        assert.equal(await TransactionRevision.countDocuments({ transactionId: tx.id }), 1);
        assert.equal(await Receipt.countDocuments({ userId: c.userId, key }), 1);
        const revision = await TransactionRevision.findOne({ transactionId: tx.id });
        assert.equal(revision.before.amount, 100);
        assert.equal(revision.after.amount, 150);
    });

    it('exports and fully resets only the current account revision snapshots', async () => {
        const owner = await client('Export owner'), other = await client('Export other');
        const ow = await wallet(owner), fw = await wallet(other);
        const ownBody = spending(ow, 100), foreignBody = spending(fw, 200);
        const own = await create(owner, ownBody), foreign = await create(other, foreignBody);
        assert.equal((await owner.send('put', '/api/spending/' + own.id, { ...ownBody, amount: 150 })).status, 200);
        assert.equal((await other.send('put', '/api/spending/' + foreign.id, { ...foreignBody, amount: 250 })).status, 200);
        const exported = await owner.agent.get('/api/spending/export');
        assert.equal(exported.status, 200);
        assert.equal(exported.body.data.transactionRevisions.length, 1);
        assert.equal(exported.body.data.transactionRevisions[0].transactionId, own.id);
        assert.equal(exported.body.data.transactionRevisions[0].before.amount, 100);
        assert.ok(!exported.text.includes(foreign.id));
        assert.equal((await owner.send('post', '/api/spending/reset-data', {})).status, 200);
        assert.equal(await TransactionRevision.countDocuments({ userId: owner.userId }), 0);
        assert.equal(await Transaction.countDocuments({ userId: owner.userId }), 0);
        assert.equal((await owner.agent.get('/api/spending/' + own.id + '/history')).status, 404);
        assert.equal(await TransactionRevision.countDocuments({ userId: other.userId }), 1);
        assert.equal((await other.agent.get('/api/spending/' + foreign.id + '/history')).status, 200);
    });
});
