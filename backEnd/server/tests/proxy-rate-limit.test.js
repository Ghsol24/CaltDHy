'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');

Object.assign(process.env, {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '24127',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    TRUST_PROXY_HOPS: '1',
    API_RATE_LIMIT_MAX: '1',
    AUTH_RATE_LIMIT_MAX: '1'
});
for (const name of ['CLIENT_URL', 'CORS_WHITELIST', 'COOKIE_SECURE']) delete process.env[name];

const app = require('../server');

test('rate limit trusts only the configured nearest proxy hop', async () => {
    const first = await request(app).get('/api/health')
        .set('X-Forwarded-For', '198.51.100.1, 203.0.113.10');
    assert.equal(first.status, 503);

    const spoofedFirstHop = await request(app).get('/api/health')
        .set('X-Forwarded-For', '198.51.100.2, 203.0.113.10');
    assert.equal(spoofedFirstHop.status, 429);

    const differentClient = await request(app).get('/api/health')
        .set('X-Forwarded-For', '198.51.100.3, 203.0.113.11');
    assert.equal(differentClient.status, 503);
});

test('IPv6 addresses in the same allocation share a rate limit', async () => {
    const first = await request(app).get('/api/health')
        .set('X-Forwarded-For', '2001:db8:1234:5600::1');
    assert.equal(first.status, 503);

    const rotatedAddress = await request(app).get('/api/health')
        .set('X-Forwarded-For', '2001:db8:1234:56ff::2');
    assert.equal(rotatedAddress.status, 429);

    const differentAllocation = await request(app).get('/api/health')
        .set('X-Forwarded-For', '2001:db8:1234:5700::1');
    assert.equal(differentAllocation.status, 503);
});
