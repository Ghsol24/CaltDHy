'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const file = path.resolve(__dirname, '../CaltDHy.app/Contents/MacOS/CaltDHy');
const source = fs.readFileSync(file, 'utf8');
const js = source.split("<<'NODE'\n")[1].replace(/\nNODE\s*$/, '');
new vm.Script(js);
assert.equal(spawnSync('/bin/bash', ['-n', file]).status, 0);
assert.ok(fs.statSync(file).mode & 0o111);
assert.ok(!source.includes('/Users/'));
assert.ok(!/npm\s+(install|run|ci)|nvm\.sh|kill -/.test(source));
assert.ok(source.includes('unset NODE_OPTIONS NODE_PATH'));
// Exercise the actual shell preflight, stopping before Node/server launch.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'caltdhy launcher '));
const shellFile = path.join(fixture, 'CaltDHy.app/Contents/MacOS/CaltDHy');
for (const dir of ['CaltDHy.app/Contents/MacOS', 'CaltDHy.app/Contents/Resources', 'backEnd/server/node_modules', 'frontEnd-react/dist']) fs.mkdirSync(path.join(fixture, dir), { recursive: true });
for (const name of ['backEnd/server/server.js', 'backEnd/server/package.json', 'frontEnd-react/dist/index.html']) fs.writeFileSync(path.join(fixture, name), '');
process.once('exit', () => fs.rmSync(fixture, { recursive: true, force: true }));
const prefix = source.split('exec "$NODE_BIN"')[0]
    .replace('/usr/bin/osascript', '/usr/bin/true') +
    '\nprintf "%s\\n" "$PROJECT_DIR" "$NODE_BIN" "${NODE_OPTIONS-unset}" "${NODE_PATH-unset}"\n';
