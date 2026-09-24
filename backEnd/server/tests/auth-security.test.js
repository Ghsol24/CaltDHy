'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const nodemailer = require('nodemailer');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.HOST = '127.0.0.1';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '1h';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_RATE_LIMIT_MAX = '100000';
for (const key of ['MONGODB_URI', 'GMAIL_USER', 'GMAIL_PASS', 'BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_PROVIDER', 'CORS_WHITELIST', 'CLIENT_URL', 'COOKIE_SECURE']) delete process.env[key];
const app = require('../server');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const security = require('../utils/sessionSecurity');
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
    const response = await c.send('post', 'register', { name: 'Synthetic <name>', email: c.email, password });
    assert.equal(response.status, 201);
    c.userId = response.body.user.id;
    return c;
}

describe('Account security regressions', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_auth_test'));
        for (const model of Object.values(mongoose.models)) {
            await model.createCollection(); await model.createIndexes();
        }
    });
    after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

    it('rejects mailbox lists/comments and bcrypt truncation instead of accepting ambiguous credentials', async () => {
        const c = await anonymous();
        for (const email of ['a,b@example.test', 'a(comment)@example.test', 'a@-example.test', 'a..b@example.test']) {
            assert.equal((await c.send('post', 'register', { name: 'Test', email, password })).status, 400);
        }
        const email = crypto.randomUUID() + '@example.test';
        assert.equal((await c.send('post', 'register', { name: 'Test', email, password: 'é'.repeat(37) })).status, 400);
        assert.equal(await User.countDocuments({ email }), 0);
    });

    it('changing sensitive profile fields requires the current password and revokes other sessions', async () => {
        const c = await account(), second = await anonymous();
        assert.equal((await second.send('post', 'login', { email: c.email, password })).status, 200);
        const email = crypto.randomUUID() + '@example.test';
        assert.equal((await c.send('put', 'profile', { email })).status, 400);
        assert.equal((await User.findById(c.userId)).email, c.email);
        const changed = await c.send('put', 'profile', { email, currentPassword: password, newPassword: password + '-new' });
        assert.equal(changed.status, 200);
        assert.equal(changed.body.user.emailVerified, false);
        assert.equal((await c.agent.get('/api/auth/session')).status, 200);
        assert.equal((await second.agent.get('/api/auth/session')).status, 401);
        const fresh = await anonymous();
        assert.equal((await fresh.send('post', 'login', { email, password })).status, 401);
        assert.equal((await fresh.send('post', 'login', { email, password: password + '-new' })).status, 200);
    });

    it('allows harmless avatar presets but refuses SVG and script URLs', async () => {
        const c = await account();
        assert.equal((await c.send('put', 'profile', { avatar: '💼' })).status, 200);
        for (const avatar of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=']) {
            assert.equal((await c.send('put', 'profile', { avatar })).status, 400);
        }
        assert.equal((await User.findById(c.userId)).avatar, '💼');
    });

    it('mail transport receives only an escaped trusted link; verification token is hashed and single-use', async () => {
        const c = await account();
        const original = nodemailer.createTransport;
        let mail, options;
        process.env.CLIENT_URL = 'http://127.0.0.1:24127';
        process.env.GMAIL_USER = 'sender@example.test';
        process.env.GMAIL_PASS = 'synthetic-mail-secret';
        nodemailer.createTransport = configuration => {
            options = configuration;
            return { async sendMail(message) { mail = message; } };
        };
        try {
            const response = await c.send('post', 'resend-verification', { email: c.email });
            assert.equal(response.status, 200);
            assert.equal(options.disableFileAccess, true); assert.equal(options.disableUrlAccess, true);
            assert.equal(options.logger, false); assert.equal(options.debug, false);
            assert.equal(mail.to, c.email);
            assert.ok(mail.html.includes('Synthetic &lt;name&gt;'));
            const url = new URL(/href="([^"]+)"/.exec(mail.html)[1].replaceAll('&amp;', '&'));
            assert.equal(url.origin, 'http://127.0.0.1:24127');
            assert.equal(url.pathname, '/verify-email');
            const token = url.searchParams.get('token');
            assert.equal(response.text.includes(token), false);
            const stored = await User.findById(c.userId).select('+emailVerificationToken');
            assert.equal(stored.emailVerificationToken, crypto.createHash('sha256').update(token).digest('hex'));
            // Restore HTTP test cookie configuration before sending another request.
            delete process.env.CLIENT_URL;
            assert.equal((await c.send('post', 'verify-email', { email: c.email, token })).status, 200);
            assert.equal((await c.send('post', 'verify-email', { email: c.email, token })).status, 400);
            assert.equal((await User.findById(c.userId)).emailVerified, true);
        } finally {
            nodemailer.createTransport = original;
            for (const key of ['CLIENT_URL', 'COOKIE_SECURE', 'GMAIL_USER', 'GMAIL_PASS']) delete process.env[key];
        }
    });

    it('mail failure neither logs credentials nor leaves a valid undelivered reset token', async () => {
        const c = await account();
        const transport = nodemailer.createTransport, log = console.error;
        const logs = [];
        process.env.CLIENT_URL = 'http://127.0.0.1:24127';
        process.env.GMAIL_USER = 'sender@example.test'; process.env.GMAIL_PASS = 'SENSITIVE_SENTINEL';
        nodemailer.createTransport = () => ({ async sendMail() { throw new Error('SENSITIVE_SENTINEL'); } });
        console.error = (...args) => logs.push(args.join(' '));
        try {
            const response = await c.send('post', 'forgot-password', { email: c.email });
            const unknown = await c.send('post', 'forgot-password', { email: 'unknown@example.test' });
            assert.deepEqual(response.body, unknown.body);
            const stored = await User.findById(c.userId).select('+resetPasswordToken +resetPasswordExpiry');
            assert.equal(stored.resetPasswordToken, undefined); assert.equal(stored.resetPasswordExpiry, undefined);
            assert.ok(logs.length > 0);
            assert.equal(logs.join('\n').includes('SENSITIVE_SENTINEL'), false);
        } finally {
            nodemailer.createTransport = transport; console.error = log;
            for (const key of ['CLIENT_URL', 'GMAIL_USER', 'GMAIL_PASS']) delete process.env[key];
        }
    });

    it('sends reset links through the HTTPS email API and consumes the token once', async () => {
        const c = await account();
        const originalFetch = global.fetch;
        let endpoint, options;
        process.env.CLIENT_URL = 'http://127.0.0.1:24127';
        process.env.EMAIL_PROVIDER = 'brevo';
        process.env.BREVO_API_KEY = 'SYNTHETIC_API_KEY';
        process.env.EMAIL_FROM = 'sender@example.test';
        global.fetch = async (url, requestOptions) => {
            endpoint = url; options = requestOptions;
            return { ok: true, status: 201 };
        };
        try {
            const response = await c.send('post', 'forgot-password', { email: c.email });
            assert.equal(response.status, 200);
            assert.equal(endpoint, 'https://api.brevo.com/v3/smtp/email');
            assert.equal(options.method, 'POST');
            assert.equal(options.headers['api-key'], 'SYNTHETIC_API_KEY');
            const mail = JSON.parse(options.body);
            assert.deepEqual(mail.to, [{ email: c.email }]);
            assert.equal(mail.sender.email, 'sender@example.test');
            assert.ok(mail.htmlContent.includes('Synthetic &lt;name&gt;'));
            const link = new URL(/href="([^"]+)"/.exec(mail.htmlContent)[1].replaceAll('&amp;', '&'));
            assert.equal(link.pathname, '/reset-password');
            assert.equal(mail.textContent.includes(link.toString()), true);
            const token = link.searchParams.get('token');
            assert.equal(response.text.includes(token), false);
            const stored = await User.findById(c.userId).select('+resetPasswordToken');
            assert.equal(stored.resetPasswordToken, crypto.createHash('sha256').update(token).digest('hex'));
            assert.equal((await c.send('post', 'reset-password', {
                email: c.email, token, newPassword: password + '-new'
            })).status, 200);
            assert.equal((await c.send('post', 'reset-password', {
                email: c.email, token, newPassword: password + '-again'
            })).status, 400);
        } finally {
            global.fetch = originalFetch;
            for (const key of ['CLIENT_URL', 'EMAIL_PROVIDER', 'BREVO_API_KEY', 'EMAIL_FROM']) delete process.env[key];
        }
    });

    it('HTTPS email rejection keeps responses private and removes an undelivered token', async () => {
        const c = await account();
        const originalFetch = global.fetch, originalLog = console.error;
        const logs = [];
        process.env.CLIENT_URL = 'http://127.0.0.1:24127';
        process.env.EMAIL_PROVIDER = 'brevo';
        process.env.BREVO_API_KEY = 'SENSITIVE_API_KEY';
        process.env.EMAIL_FROM = 'sender@example.test';
        global.fetch = async () => ({ ok: false, status: 401 });
        console.error = (...args) => logs.push(args.join(' '));
        try {
            const response = await c.send('post', 'forgot-password', { email: c.email });
            const unknown = await c.send('post', 'forgot-password', { email: 'unknown@example.test' });
            assert.equal(response.status, 200);
            assert.deepEqual(response.body, unknown.body);
            const stored = await User.findById(c.userId).select('+resetPasswordToken +resetPasswordExpiry');
            assert.equal(stored.resetPasswordToken, undefined);
            assert.equal(stored.resetPasswordExpiry, undefined);
            assert.ok(logs.some(entry => entry.includes('email_delivery_failed')));
            assert.equal(logs.join('\n').includes('SENSITIVE_API_KEY'), false);
        } finally {
            global.fetch = originalFetch; console.error = originalLog;
            for (const key of ['CLIENT_URL', 'EMAIL_PROVIDER', 'BREVO_API_KEY', 'EMAIL_FROM']) delete process.env[key];
        }
    });

    it('does not advertise email recovery when the selected provider is incomplete', async () => {
        const c = await anonymous();
        process.env.CLIENT_URL = 'http://127.0.0.1:24127';
        process.env.EMAIL_PROVIDER = 'brevo';
        process.env.BREVO_API_KEY = 'SYNTHETIC_API_KEY';
        try {
            const response = await c.send('post', 'forgot-password', { email: 'unknown@example.test' });
            assert.equal(response.status, 503);
            assert.equal(response.body.success, false);
        } finally {
            for (const key of ['CLIENT_URL', 'EMAIL_PROVIDER', 'BREVO_API_KEY']) delete process.env[key];
        }
    });

    it('rotating the session key invalidates copied cookies immediately', async () => {
        const c = await account();
        assert.equal(await AuthSession.countDocuments({ userId: c.userId }), 1);
        const previous = process.env.JWT_SECRET;
        process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
        try { assert.equal((await c.agent.get('/api/auth/session')).status, 401); }
        finally { process.env.JWT_SECRET = previous; }
    });

    it('HTTPS mode uses host-only Secure HttpOnly cookies even on a loopback upstream', () => {
        process.env.CLIENT_URL = 'https://app.example.test';
        process.env.COOKIE_SECURE = 'false'; // Cannot weaken an HTTPS deployment.
        const cookies = [];
        try {
            security.setSession({ headers: {} }, { cookie: (...args) => cookies.push(args) }, {
                token: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 60000)
            });
            assert.equal(cookies.length, 2);
            for (const [name, , options] of cookies) {
                assert.ok(name.startsWith('__Host-')); assert.equal(options.secure, true);
                assert.equal(options.httpOnly, true); assert.equal(options.sameSite, 'strict');
                assert.equal(options.path, '/'); assert.equal(options.domain, undefined);
            }
        } finally { delete process.env.CLIENT_URL; delete process.env.COOKIE_SECURE; }
    });
});
