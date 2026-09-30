'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setSession } = require('../utils/sessionSecurity');

function configuredCookies(settings) {
    const keys = ['RENDER', 'HOST', 'CLIENT_URL', 'COOKIE_SECURE', 'JWT_SECRET', 'JWT_EXPIRES_IN'];
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    try {
        for (const key of keys) delete process.env[key];
        Object.assign(process.env, {
            JWT_SECRET: 'Synthetic-cookie-test-key-32-bytes-minimum', JWT_EXPIRES_IN: '1h', ...settings
        });
        const cookies = [];
        setSession({ headers: {} }, { cookie: (...args) => cookies.push(args) }, {
            token: 'a'.repeat(64), expiresAt: new Date(Date.now() + 60000)
        });
        return cookies;
    } finally {
        for (const key of keys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    }
}

test('Render public-host default enforces Secure host cookies without optional cookie configuration', () => {
    for (const settings of [{ RENDER: 'true' }, { RENDER: 'true', COOKIE_SECURE: 'false' }]) {
        for (const [name, , options] of configuredCookies(settings)) {
            assert.equal(options.secure, true);
            assert.ok(name.startsWith('__Host-'));
            assert.equal(options.httpOnly, true);
            assert.equal(options.sameSite, 'strict');
            assert.equal(options.path, '/');
            assert.equal(options.domain, undefined);
        }
    }
});

test('local loopback default keeps HTTP launcher cookies compatible', () => {
    for (const [name, , options] of configuredCookies({})) {
        assert.equal(options.secure, false);
        assert.equal(name.startsWith('__Host-'), false);
        assert.equal(options.httpOnly, true);
        assert.equal(options.sameSite, 'strict');
    }
});
