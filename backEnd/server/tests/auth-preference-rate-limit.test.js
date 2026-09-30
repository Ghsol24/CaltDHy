'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');

Object.assign(process.env, {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '24128',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    TRUST_PROXY_HOPS: '1',
    API_RATE_LIMIT_MAX: '100',
    AUTH_RATE_LIMIT_MAX: '1'
});

for (const name of ['CLIENT_URL', 'CORS_WHITELIST', 'COOKIE_SECURE']) delete process.env[name];

const { issueCsrf } = require('../utils/sessionSecurity');
const app = require('../server');

function anonymousCsrf() {
    const req = { headers: {} };
    let cookie;
    const token = issueCsrf(req, {
        cookie(name, value) { cookie = `${name}=${value}`; }
    });
    return { cookie, token };
}

test('preference saves use the global limit without consuming the login limit', async () => {
    const { cookie, token } = anonymousCsrf();
    const send = (path, body) => request(app).put(path)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send(body);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await send('/api/auth/preferences', { analyticsExcludeRecurring: true });
        assert.equal(response.status, 503);
    }

    const firstLogin = await request(app).post('/api/auth/login')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send({ email: 'person@example.test', password: 'Password-1234' });
    assert.equal(firstLogin.status, 503);

    const blockedLogin = await request(app).post('/api/auth/login')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send({ email: 'person@example.test', password: 'Password-1234' });
    assert.equal(blockedLogin.status, 429);
});

test('login attempts share the auth limit across IPv6 rotation and URL aliases', async () => {
    const { cookie, token } = anonymousCsrf();
    const login = (ip, path) => request(app).post(path)
        .set('X-Forwarded-For', ip)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send({ email: 'person@example.test', password: 'Password-1234' });

    assert.equal((await login('2001:db8:9876:1200::1', '/api/AUTH/LOGIN')).status, 503);
    const blocked = await login('2001:db8:9876:12ff::2', '/api/auth/login/');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers['ratelimit-limit'], '1');
    assert.match(blocked.headers['cache-control'], /no-store/);
    assert.equal((await login('2001:db8:9876:1300::1', '/api/auth/login')).status, 503);
});
