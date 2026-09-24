'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const vite = path.join(root, 'frontEnd-react/node_modules/vite/bin/vite.js');
if (Number(process.versions.node.split('.')[0]) < 24 || !fs.existsSync(vite)) {
    console.error('Development requires Node.js 24+ and installed project dependencies.');
    process.exit(1);
}
// Vite's API proxy targets this fixed local backend port.
const env = { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '24127' };
const children = new Set();
let stopping = false;
let exitCode = 0;
let deadline;
function stop(code) {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    for (const child of children) child.kill('SIGTERM');
    deadline = setTimeout(() => {
        for (const child of children) child.kill('SIGKILL');
    }, 5000);
    deadline.unref();
    if (!children.size) process.exitCode = exitCode;
}
function start(args, cwd) {
    const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
    children.add(child);
    const finished = (code) => {
        if (!children.delete(child)) return;
        if (!stopping) stop(code || 1);
        if (!children.size) {
            clearTimeout(deadline);
            process.exitCode = exitCode;
        }
    };
    child.once('error', () => finished(1));
    child.once('exit', finished);
}
process.once('SIGINT', () => stop(130));
process.once('SIGTERM', () => stop(143));
start(['server.js'], path.join(root, 'backEnd/server'));
start([vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], path.join(root, 'frontEnd-react'));
console.log('Development UI: http://127.0.0.1:5173. Wait for both services to report ready.');