const shellResult = spawnSync('/bin/bash', ['-c', prefix, shellFile], {
    encoding: 'utf8', env: { ...process.env, CALTDHY_NODE: process.execPath,
        NODE_OPTIONS: '--require=/untrusted/startup.cjs', NODE_PATH: '/untrusted/modules' }
});
assert.equal(shellResult.status, 0, shellResult.stderr);
assert.deepEqual(shellResult.stdout.trim().split('\n'), [fs.realpathSync(fixture), process.execPath, 'unset', 'unset']);
for (const invalid of ['relative/node', '/missing/runtime/node']) {
    const result = spawnSync('/bin/bash', ['-c', prefix, shellFile], {
        encoding: 'utf8', env: { ...process.env, CALTDHY_NODE: invalid }
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
}

async function scenario(options = {}) {
    const events = { launches: [], kills: [], opens: [], logs: [], queries: [], dependencies: [], unrefs: 0 };
    let now = 0;
    let launched = false;
    let queried = false;
    let dead = false;
    const child = new EventEmitter();
    child.pid = 54321;
    child.kill = signal => {
        events.kills.push([child.pid, signal]);
        if (!options.ignoreTerm || signal === 'SIGKILL') {
            dead = true;
            child.emit('exit', 1);
        }
        return true;
    };
    child.unref = () => { events.unrefs += 1; };
    const proc = new EventEmitter();
    Object.assign(proc, {
        argv: ['node', '-', '/portable project with spaces'],
        execPath: '/bundled runtime/bin/node',
        versions: { node: options.oldNode ? '16.0.0' : '24.0.0' },
        env: { PORT: '9999', NODE_ENV: 'development' },
        exit: code => { events.exitCode = code; }
    });
    const childProcess = {
        spawn: (command, args, config) => {
            if (options.throwSpawn) throw new Error('secret-database-password');
            events.launches.push({ command, args, config });
            launched = true;
            if (options.crash) queueMicrotask(() => { dead = true; child.emit('exit', 1); });
            if (options.spawnError) queueMicrotask(() => { dead = true; child.emit('error', new Error('secret')); });
            return child;
        },
        spawnSync: (command, args) => {
            if (command === '/usr/sbin/lsof') {
                if (options.lsofError) return { status: null, error: new Error('secret') };
                if (options.invalidPid) return { status: 0, stdout: 'invalid\n' };
                if (!launched) return { status: options.busy ? 0 : 1, stdout: options.busy ? '999\n' : '' };
                let stdout = dead ? '' : '54321\n';
                if (options.foreign || (options.replaced && queried)) stdout = '999\n';
                if (options.duplicate) stdout = '54321\n54321\n';
                if (options.multiple) stdout = '54321\n999\n';
                return { status: stdout ? 0 : 1, stdout };
            }
            if (command === '/usr/bin/open') {
                events.opens.push(args);
                return { status: options.openError ? 1 : 0 };
            }
            assert.equal(command, '/usr/bin/osascript');
            return { status: 0 };
        }
    };
    const http = {
        get: (config, callback) => {
            events.queries.push(config);
            queried = true;
            const request = new EventEmitter();
            request.destroy = () => {};
            queueMicrotask(() => {
                if (options.signal) proc.emit('SIGTERM');
                if (options.networkError) return request.emit('error', new Error('secret'));
                const response = new EventEmitter();
                response.statusCode = options.httpError ? 503 : 200;
                response.setEncoding = () => {};
                callback(response);
                response.emit('data', options.invalidJson ? '{invalid' : options.oversize ? 'a'.repeat(17000) : JSON.stringify({
                    status: 'OK', db: options.offline ? 'disconnected' : 'connected'
                }));
                response.emit('end');
            });
            return request;
        }
    };
    const requireServer = () => ({ dependencies: { express: '^4.0.0', mongoose: '^8.0.0' } });
    requireServer.resolve = name => {
        events.dependencies.push(name);
        if (options.missingDependency) throw new Error('secret');
        return '/node_modules/' + name;
    };
    const context = {
        require: name => {
            if (name === 'node:path') return path;
            if (name === 'node:http') return http;
            if (name === 'node:module') return { createRequire: () => requireServer };
            if (name === 'node:child_process') return childProcess;
            if (name === 'node:timers/promises') return { setTimeout: async ms => { now += ms; } };
            throw new Error('Unexpected import: ' + name);
        },
        process: proc,
        console: { error: value => events.logs.push(value) },
        Date: { now: () => now },
        setTimeout, clearTimeout
    };
    vm.runInNewContext(js.replace('void main().catch', 'globalThis.done = main().catch'), context);
    await context.done;
    for (let i = 0; i < 35; i += 1) await Promise.resolve();
    assert.ok(!JSON.stringify(events.logs).includes('secret'));
    return events;
}

(async () => {
    let checks = 0;
    const success = await scenario();
    assert.equal(success.opens.length, 1);
    assert.equal(success.opens[0][0], 'http://localhost:24127');
    assert.equal(success.unrefs, 1);
    assert.equal(success.kills.length, 0);
    const launched = success.launches[0];
    assert.equal(launched.command, '/bundled runtime/bin/node');
    assert.equal(launched.args[0], '/portable project with spaces/backEnd/server/server.js');
    assert.equal(launched.config.env.PORT, '24127');
    assert.equal(launched.config.env.NODE_ENV, 'production');
    assert.equal(launched.config.stdio, 'ignore');
    assert.equal(launched.config.detached, true);
    assert.equal(success.dependencies.length, 2);
    checks += 1;
    for (const name of ['busy', 'lsofError', 'invalidPid', 'oldNode', 'missingDependency', 'throwSpawn']) {
        const result = await scenario({ [name]: true });
        assert.equal(result.exitCode, 1, name);
        assert.equal(result.launches.length, 0, name);
        assert.equal(result.opens.length, 0, name);
        assert.equal(result.kills.length, 0, name);
        checks += 1;
    }
    for (const name of ['foreign', 'multiple', 'replaced', 'offline', 'networkError', 'httpError', 'invalidJson', 'oversize', 'openError', 'signal']) {
        const result = await scenario({ [name]: true });
        assert.equal(result.exitCode, 1, name);
        assert.equal(result.opens.length, name === 'openError' ? 1 : 0, name);
        assert.equal(result.kills.length, 1, name);
        assert.equal(result.kills[0][0], 54321, name);
        assert.equal(result.kills[0][1], 'SIGTERM', name);
        assert.equal(result.unrefs, 0, name);
        checks += 1;
    }
    for (const name of ['crash', 'spawnError']) {
        const result = await scenario({ [name]: true });
        assert.equal(result.exitCode, 1, name);
        assert.equal(result.opens.length, 0, name);
        assert.equal(result.kills.length, 0, name);
        checks += 1;
    }
    const duplicate = await scenario({ duplicate: true });
    assert.equal(duplicate.opens.length, 1);
    checks += 1;
    const forced = await scenario({ offline: true, ignoreTerm: true });
    assert.equal(forced.kills.length, 2);
    assert.equal(forced.kills[1][0], 54321);
    assert.equal(forced.kills[1][1], 'SIGKILL');
    checks += 1;
    console.log('PASS: ' + checks + ' simulated launcher scenarios + 3 shell preflight scenarios; syntax, executable permission and unsafe-pattern checks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
