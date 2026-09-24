'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const TOP = new Set(['backEnd', 'frontEnd-react', 'CaltDHy.app', 'scripts', 'tests', 'docs', '.github']);
const ROOT_FILES = new Set(['package.json', 'package-lock.json', '.gitignore', 'README.md']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.agents', '.codex', 'coverage', 'release', 'test-results', 'playwright-report']);
const EXTENSIONS = new Set(['.js', '.jsx', '.cjs', '.mjs', '.css', '.html', '.md', '.yml', '.yaml', '.svg', '.png', '.jpg', '.jpeg', '.ico', '.icns', '.webp', '.woff', '.woff2', '.ttf', '.plist']);
function allowed(relative) {
    const parts = relative.split('/'); const name = parts.at(-1);
    if (parts.some(part => SKIP_DIRS.has(part))) return false;
    if (parts.slice(0, -1).some((part, index) => part.startsWith('.') && !(index === 0 && part === '.github'))) return false;
    if (parts.length === 1) return ROOT_FILES.has(name);
    if (!TOP.has(parts[0])) return false;
    if (name.startsWith('.') && name !== '.env.example') return false;
    if (name === '.env.example') return relative === 'backEnd/server/.env.example';
    if (['package.json', 'package-lock.json'].includes(name)) return ['backEnd/server', 'frontEnd-react'].includes(parts.slice(0, -1).join('/'));
    if (relative === 'CaltDHy.app/Contents/MacOS/CaltDHy' || relative === 'CaltDHy.app/Contents/PkgInfo') return true;
    return EXTENSIONS.has(path.extname(name));
}
function collectFiles(root = ROOT) {
    const files = [];
    function walk(directory, prefix = '') {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (SKIP_DIRS.has(entry.name)) continue;
            const relative = prefix ? prefix + '/' + entry.name : entry.name;
            if (!prefix && !TOP.has(entry.name) && !ROOT_FILES.has(entry.name)) continue;
            if (entry.isSymbolicLink()) throw new Error('Symlink is not permitted in release sources.');
            if (entry.isDirectory()) walk(path.join(directory, entry.name), relative);
            else if (entry.isFile() && allowed(relative)) files.push(relative);
        }
    }
    walk(root);
    return files.sort();
}
function inspectFile(filename, relative) {
    const contents = fs.readFileSync(filename);
    if (contents.length > 10 * 1024 * 1024) throw new Error('Unexpected large source artifact.');
    if (/\.(?:png|jpg|jpeg|ico|icns|webp|woff2?|ttf)$/.test(relative)) return;
    const text = contents.toString('utf8');
    const forbidden = [
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
        /(?:gh[pousr]_|github_pat_)[a-zA-Z0-9_]{30,}/,
        /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
        /\bxox[baprs]-[a-zA-Z0-9-]{20,}/,
        /mongodb(?:\+srv)?:\/\/[^\s/'"<>:]+:[^\s@'"<>]+@/
    ];
    // Never echo the matching value into build output.
    if (forbidden.some(pattern => pattern.test(text))) throw new Error('Potential credential detected in release source.');
    if (relative.endsWith('.env.example')) {
        for (const name of ['MONGODB_URI', 'JWT_SECRET', 'GMAIL_USER', 'GMAIL_PASS']) {
            if (!new RegExp('^' + name + '=$', 'm').test(text)) throw new Error('Example environment contains a configured secret.');
        }
    }
}
function checkSources(root = ROOT) {
    const files = collectFiles(root);
    for (const relative of files) inspectFile(path.join(root, relative), relative);
    if (!files.includes('backEnd/server/server.js') || !files.includes('frontEnd-react/src/App.jsx')) throw new Error('Incomplete project.');
    return files;
}
function copySources(destination, files) {
    for (const relative of files) {
        const source = path.join(ROOT, relative), target = path.join(destination, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
        fs.chmodSync(target, relative === 'CaltDHy.app/Contents/MacOS/CaltDHy' ? 0o755 : 0o644);
    }
}
function run(command, args, cwd, env = process.env) {
    const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('Release command failed.');
}
function inspectBuild(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isSymbolicLink() || entry.name.startsWith('.') || entry.name.endsWith('.map')) throw new Error('Forbidden build artifact.');
        if (entry.isDirectory()) inspectBuild(target);
        else if (/\.(?:js|html|css|json)$/.test(entry.name)) {
            inspectFile(target, entry.name);
            const text = fs.readFileSync(target, 'utf8');
            if (/MONGODB_URI|JWT_SECRET|GMAIL_PASS|mongodb(?:\+srv)?:\/\//.test(text)) throw new Error('Server configuration leaked into frontend build.');
        }
    }
}
function main() {
    const mode = process.argv[2] || '--check';
    if (!['--check', '--prepare', '--zip'].includes(mode)) throw new Error('Use --check, --prepare or --zip.');
    const files = checkSources();
    if (mode === '--check') { console.log('Release source check passed: ' + files.length + ' allowed files.'); return; }
    const releaseDir = path.join(ROOT, 'release');
    fs.mkdirSync(releaseDir, { recursive: true });
    if (mode === '--prepare') {
        const destination = fs.mkdtempSync(path.join(releaseDir, 'prepared-'));
        copySources(destination, files);
        const configDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'caltdhy-build-config-'));
        const userConfig = path.join(configDirectory, 'user.npmrc');
        const globalConfig = path.join(configDirectory, 'global.npmrc');
        fs.writeFileSync(userConfig, '', { mode: 0o600 });
        fs.writeFileSync(globalConfig, '', { mode: 0o600 });
        // No application secrets, NODE_OPTIONS or VITE_* environment enter the build.
        const env = { PATH: process.env.PATH, HOME: os.homedir(), TMPDIR: os.tmpdir(),
            NODE_ENV: 'development', NPM_CONFIG_USERCONFIG: userConfig, NPM_CONFIG_GLOBALCONFIG: globalConfig };
        try {
            run('npm', ['ci', '--omit=dev', '--ignore-scripts'], path.join(destination, 'backEnd/server'), env);
            run('npm', ['ci', '--ignore-scripts'], path.join(destination, 'frontEnd-react'), env);
            run('npm', ['run', 'build'], path.join(destination, 'frontEnd-react'), { ...env, NODE_ENV: 'production' });
            inspectBuild(path.join(destination, 'frontEnd-react/dist'));
            fs.rmSync(path.join(destination, 'frontEnd-react/node_modules'), { recursive: true, force: true });
        } catch (error) {
            fs.rmSync(destination, { recursive: true, force: true });
            throw error;
        } finally {
            fs.rmSync(configDirectory, { recursive: true, force: true });
        }
        console.log('Prepared runtime (configure server environment separately): ' + destination);
        return;
    }
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'caltdhy-release-'));
    try {
        const destination = path.join(staging, 'CaltDHy');
        copySources(destination, files);
        const manifest = files.map(relative => ({ path: relative,
            sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(destination, relative))).digest('hex') }));
        fs.writeFileSync(path.join(destination, 'RELEASE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
        const output = path.join(releaseDir, 'CaltDHy-hardened-' + Date.now() + '.zip');
        run('zip', ['-q', '-r', '-X', output, 'CaltDHy'], staging);
        run('unzip', ['-tq', output], ROOT);
        const listing = spawnSync('unzip', ['-Z1', output], { encoding: 'utf8' });
        if (listing.status !== 0) throw new Error('Cannot inspect ZIP.');
        const archived = listing.stdout.trim().split('\n').filter(name => !name.endsWith('/')).map(name => name.slice('CaltDHy/'.length));
        if (archived.length !== files.length + 1 || archived.some(name => name !== 'RELEASE-MANIFEST.json' && !files.includes(name))) throw new Error('ZIP allowlist mismatch.');
        const digest = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
        fs.writeFileSync(output + '.sha256', digest + '  ' + path.basename(output) + '\n');
        console.log('Verified source ZIP: ' + output);
    } finally { fs.rmSync(staging, { recursive: true, force: true }); }
}
if (require.main === module) {
    try { main(); } catch { console.error('[release] validation_or_packaging_failed'); process.exitCode = 1; }
}
module.exports = { allowed, collectFiles, checkSources, inspectBuild };
