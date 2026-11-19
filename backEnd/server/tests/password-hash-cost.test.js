'use strict';
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { passwordHashCost } = require('../utils/passwordHash');

const saved = { NODE_ENV: process.env.NODE_ENV, RENDER: process.env.RENDER };
const setEnv = (values) => {
    for (const [name, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
};

describe('password hash cost', () => {
    afterEach(() => setEnv(saved));

    it('keeps cost 12 for every real environment and lowers it only for the local test suites', () => {
        for (const NODE_ENV of [undefined, 'production', 'development']) {
            setEnv({ NODE_ENV, RENDER: undefined });
            assert.equal(passwordHashCost(), 12, String(NODE_ENV));
        }
        setEnv({ NODE_ENV: 'test', RENDER: undefined });
        assert.equal(passwordHashCost(), 4);
        setEnv({ NODE_ENV: 'test', RENDER: 'true' });
        assert.equal(passwordHashCost(), 12, 'a Render deployment never uses the test cost');
    });

    it('auth routes hash new passwords only through the shared cost', () => {
        const source = fs.readFileSync(path.join(__dirname, '../routes/auth.js'), 'utf8');
        const calls = source.match(/bcrypt\.hash\([^)]*\)/g) || [];
        assert.ok(calls.length >= 3, 'register, reset and profile update all hash a password');
        for (const call of calls) assert.match(call, /passwordHashCost\(\)/, call);
    });

    it('a hash made at the test cost still verifies and carries its own cost', async () => {
        const hashed = await bcrypt.hash('Test-password-1234', 4);
        assert.equal(bcrypt.getRounds(hashed), 4);
        assert.equal(await bcrypt.compare('Test-password-1234', hashed), true);
        assert.equal(await bcrypt.compare('Test-password-1235', hashed), false);
    });
});
