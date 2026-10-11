'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const backend = createRequire(path.resolve(__dirname, '../backEnd/server/package.json'));
const mongoose = backend('mongoose');
const { allowed, checkSources, collectFiles, inspectBuild } = require('../scripts/release.cjs');
test('release allowlist rejects secrets, dumps, archives and symlink-prone runtime directories', () => {
    for (const name of ['backEnd/server/.env', 'backEnd/server/.env.production', 'frontEnd-react/.env.local',
        'backEnd/server/node_modules/example.js', 'frontEnd-react/dist/app.js', 'dump/data.json',
        'backEnd/server/private.pem', 'backEnd/server/backup.zip', '.git/config', 'backEnd/server/users.json',
        'backEnd/server/.private/config.js']) {
        assert.equal(allowed(name), false, name);
    }
    assert.equal(allowed('backEnd/server/.env.example'), true);
    assert.equal(allowed('render.yaml'), true);
    assert.equal(allowed('.node-version'), true);
    assert.equal(allowed('frontEnd-react/public/manifest.json'), true);
    assert.ok(checkSources().length > 50);
});
test('release keeps public sources and docs while ignoring local instructions, reports and old simulations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'caltdhy-release-local-files-'));
    const publicFiles = ['README.md', '.github/workflows/test.yml', 'backEnd/server/server.js',
        'frontEnd-react/src/App.jsx', 'frontEnd-react/public/manifest.json', 'tests/run-e2e.js',
        'tests/browser-security.cjs', 'scripts/release.cjs', 'CaltDHy.app/Contents/MacOS/CaltDHy',
        'docs/PRODUCTION-RUNBOOK.md', 'docs/PWA-DEPLOYMENT.md', 'docs/financial-transaction-rules.md',
        'docs/i18n-display-currency.md', 'docs/transaction-editing-rules.md'];
    const privateFiles = ['AGENTS.md', 'AGENTS.override.md', 'backEnd/server/AGENTS.md',
        'frontEnd-react/src/AGENTS.override.md', 'docs/new-private-audit.md', 'docs/CASH-FLOW-REDESIGN-PLAN.md',
        'RELEASE-MANIFEST.json', 'frontEnd-react/README.md', 'tests/run-api-contract.js',
        'tests/test-archive-wallet.js', 'tests/test-category-c.js', 'tests/test-category-h.js', 'tests/test-category-m.js'];
    const privateDirectories = ['docs/local', 'docs/dark-theme-evidence', 'docs/mobile-ux-evidence',
        'docs/ux-ui-evidence', '.agents', 'backEnd/server/.codex', 'frontEnd-react/.claude',
        'scripts/.cursor', 'tests/.vscode', 'backEnd/.idea'];
    try {
        for (const relative of [...publicFiles, ...privateFiles]) {
            const filename = path.join(root, relative);
            fs.mkdirSync(path.dirname(filename), { recursive: true });
            fs.writeFileSync(filename, 'fixture\n');
        }
        for (const relative of privateDirectories) {
            const directory = path.join(root, relative);
            fs.mkdirSync(directory, { recursive: true });
            fs.writeFileSync(path.join(directory, 'local-notes.md'), 'private fixture\n');
            fs.writeFileSync(path.join(directory, 'screenshot.png'), 'private image fixture\n');
            // An ignored directory must not be traversed, even to inspect a symlink.
            fs.symlinkSync('/nonexistent/private-file', path.join(directory, 'private-link.js'));
            assert.equal(allowed(relative + '/local-notes.md'), false, relative);
            assert.equal(allowed(relative + '/screenshot.png'), false, relative);
        }
        for (const relative of privateFiles) assert.equal(allowed(relative), false, relative);
        for (const relative of publicFiles) assert.equal(allowed(relative), true, relative);
        assert.deepEqual(collectFiles(root), publicFiles.sort());
        assert.deepEqual(checkSources(root), publicFiles);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('release rejects symlinks and build credentials without printing secret contents', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'caltdhy-release-guard-'));
    try {
        fs.mkdirSync(path.join(root, 'scripts'));
        fs.symlinkSync('/nonexistent/private-file', path.join(root, 'scripts/link.js'));
        assert.throws(() => collectFiles(root), /Symlink/);
        fs.unlinkSync(path.join(root, 'scripts/link.js'));
        fs.writeFileSync(path.join(root, 'scripts/app.js'), 'const leaked = "MONGODB_URI";');
        assert.throws(() => inspectBuild(path.join(root, 'scripts')), /configuration leaked/);
        fs.writeFileSync(path.join(root, 'scripts/app.js'), 'const safe = true;');
        fs.writeFileSync(path.join(root, 'scripts/app.js.map'), '{}');
        assert.throws(() => inspectBuild(path.join(root, 'scripts')), /Forbidden build artifact/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('destructive script confirmations and user scope are checked before connection', async () => {
    const oldMode = process.env.NODE_ENV;
    const original = mongoose.createConnection;
    let connected = false;
    mongoose.createConnection = () => { connected = true; throw new Error('Must not connect'); };
    try {
        process.env.NODE_ENV = 'test';
        const cleanup = backend('./scripts/cleanup-users').cleanup;
        const options = { mongoUri: 'mongodb://127.0.0.1/caltdhy_test', expectedDb: 'caltdhy_test',
            userIds: ['000000000000000000000001'] };
        await assert.rejects(cleanup({ ...options, apply: true, confirm: 'DELETE:wrong-scope' }), /dry-run/);
        await assert.rejects(cleanup({ ...options, userIds: [] }), /user ID/);
        await assert.rejects(cleanup({ ...options, userIds: [{ $ne: null }] }), /ObjectId/);
        await assert.rejects(cleanup({ ...options, userIds: [...options.userIds, ...options.userIds] }), /trùng/);
        await assert.rejects(backend('./scripts/seed-admin-data').seedAdmin({
            ...options, email: 'fixture@example.test', apply: true, confirm: 'SEED:wrong-scope'
        }), /dry-run/);
        assert.equal(connected, false);
    } finally {
        mongoose.createConnection = original;
        if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
    }
});
test('cleanup and seed refuse production before connecting or writing', async () => {
    const oldMode = process.env.NODE_ENV;
    const original = mongoose.createConnection;
    let connected = false;
    mongoose.createConnection = () => { connected = true; throw new Error('Must not connect'); };
    try {
        process.env.NODE_ENV = 'production';
        await assert.rejects(backend('./scripts/cleanup-users').cleanup({
            mongoUri: 'mongodb://127.0.0.1/caltdhy_test', expectedDb: 'caltdhy_test', userIds: ['000000000000000000000001']
        }), /development|test/);
        await assert.rejects(backend('./scripts/seed-admin-data').seedAdmin({
            mongoUri: 'mongodb://127.0.0.1/caltdhy_test', expectedDb: 'caltdhy_test', email: 'seed@example.test'
        }), /development|test/);
        assert.equal(connected, false);
        process.env.NODE_ENV = 'test';
        await assert.rejects(backend('./scripts/cleanup-users').cleanup({
            mongoUri: 'mongodb://127.0.0.1/caltdhy_production', expectedDb: 'caltdhy_production', userIds: ['000000000000000000000001']
        }), /caltdhy_dev|caltdhy_test/);
        assert.equal(connected, false);
    } finally {
        mongoose.createConnection = original;
        if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
    }
});
test('launcher never installs/builds, sources NVM, hardcodes user home or kills by port', () => {
    const launcher = fs.readFileSync(path.resolve(__dirname, '../CaltDHy.app/Contents/MacOS/CaltDHy'), 'utf8');
    assert.doesNotMatch(launcher, /npm\s+(?:install|ci|run)|\/Users\/|nvm\.sh|kill -/);
    assert.match(launcher, /child\.kill\('SIGTERM'\)/);
});
