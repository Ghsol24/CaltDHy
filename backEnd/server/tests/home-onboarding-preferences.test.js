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
const { validPreferencesUpdate, preferenceUpdateFields } = require('../utils/cashFlowPreferences');
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
    const response = await c.send('post', 'register', { name: 'Onboarding Prefs User', email: c.email, password });
    assert.equal(response.status, 201);
    c.userId = response.body.user.id;
    c.response = response;
    return c;
}

describe('Home onboarding card preference', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_home_onboarding_prefs_test'));
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection();
            await model.createIndexes();
        }
    });
    after(async () => {
        await mongoose.disconnect();
        if (db) await db.stop();
    });

    it('validates homeOnboardingDismissed as a plain boolean in pure helpers', () => {
        for (const good of [true, false]) {
            assert.equal(validPreferencesUpdate({ homeOnboardingDismissed: good }), true, String(good));
        }
        for (const bad of ['true', 1, 0, null, {}, [], undefined]) {
            assert.equal(validPreferencesUpdate({ homeOnboardingDismissed: bad }), false, JSON.stringify(bad));
        }
        // Đi kèm một khoá hợp lệ khác vẫn được; khoá lạ thì cả gói bị từ chối.
        assert.equal(validPreferencesUpdate({ homeOnboardingDismissed: true, sidebarPinnedGroups: ['group_plan'] }), true);
        assert.equal(validPreferencesUpdate({ homeOnboardingDismissed: true, onboardingStep: 2 }), false);

        assert.equal(publicPreferences({}).homeOnboardingDismissed, false);
        assert.equal(publicPreferences(undefined).homeOnboardingDismissed, false);
        assert.equal(publicPreferences({ homeOnboardingDismissed: 'yes' }).homeOnboardingDismissed, false);
        assert.equal(publicPreferences({ homeOnboardingDismissed: true }).homeOnboardingDismissed, true);

        assert.deepEqual(
            preferenceUpdateFields({ homeOnboardingDismissed: true }, { analyticsExcludeRecurring: true }),
            { 'preferences.homeOnboardingDismissed': true }
        );
    });

    it('persists the dismissal per account without touching other preferences', async () => {
        const owner = await account();
        const other = await account();
        assert.equal(owner.response.body.user.preferences.homeOnboardingDismissed, false);

        // Tài khoản cũ chưa có trường này vẫn trả về false.
        await User.updateOne({ _id: owner.userId }, { $unset: { 'preferences.homeOnboardingDismissed': '' } });
        assert.equal((await owner.agent.get('/api/auth/session')).body.user.preferences.homeOnboardingDismissed, false);

        assert.equal((await owner.send('put', 'preferences', {
            sidebarPinnedGroups: ['group_jars'],
            notifications: { dueEmail: true }
        })).status, 200);

        const hideRes = await owner.send('put', 'preferences', { homeOnboardingDismissed: true });
        assert.equal(hideRes.status, 200);
        assert.equal(hideRes.body.preferences.homeOnboardingDismissed, true);
        assert.deepEqual(hideRes.body.preferences.sidebarPinnedGroups, ['group_jars']);
        assert.equal(hideRes.body.preferences.notifications.dueEmail, true);

        for (const invalid of ['true', 1, null, {}]) {
            assert.equal((await owner.send('put', 'preferences', { homeOnboardingDismissed: invalid })).status, 400);
        }

        // Giữ nguyên sau khi đăng xuất/đăng nhập lại; tài khoản khác không bị ảnh hưởng.
        assert.equal((await owner.send('post', 'logout', {})).status, 200);
        const relogin = await (await anonymous()).send('post', 'login', { email: owner.email, password });
        assert.equal(relogin.status, 200);
        assert.equal(relogin.body.user.preferences.homeOnboardingDismissed, true);
        assert.equal((await other.agent.get('/api/auth/session')).body.user.preferences.homeOnboardingDismissed, false);

        // Bật lại được (false) nếu sau này có chỗ cho hiện lại thẻ.
        const login = await anonymous();
        assert.equal((await login.send('post', 'login', { email: owner.email, password })).status, 200);
        const showRes = await login.send('put', 'preferences', { homeOnboardingDismissed: false });
        assert.equal(showRes.status, 200);
        assert.equal(showRes.body.preferences.homeOnboardingDismissed, false);
    });
});
