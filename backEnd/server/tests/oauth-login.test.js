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
for (const key of ['MONGODB_URI', 'CORS_WHITELIST', 'COOKIE_SECURE', 'REGISTRATION_MODE']) delete process.env[key];
process.env.CLIENT_URL = 'http://127.0.0.1:24127';
process.env.GOOGLE_CLIENT_ID = 'synthetic-google-client';
process.env.GOOGLE_CLIENT_SECRET = 'synthetic-google-secret';
process.env.FACEBOOK_APP_ID = '1000000000000001';
process.env.FACEBOOK_APP_SECRET = 'synthetic-facebook-secret';
const app = require('../server');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Invitation = require('../models/Invitation');
const AuthSession = require('../models/AuthSession');
const totp = require('../utils/totp');
const password = 'Synthetic-password-1234';
const newEmail = () => crypto.randomUUID() + '@example.test';
const newSub = () => '1' + String(crypto.randomInt(10 ** 12)).padStart(12, '0') + String(crypto.randomInt(10 ** 8)).padStart(8, '0');

// The provider side of the exchange. `next` is what the fake provider will say about whoever "signed in".
let next = null;
const providerCalls = [];
const realFetch = global.fetch;
const json = (body, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
global.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    providerCalls.push({ host: url.host, path: url.pathname, body: String(options.body || ''), search: url.search });
    if (!next || next.fail) return json({ error: 'invalid_grant' }, false);
    if (url.host === 'oauth2.googleapis.com') {
        const claims = { iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID,
            exp: Math.floor(Date.now() / 1000) + 300, nonce: next.nonce, sub: next.sub, email: next.email,
            email_verified: next.emailVerified !== false, name: next.name, ...next.claims };
        return json({ id_token: ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.') });
    }
    if (url.host === 'graph.facebook.com' && url.pathname.endsWith('/oauth/access_token')) return json({ access_token: 'synthetic-access-token' });
    if (url.host === 'graph.facebook.com' && url.pathname.endsWith('/me')) {
        return json({ id: next.sub, name: next.name, ...(next.email ? { email: next.email } : {}) });
    }
    throw new Error('Unexpected outbound request in test.');
};

async function browser() {
    const agent = request.agent(app);
    let csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
    const c = {
        agent,
        async send(method, path, body) {
            let response = await agent[method]('/api/auth/' + path).set('X-CSRF-Token', csrf).send(body);
            // Like the real client: a rejected session check clears the CSRF cookie, so fetch a new token once.
            if (response.body.code === 'CSRF_INVALID') {
                csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
                response = await agent[method]('/api/auth/' + path).set('X-CSRF-Token', csrf).send(body);
            }
            if (response.body.csrfToken) csrf = response.body.csrfToken;
            return response;
        },
        // Clicks "Continue with <provider>", signs in at the provider as `identity`, and follows the redirect back.
        async social(provider, identity, { invite, state } = {}) {
            const start = await agent.get('/api/auth/oauth/' + provider + '/start' + (invite ? '?invite=' + invite : ''));
            assert.equal(start.status, 303);
            const target = new URL(start.headers.location);
            next = { ...identity, nonce: target.searchParams.get('nonce') };
            const back = await agent.get('/api/auth/oauth/' + provider + '/callback')
                .query({ code: 'synthetic-code', state: state || target.searchParams.get('state') });
            assert.equal(back.status, 303);
            csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
            return { target, location: back.headers.location };
        },
        // Settings > Data & privacy > Link: confirm the password, visit the provider as `identity`, come back.
        async link(provider, identity, body = {}) {
            const started = await c.send('post', 'oauth/' + provider + '/link', body);
            if (started.status !== 200) return { started };
            const target = new URL(started.body.url);
            next = { ...identity, nonce: target.searchParams.get('nonce') };
            const back = await agent.get('/api/auth/oauth/' + provider + '/callback')
                .query({ code: 'synthetic-code', state: target.searchParams.get('state') });
            assert.equal(back.status, 303);
            return { started, target, location: back.headers.location };
        },
        session: () => agent.get('/api/auth/session')
    };
    return c;
}
async function passwordAccount(email = newEmail()) {
    const c = await browser();
    const response = await c.send('post', 'register', { name: 'Existing Owner', email, password });
    assert.equal(response.status, 201);
    return { c, email, id: response.body.user.id };
}

describe('Google / Facebook sign-in', { concurrency: false }, () => {
    let db;
    before(async () => {
        db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
        await mongoose.connect(db.getUri('caltdhy_oauth_test'));
        for (const model of Object.values(mongoose.models)) { await model.createCollection(); await model.createIndexes(); }
    });
    after(async () => { global.fetch = realFetch; await mongoose.disconnect(); if (db) await db.stop(); });

    it('only offers providers that are fully configured, and tells the page which origin they return to', async () => {
        const listed = await request(app).get('/api/auth/oauth/providers');
        assert.deepEqual(listed.body, { success: true, providers: ['google', 'facebook'], origin: 'http://127.0.0.1:24127' });
        const secret = process.env.FACEBOOK_APP_SECRET;
        delete process.env.FACEBOOK_APP_SECRET;
        try {
            assert.deepEqual((await request(app).get('/api/auth/oauth/providers')).body.providers, ['google']);
            const start = await request(app).get('/api/auth/oauth/facebook/start');
            assert.deepEqual([start.status, start.headers.location], [303, '/login?oauth_error=unavailable']);
        } finally { process.env.FACEBOOK_APP_SECRET = secret; }
        assert.equal((await request(app).get('/api/auth/oauth/github/start')).headers.location, '/login?oauth_error=unavailable');
    });

    it('sends the browser to the provider with state, nonce and PKCE, and never puts a secret in the URL', async () => {
        const c = await browser();
        const start = await c.agent.get('/api/auth/oauth/google/start');
        const target = new URL(start.headers.location);
        assert.equal(target.origin + target.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
        assert.equal(target.searchParams.get('redirect_uri'), 'http://127.0.0.1:24127/api/auth/oauth/google/callback');
        assert.match(target.searchParams.get('state'), /^[a-f0-9]{64}$/);
        assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
        assert.ok(!start.headers.location.includes('synthetic-google-secret'));
        const cookie = start.headers['set-cookie'].find(value => value.startsWith('caltdhy_oauth_attempt='));
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /SameSite=Lax/i);
        const facebook = new URL((await c.agent.get('/api/auth/oauth/facebook/start')).headers.location);
        assert.equal(facebook.host, 'www.facebook.com');
        assert.equal(facebook.searchParams.get('scope'), 'email,public_profile');
    });

    it('rejects a callback whose state does not match this browser, without contacting the provider', async () => {
        const c = await browser(), email = newEmail();
        const calls = providerCalls.length;
        const forged = await c.social('google', { sub: newSub(), email, name: 'Mallory' }, { state: 'a'.repeat(64) });
        assert.equal(forged.location, '/login?oauth_error=failed');
        // A callback with no prior start (login CSRF) is refused too.
        const cold = await request(app).get('/api/auth/oauth/google/callback').query({ code: 'x', state: 'b'.repeat(64) });
        assert.equal(cold.headers.location, '/login?oauth_error=failed');
        assert.equal(providerCalls.length, calls);
        assert.equal(await User.countDocuments({ email }), 0);
        assert.equal((await c.session()).status, 401);
        const cancelled = await c.agent.get('/api/auth/oauth/google/callback').query({ error: 'access_denied' });
        assert.equal(cancelled.headers.location, '/login?oauth_error=cancelled');
    });

    it('creates a passwordless account for a new Google user and signs the same person in next time', async () => {
        const c = await browser(), email = newEmail(), sub = newSub();
        const first = await c.social('google', { sub, email: email.toUpperCase(), name: 'New Person' });
        assert.equal(first.location, '/login?oauth=done');
        const exchange = providerCalls.at(-1);
        assert.match(exchange.body, /code_verifier=/);
        assert.match(exchange.body, /client_secret=synthetic-google-secret/);
        const session = await c.session();
        assert.equal(session.status, 200);
        assert.deepEqual([session.body.user.email, session.body.user.name, session.body.user.emailVerified,
            session.body.user.hasPassword, session.body.user.linkedProviders], [email, 'New Person', true, false, ['google']]);
        assert.ok(!JSON.stringify(session.body).includes(sub));
        const stored = await User.findOne({ email }).select('+password +oauth.googleId').lean();
        assert.equal(stored.password, undefined);
        assert.equal(stored.oauth.googleId, sub);
        assert.equal(await Wallet.countDocuments({ userId: stored._id, isDefault: true }), 1);

        const again = await browser();
        assert.equal((await again.social('google', { sub, email, name: 'Renamed At Google' })).location, '/login?oauth=done');
        assert.equal((await again.session()).body.user.id, session.body.user.id);
        assert.equal(await User.countDocuments({ email }), 1);
    });

    it('treats a passwordless account safely everywhere a password used to be assumed', async () => {
        const c = await browser(), email = newEmail();
        await c.social('google', { sub: newSub(), email, name: 'No Password' });
        const fresh = await browser();
        // Password sign-in fails like any wrong password: no crash and no hint that the email uses Google.
        const login = await fresh.send('post', 'login', { email, password: 'whatever-password-123' });
        assert.deepEqual([login.status, login.body.message], [401, 'Email hoặc mật khẩu không đúng.']);
        for (const [method, path, body] of [
            ['put', 'profile', { email: newEmail(), currentPassword: 'anything' }],
            ['put', 'profile', { newPassword: password }],
            ['post', '2fa/setup', { currentPassword: 'anything' }],
            ['post', '2fa/disable', { currentPassword: 'anything' }]]) {
            const response = await c.send(method, path, body);
            assert.deepEqual([response.status, response.body.code], [400, 'PASSWORD_NOT_SET'], path);
        }
        assert.equal((await c.send('put', 'profile', { name: 'Renamed' })).body.user.name, 'Renamed');
        assert.equal((await User.findOne({ email }).select('+password').lean()).password, undefined);

        // The existing emailed reset link is how such an account gets its first password.
        const token = crypto.randomBytes(32).toString('hex');
        await User.updateOne({ email }, { $set: { resetPasswordExpiry: new Date(Date.now() + 60000),
            resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex') } });
        assert.equal((await fresh.send('post', 'reset-password', { token, email, newPassword: password })).status, 200);
        const withPassword = await fresh.send('post', 'login', { email, password });
        assert.deepEqual([withPassword.status, withPassword.body.user.hasPassword, withPassword.body.user.linkedProviders], [200, true, ['google']]);
    });

    it('never merges into an existing password account until that account password is entered', async () => {
        const owner = await passwordAccount(), sub = newSub();
        const sessionsBefore = await AuthSession.countDocuments({ userId: owner.id });
        const c = await browser();
        const back = await c.social('google', { sub, email: owner.email, name: 'Same Email' });
        assert.equal(back.location, '/login?oauth=link');
        // Nothing has changed and nobody is signed in yet.
        assert.equal((await c.session()).status, 401);
        assert.equal(await AuthSession.countDocuments({ userId: owner.id }), sessionsBefore);
        assert.equal((await User.findById(owner.id).select('+oauth.googleId').lean()).oauth?.googleId, undefined);
        assert.equal(await User.countDocuments({ email: owner.email }), 1);
        assert.deepEqual((await c.agent.get('/api/auth/oauth/pending')).body.pending, { kind: 'link', provider: 'google', email: owner.email });

        for (const body of [{}, { password: '' }, { password: 'wrong-password-1234' }, { password: { $ne: null } }]) {
            const refused = await c.send('post', 'oauth/complete', body);
            assert.deepEqual([refused.status, refused.body.code], [401, 'OAUTH_PASSWORD_INVALID']);
        }
        assert.equal((await User.findById(owner.id).select('+oauth.googleId').lean()).oauth?.googleId, undefined);
        assert.equal((await c.session()).status, 401);

        const linked = await c.send('post', 'oauth/complete', { password });
        assert.equal(linked.status, 200, JSON.stringify(linked.body));
        assert.deepEqual([linked.body.user.id, linked.body.user.hasPassword, linked.body.user.linkedProviders, linked.body.user.emailVerified],
            [owner.id, true, ['google'], true]);
        assert.equal((await c.session()).status, 200);
        assert.equal((await c.send('put', 'preferences', { analyticsExcludeRecurring: true })).status, 200);
        assert.equal((await c.agent.get('/api/auth/oauth/pending')).body.pending, null);
        // The spent ticket cannot be replayed, and the password still works as before.
        assert.equal((await c.send('post', 'oauth/complete', { password })).body.code, 'OAUTH_EXPIRED');
        assert.equal((await (await browser()).send('post', 'login', { email: owner.email, password })).status, 200);

        const later = await browser();
        assert.equal((await later.social('google', { sub, email: owner.email, name: 'Same Email' })).location, '/login?oauth=done');
        assert.equal((await later.session()).body.user.id, owner.id);
    });

    it('lets the person back out of linking, and refuses forged or stale link tickets', async () => {
        const owner = await passwordAccount();
        const c = await browser();
        await c.social('facebook', { sub: newSub(), email: owner.email, name: 'Same Email' });
        assert.equal((await c.agent.get('/api/auth/oauth/pending')).body.pending.provider, 'facebook');
        assert.equal((await c.send('post', 'oauth/cancel', {})).status, 200);
        assert.equal((await c.agent.get('/api/auth/oauth/pending')).body.pending, null);
        assert.equal((await c.send('post', 'oauth/complete', { password })).body.code, 'OAUTH_EXPIRED');

        const forged = Buffer.from(JSON.stringify({ kind: 'link', provider: 'google', sub: newSub(), uid: owner.id, av: 0,
            exp: Date.now() + 60000 })).toString('base64url') + '.' + 'A'.repeat(43);
        const anonymous = await browser();
        const csrf = (await anonymous.agent.get('/api/auth/csrf'));
        const attack = await request(app).post('/api/auth/oauth/complete')
            .set('Cookie', csrf.headers['set-cookie'].map(value => value.split(';')[0]).concat('caltdhy_oauth_pending=' + forged).join('; '))
            .set('X-CSRF-Token', csrf.body.csrfToken).send({ password });
        assert.deepEqual([attack.status, attack.body.code], [400, 'OAUTH_EXPIRED']);

        // A ticket issued before a password change no longer links anything.
        const stale = await browser();
        await stale.social('google', { sub: newSub(), email: owner.email, name: 'Same Email' });
        assert.equal((await owner.c.send('put', 'profile', { currentPassword: password, newPassword: password + '-new' })).status, 200);
        assert.equal((await stale.send('post', 'oauth/complete', { password: password + '-new' })).body.code, 'OAUTH_EXPIRED');
        assert.deepEqual((await owner.c.session()).body.user.linkedProviders, []);
    });

    it('handles Facebook accounts: no email, unverified email, and an email owned by another sign-in method', async () => {
        const c = await browser();
        assert.equal((await c.social('facebook', { sub: newSub(), name: 'Phone Only' })).location, '/login?oauth_error=no_email');
        const email = newEmail(), sub = newSub();
        assert.equal((await c.social('facebook', { sub, email, name: 'Facebook Person' })).location, '/login?oauth=done');
        const me = (await c.session()).body.user;
        // Facebook does not vouch for the address, so it stays unverified.
        assert.deepEqual([me.emailVerified, me.hasPassword, me.linkedProviders], [false, false, ['facebook']]);
        assert.match(providerCalls.at(-1).search, /appsecret_proof=[a-f0-9]{64}/);

        // Same address arriving from Google: there is no password to prove ownership, so point back to Facebook.
        const other = await browser();
        assert.equal((await other.social('google', { sub: newSub(), email, name: 'Same Address' })).location, '/login?oauth_error=use_facebook');
        assert.equal((await other.session()).status, 401);
        assert.equal(await User.countDocuments({ email }), 1);

        const unverified = newEmail();
        assert.equal((await other.social('google', { sub: newSub(), email: unverified, emailVerified: false, name: 'Unverified' })).location,
            '/login?oauth_error=email_unverified');
        assert.equal(await User.countDocuments({ email: unverified }), 0);
    });

    it('rejects identity tokens for another app, an old nonce, or a failed exchange', async () => {
        const c = await browser();
        for (const identity of [{ claims: { aud: 'some-other-client' } }, { claims: { nonce: 'replayed' } },
            { claims: { iss: 'https://evil.example' } }, { claims: { exp: 1 } }, { fail: true }, { sub: '' }]) {
            const email = newEmail();
            const back = await c.social('google', { sub: newSub(), email, name: 'Bad Token', ...identity });
            assert.equal(back.location, '/login?oauth_error=failed', JSON.stringify(identity));
            assert.equal(await User.countDocuments({ email }), 0);
        }
        assert.equal((await c.session()).status, 401);
    });

    it('still asks for the 2FA code after Google sign-in, and before linking', async () => {
        const owner = await passwordAccount();
        const setup = await owner.c.send('post', '2fa/setup', { currentPassword: password });
        const start = totp.currentStep();
        const code = offset => totp.codeAt(setup.body.secret, start + offset);
        const enabled = await owner.c.send('post', '2fa/enable', { code: code(0) });
        assert.equal(enabled.status, 200);

        const sub = newSub(), c = await browser();
        assert.equal((await c.social('google', { sub, email: owner.email, name: 'Two Factor' })).location, '/login?oauth=link');
        assert.equal((await c.send('post', 'oauth/complete', { password })).body.code, 'TOTP_REQUIRED');
        assert.equal((await c.send('post', 'oauth/complete', { password, totpCode: code(0) })).body.code, 'TOTP_INVALID');
        assert.equal((await User.findById(owner.id).select('+oauth.googleId').lean()).oauth?.googleId, undefined);
        assert.equal((await c.send('post', 'oauth/complete', { password, totpCode: code(1) })).status, 200);

        const later = await browser();
        assert.equal((await later.social('google', { sub, email: owner.email, name: 'Two Factor' })).location, '/login?oauth=verify');
        assert.equal((await later.session()).status, 401);
        assert.equal((await later.agent.get('/api/auth/oauth/pending')).body.pending.kind, 'totp');
        assert.equal((await later.send('post', 'oauth/complete', {})).body.code, 'TOTP_REQUIRED');
        assert.equal((await later.send('post', 'oauth/complete', { totpCode: code(1) })).body.code, 'TOTP_INVALID');
        // Both usable time steps are spent above; a one-time recovery code is accepted here as at password sign-in.
        const done = await later.send('post', 'oauth/complete', { totpCode: enabled.body.recoveryCodes[0] });
        assert.deepEqual([done.status, done.body.user.id], [200, owner.id]);
        assert.equal((await later.session()).status, 200);
    });

    it('links Google from Settings only after the password, and only to the session that asked', async () => {
        const owner = await passwordAccount(), sub = newSub();
        const refused = await owner.c.link('google', { sub, email: newEmail(), name: 'Other Gmail' }, { password: 'wrong-password-1234' });
        assert.deepEqual([refused.started.status, refused.started.body.code], [400, 'OAUTH_PASSWORD_INVALID']);
        // A wrong password here must not look like an expired session to the app.
        assert.equal((await owner.c.session()).status, 200);
        // Not signed in: no link can be started.
        assert.equal((await (await browser()).send('post', 'oauth/google/link', { password })).status, 401);

        // The Google account may use a different address than the CaltDHy account; identities are matched by id.
        const done = await owner.c.link('google', { sub, email: newEmail(), name: 'Other Gmail' }, { password });
        assert.equal(done.location, '/spending/home?linked=google');
        assert.ok(done.target.searchParams.get('code_challenge'));
        assert.deepEqual((await owner.c.session()).body.user.linkedProviders, ['google']);
        const again = await owner.c.send('post', 'oauth/google/link', { password });
        assert.deepEqual([again.status, again.body.code], [409, 'OAUTH_ALREADY_LINKED']);
        const later = await browser();
        assert.equal((await later.social('google', { sub, email: 'unrelated@example.test', name: 'X' })).location, '/login?oauth=done');
        assert.equal((await later.session()).body.user.id, owner.id);

        // The same Google identity cannot also be attached to a second CaltDHy account.
        const second = await passwordAccount();
        assert.equal((await second.c.link('google', { sub, email: newEmail(), name: 'Taken' }, { password })).location,
            '/spending/home?link_error=in_use&provider=google');
        assert.deepEqual((await second.c.session()).body.user.linkedProviders, []);
        // Cancelling at the provider changes nothing.
        const started = await second.c.send('post', 'oauth/facebook/link', { password });
        const cancelled = await second.c.agent.get('/api/auth/oauth/facebook/callback').query({ error: 'access_denied' });
        assert.ok(started.body.url);
        assert.equal(cancelled.headers.location, '/spending/home?link_error=cancelled&provider=facebook');
    });

    it('refuses a link whose starting session ended or whose password changed before the provider returned', async () => {
        for (const change of ['logout', 'password']) {
            const owner = await passwordAccount();
            const started = await owner.c.send('post', 'oauth/facebook/link', { password });
            const target = new URL(started.body.url);
            if (change === 'logout') assert.equal((await owner.c.send('post', 'logout', {})).status, 200);
            else assert.equal((await owner.c.send('put', 'profile', { currentPassword: password, newPassword: password + '-new' })).status, 200);
            next = { sub: newSub(), email: newEmail(), name: 'Late', nonce: target.searchParams.get('nonce') };
            const back = await owner.c.agent.get('/api/auth/oauth/facebook/callback')
                .query({ code: 'synthetic-code', state: target.searchParams.get('state') });
            assert.equal(back.headers.location, '/spending/home?link_error=expired&provider=facebook', change);
            const stored = await User.findById(owner.id).select('+oauth.facebookId').lean();
            assert.equal(stored.oauth?.facebookId, undefined, change);
        }
    });

    it('unlinks with the password, and never removes the last way to sign in', async () => {
        const owner = await passwordAccount();
        await owner.c.link('facebook', { sub: newSub(), email: newEmail(), name: 'FB' }, { password });
        assert.equal((await owner.c.send('post', 'oauth/facebook/unlink', { password: 'wrong-password-1234' })).body.code, 'OAUTH_PASSWORD_INVALID');
        const unlinked = await owner.c.send('post', 'oauth/facebook/unlink', { password });
        assert.deepEqual([unlinked.status, unlinked.body.user.linkedProviders, unlinked.body.user.hasPassword], [200, [], true]);
        assert.equal((await owner.c.send('post', 'oauth/facebook/unlink', { password })).body.code, 'OAUTH_NOT_LINKED');
        assert.equal((await owner.c.send('post', 'oauth/github/unlink', { password })).status, 404);

        // A passwordless account with only Google cannot unlink it; after adding Facebook it can, without a password.
        const c = await browser(), email = newEmail();
        await c.social('google', { sub: newSub(), email, name: 'Only Google' });
        const last = await c.send('post', 'oauth/google/unlink', {});
        assert.deepEqual([last.status, last.body.code], [400, 'LAST_SIGNIN_METHOD']);
        assert.equal((await c.link('facebook', { sub: newSub(), email: newEmail(), name: 'FB too' })).location, '/spending/home?linked=facebook');
        const removed = await c.send('post', 'oauth/google/unlink', {});
        assert.deepEqual([removed.status, removed.body.user.linkedProviders], [200, ['facebook']]);
        assert.equal((await c.send('post', 'oauth/facebook/unlink', {})).body.code, 'LAST_SIGNIN_METHOD');
        assert.equal((await c.session()).status, 200);
    });

    it('respects invite-only registration: a new social account needs an invite for that exact email', async () => {
        app.locals.registrationMode = 'invite';
        try {
            const invite = async email => {
                const token = crypto.randomBytes(32).toString('hex');
                await Invitation.create({ email, tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
                    expiresAt: new Date(Date.now() + 86400000) });
                return token;
            };
            const email = newEmail(), token = await invite(email), c = await browser();
            assert.equal((await c.social('google', { sub: newSub(), email, name: 'Uninvited' })).location, '/login?oauth_error=invite_required');
            assert.equal((await c.social('google', { sub: newSub(), email: newEmail(), name: 'Wrong Email' }, { invite: token })).location,
                '/login?oauth_error=invite_required');
            assert.equal(await User.countDocuments({ email }), 0);
            assert.equal((await Invitation.findOne({ email }).lean()).usedAt, null);
            const sub = newSub();
            assert.equal((await c.social('google', { sub, email, name: 'Invited' }, { invite: token })).location, '/login?oauth=done');
            assert.ok((await Invitation.findOne({ email }).lean()).usedAt);
            // Existing members keep signing in without an invite.
            assert.equal((await (await browser()).social('google', { sub, email, name: 'Invited' })).location, '/login?oauth=done');
        } finally { app.locals.registrationMode = 'open'; }
    });
});
