'use strict';
// Compatibility entry point: run real replica-set and browser checks.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync('npm', ['run', 'test:all'], {
    cwd: path.resolve(__dirname, '..'), stdio: 'inherit', env: process.env
});
process.exitCode = result.error ? 1 : (result.status ?? 1);
