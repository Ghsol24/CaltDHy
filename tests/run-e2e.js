/**
 * CaltDHy Master End-to-End & System Integration Test Runner
 *
 * Replaced legacy JSDOM simulation (which referenced removed vanilla frontEnd/spending.html)
 * with a unified, comprehensive end-to-end integration test runner that validates:
 * 1. API Contract Suite (tests/run-api-contract.js)
 * 2. Critical Bugs Suite (tests/test-category-c.js)
 * 3. High Priority Architecture Suite (tests/test-category-h.js)
 * 4. Wallet Archive & Soft-Delete Suite (tests/test-archive-wallet.js)
 * 5. Medium Priority & UX Polish Suite (tests/test-category-m.js)
 * 6. React Frontend Production Build Verification
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const testSuites = [
    {
        name: 'Core API Contracts & Multi-Wallet Suite',
        file: 'tests/run-api-contract.js',
        command: process.execPath,
        args: ['tests/run-api-contract.js']
    },
    {
        name: 'Category C (Critical Edge Cases & IDOR) Suite',
        file: 'tests/test-category-c.js',
        command: process.execPath,
        args: ['tests/test-category-c.js']
    },
    {
        name: 'Category H (High Priority Architecture & Auth) Suite',
        file: 'tests/test-category-h.js',
        command: process.execPath,
        args: ['tests/test-category-h.js']
    },
    {
        name: 'Wallet Soft-Delete & Pre-flight Check Suite',
        file: 'tests/test-archive-wallet.js',
        command: process.execPath,
        args: ['tests/test-archive-wallet.js']
    },
    {
        name: 'Category M (Medium Priority & Data Reset) Suite',
        file: 'tests/test-category-m.js',
        command: process.execPath,
        args: ['tests/test-category-m.js']
    }
];

async function runAllSuites() {
    console.log('===============================================================');
    console.log('🚀 CALTDHY MASTER INTEGRATION & E2E TEST RUNNER');
    console.log('===============================================================\n');

    let allPassed = true;
    const results = [];

    for (const suite of testSuites) {
        console.log(`▶ Running: ${suite.name}...`);
        const startTime = Date.now();

        const result = spawnSync(suite.command, suite.args, {
            cwd: ROOT_DIR,
            stdio: 'pipe',
            encoding: 'utf8'
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        if (result.status === 0) {
            console.log(`✅ [PASS] ${suite.name} (${elapsed}s)\n`);
            results.push({ name: suite.name, passed: true, elapsed });
        } else {
            console.error(`❌ [FAIL] ${suite.name} (${elapsed}s)`);
            if (result.stdout) console.log(result.stdout);
            if (result.stderr) console.error(result.stderr);
            console.log('\n');
            results.push({ name: suite.name, passed: false, elapsed });
            allPassed = false;
        }
    }

    // Verify React Frontend build
    console.log('▶ Verifying React Frontend Build (Vite)...');
    const buildStart = Date.now();
    const buildResult = spawnSync('npm', ['--prefix', 'frontEnd-react', 'run', 'build'], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        encoding: 'utf8'
    });
    const buildElapsed = ((Date.now() - buildStart) / 1000).toFixed(2);

    if (buildResult.status === 0) {
        console.log(`✅ [PASS] React Frontend Build Clean (${buildElapsed}s)\n`);
        results.push({ name: 'React Frontend Build (Vite)', passed: true, elapsed: buildElapsed });
    } else {
        console.error(`❌ [FAIL] React Frontend Build Failed (${buildElapsed}s)`);
        if (buildResult.stdout) console.log(buildResult.stdout);
        if (buildResult.stderr) console.error(buildResult.stderr);
        console.log('\n');
        results.push({ name: 'React Frontend Build (Vite)', passed: false, elapsed: buildElapsed });
        allPassed = false;
    }

    console.log('===============================================================');
    console.log('📊 TEST EXECUTION SUMMARY:');
    console.log('===============================================================');
    results.forEach((r) => {
        const status = r.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${status.padEnd(8)} | ${r.name.padEnd(45)} | ${r.elapsed}s`);
    });
    console.log('===============================================================');

    if (!allPassed) {
        console.error('\n❌ One or more test suites failed. Please review errors above.');
        process.exit(1);
    }

    console.log('\n🎉 ALL E2E & SYSTEM INTEGRATION TESTS PASSED PERFECTLY! 🚀\n');
}

runAllSuites().catch((err) => {
    console.error('Fatal runner error:', err);
    process.exit(1);
});
