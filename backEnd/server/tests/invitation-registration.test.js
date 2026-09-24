'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.REGISTRATION_MODE = 'invite';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.API_RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
const app = require('../server');
const Invitation = require('../models/Invitation');
const User = require('../models/User');

function invitation(email, expired = false) {
    const token = crypto.randomBytes(32).toString('hex');
    return Invitation.create({
        email,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + (expired ? -1 : 7) * 86400000)
    }).then(() => token);
}

async function client() {
    const agent = request.agent(app);
    let csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
    return {
        registration: () => agent.get('/api/auth/registration'),
        register: (email, inviteToken) => agent.post('/api/auth/register')
            .set('X-CSRF-Token', csrf).send({
                name: 'Invited Friend', email, password: 'A-secure-password-123', inviteToken
            }).then(response => {
                if (response.body.csrfToken) csrf = response.body.csrfToken;
                return response;
            })
    };
}

describe('Invite-only registration', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_invite_test'));
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection(); await model.createIndexes();
        }
    });
    after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

    it('requires a valid invite bound to the email and consumes it once', async () => {
        const c = await client();
        assert.equal((await c.registration()).body.inviteOnly, true);
        const email = crypto.randomUUID() + '@example.test';
        const wrongEmail = crypto.randomUUID() + '@example.test';
        const token = await invitation(email);
        assert.equal((await c.register(email)).status, 403);
        assert.equal((await c.register(wrongEmail, token)).status, 403);
        assert.equal(await User.countDocuments({ email }), 0);
        const created = await c.register(email, token);
        assert.equal(created.status, 201);
        assert.equal(created.body.user.email, email);
        assert.equal((await c.register(email, token)).status, 403);
        assert.equal(await User.countDocuments({ email }), 1);
        assert.ok((await Invitation.findOne({ email })).usedAt);
    });

    it('rejects expired invites and rolls back consumption when account creation fails', async () => {
        const c = await client();
        const expiredEmail = crypto.randomUUID() + '@example.test';
        const expired = await invitation(expiredEmail, true);
        assert.equal((await c.register(expiredEmail, expired)).status, 403);
        const existing = crypto.randomUUID() + '@example.test';
        const first = await invitation(existing);
        assert.equal((await c.register(existing, first)).status, 201);
        const second = await invitation(existing);
        assert.equal((await c.register(existing, second)).status, 409);
        const hash = crypto.createHash('sha256').update(second).digest('hex');
        assert.equal((await Invitation.findOne({ tokenHash: hash })).usedAt, null);
    });
});
