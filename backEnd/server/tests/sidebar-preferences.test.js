'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.HOST = '127.0.0.1';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '1h';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_RATE_LIMIT_MAX = '100000';
for (const key of ['MONGODB_URI', 'GMAIL_USER', 'GMAIL_PASS', 'BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_PROVIDER', 'CORS_WHITELIST', 'CLIENT_URL', 'COOKIE_SECURE']) {
    delete process.env[key];
}

const app = require('../server');
const User = require('../models/User');
const {
    SIDEBAR_GROUP_IDS,
    publicSidebarPinnedGroups,
    validPreferencesUpdate,
    preferenceUpdateFields
} = require('../utils/cashFlowPreferences');
const { publicPreferences } = require('../utils/publicUser');

const password = 'Synthetic-password-1234';

async function anonymous() {
    const agent = request.agent(app);
    let csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
    return {
        agent,
        async send(method, path, body) {
            const response = await agent[method]('/api/auth/' + path).set('X-CSRF-Token', csrf).send(body);
            if (response.body.csrfToken) csrf = response.body.csrfToken;
            return response;
        }
    };
}

async function account() {
    const c = await anonymous();
    c.email = crypto.randomUUID() + '@example.test';
    const response = await c.send('post', 'register', { name: 'Sidebar Prefs User', email: c.email, password });
    assert.equal(response.status, 201);
    c.userId = response.body.user.id;
    c.response = response;
    return c;
}

describe('Sidebar pinned group preferences', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_sidebar_prefs_test'));
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection();
            await model.createIndexes();
        }
    });
    after(async () => {
        await mongoose.disconnect();
        if (db) await db.stop();
    });

    it('validates and normalizes sidebarPinnedGroups in pure helpers', () => {
        assert.deepEqual(SIDEBAR_GROUP_IDS, ['group_plan', 'group_analytics', 'group_jars']);

        for (const good of [
            [],
            ['group_plan'],
            ['group_jars', 'group_plan'],
            ['group_jars', 'group_analytics', 'group_plan']
        ]) {
            assert.equal(validPreferencesUpdate({ sidebarPinnedGroups: good }), true, JSON.stringify(good));
        }

        for (const bad of [
            ['group_home'],
            ['unknown'],
            ['group_plan', 'group_plan'],
            ['group_plan', 'group_analytics', 'group_jars', 'group_plan'],
            ['group_plan', 'group_analytics', 'group_jars', 'extra'],
            null,
            true,
            'group_plan',
            { 0: 'group_plan' },
            [123],
            [null],
            [{}]
        ]) {
            assert.equal(validPreferencesUpdate({ sidebarPinnedGroups: bad }), false, JSON.stringify(bad));
        }

        assert.deepEqual(publicPreferences({}).sidebarPinnedGroups, []);
        assert.deepEqual(publicPreferences(undefined).sidebarPinnedGroups, []);
        assert.deepEqual(publicSidebarPinnedGroups('not-an-array'), []);
        assert.deepEqual(
            publicSidebarPinnedGroups(['group_jars', 'bad', 42, 'group_plan', 'group_jars']),
            ['group_plan', 'group_jars']
        );

        const existing = {
            analyticsExcludeRecurring: true,
            cashFlow: {
                lastUsed: { mode: '3months', series: 'both', excludeRecurring: true },
                pinnedDefault: null
            },
            notifications: { dueEmail: true, locale: 'en' }
        };
        assert.deepEqual(
            preferenceUpdateFields({ sidebarPinnedGroups: ['group_jars', 'group_plan'] }, existing),
            { 'preferences.sidebarPinnedGroups': ['group_plan', 'group_jars'] }
        );
    });

    it('persists sidebarPinnedGroups per account without touching cashFlow or notifications', async () => {
        const owner = await account();
        const other = await account();
        assert.deepEqual(owner.response.body.user.preferences.sidebarPinnedGroups, []);

        // Legacy account missing the field still normalizes to [].
        await User.updateOne({ _id: owner.userId }, { $unset: { 'preferences.sidebarPinnedGroups': '' } });
        assert.deepEqual((await owner.agent.get('/api/auth/session')).body.user.preferences.sidebarPinnedGroups, []);

        const view = { mode: '6months', series: 'both', excludeRecurring: true };
        assert.equal((await owner.send('put', 'preferences', {
            cashFlow: { lastUsed: view, pinnedDefault: view },
            notifications: { dueEmail: true, locale: 'en' }
        })).status, 200);

        const pinRes = await owner.send('put', 'preferences', {
            sidebarPinnedGroups: ['group_jars', 'group_analytics']
        });
        assert.equal(pinRes.status, 200);
        assert.deepEqual(pinRes.body.preferences.sidebarPinnedGroups, ['group_analytics', 'group_jars']);
        assert.deepEqual(pinRes.body.preferences.cashFlow, { lastUsed: view, pinnedDefault: view });
        assert.equal(pinRes.body.preferences.notifications.dueEmail, true);
        assert.equal(pinRes.body.preferences.notifications.locale, 'en');

        // Reject invalid payloads with 400 and leave stored preferences untouched.
        for (const invalid of [
            ['group_home'],
            ['group_plan', 'group_plan'],
            'group_plan',
            [1]
        ]) {
            assert.equal((await owner.send('put', 'preferences', { sidebarPinnedGroups: invalid })).status, 400);
        }

        // Survives logout + login, while the second account remains isolated.
        assert.equal((await owner.send('post', 'logout', {})).status, 200);
        const relogin = await (await anonymous()).send('post', 'login', { email: owner.email, password });
        assert.equal(relogin.status, 200);
        assert.deepEqual(relogin.body.user.preferences.sidebarPinnedGroups, ['group_analytics', 'group_jars']);
        assert.deepEqual((await other.agent.get('/api/auth/session')).body.user.preferences.sidebarPinnedGroups, []);
    });

    it('starts reminder emails in the language chosen at sign-up, falling back to vi', async () => {
        for (const [locale, expected] of [['en', 'en'], ['zh-CN', 'zh-CN'], ['fr', 'vi'], [undefined, 'vi']]) {
            const c = await anonymous();
            const email = crypto.randomUUID() + '@example.test';
            const response = await c.send('post', 'register', { name: 'Locale User', email, password, locale });
            assert.equal(response.status, 201);
            const stored = await User.findById(response.body.user.id).lean();
            assert.equal(stored.preferences.notifications.locale, expected, String(locale));
        }
    });
});
