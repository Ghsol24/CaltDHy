const assert = require('assert');
const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backEnd/server/node_modules/mongoose'));

const User = require('../backEnd/server/models/User');
const Wallet = require('../backEnd/server/models/Wallet');
const Transaction = require('../backEnd/server/models/Transaction');
const Installment = require('../backEnd/server/models/Installment');
const walletsRouter = require('../backEnd/server/routes/wallets');

function getHandler(router, method, routePath) {
    const layer = router.stack.find(l => l.route && l.route.path === routePath && l.route.methods[method]);
    if (!layer) throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

async function runTests() {
    console.log('🧪 Starting Wallet Archive & Soft-Delete Verification Tests...\n');

    const userId = '507f1f77bcf86cd799439011';
    const wallet1Id = '507f1f77bcf86cd799439001';
    const wallet2Id = '507f1f77bcf86cd799439002';
    const targetWalletId = '507f1f77bcf86cd799439003';

    const getPreArchive = getHandler(walletsRouter, 'get', '/:id/pre-archive');
    const postArchive = getHandler(walletsRouter, 'post', '/:id/archive');
    const postUnarchive = getHandler(walletsRouter, 'post', '/:id/unarchive');

    // ── Test 1: Pre-Archive Check ──
    console.log('--- Test 1: GET /api/wallets/:id/pre-archive ---');
    Wallet.findOne = async ({ _id }) => ({
        _id,
        name: 'Techcombank',
        isDefault: false,
        archived: false,
        toJSON() { return { id: _id.toString(), name: this.name, isDefault: this.isDefault }; }
    });
    Transaction.aggregate = async () => [{ totalChange: 2500000 }];
    Wallet.find = () => ({ select: () => [] });
    Installment.find = () => ({
        select: () => [
            { _id: 'inst_1', name: 'Trả góp Macbook', amount: 1500000, cycle: 'monthly', nextDueDate: '2026-10-01' }
        ]
    });
    Transaction.countDocuments = async () => 18;
    Wallet.countDocuments = async () => 3;

    let res = mockRes();
    await getPreArchive({ params: { id: wallet1Id }, user: { id: userId } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.transactionsCount, 18);
    assert.strictEqual(res.body.data.activeInstallments.length, 1);
    assert.strictEqual(res.body.data.activeInstallments[0].name, 'Trả góp Macbook');
    console.log('✅ Test 1 Passed: Pre-archive successfully reports balance, installments and transaction count.\n');

    // ── Test 2: Chặn đóng ví mặc định ──
    console.log('--- Test 2: Cannot archive default wallet ---');
    Wallet.findOne = async () => ({
        _id: wallet1Id,
        isDefault: true,
        archived: false
    });
    res = mockRes();
    await postArchive({ params: { id: wallet1Id }, user: { id: userId }, body: {} }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'CANNOT_ARCHIVE_DEFAULT_WALLET');
    console.log('✅ Test 2 Passed: Default wallet is protected from archiving.\n');

    // ── Test 3: Chặn đóng ví khi có dư nợ âm ──
    console.log('--- Test 3: Settle debt first if balance < 0 ---');
    Wallet.findOne = async () => ({
        _id: wallet1Id,
        isDefault: false,
        archived: false,
        initialBalance: -5000000
    });
    Transaction.aggregate = async () => []; // netChange 0 -> balance = -5,000,000
    Wallet.countDocuments = async () => 3;

    res = mockRes();
    await postArchive({ params: { id: wallet1Id }, user: { id: userId }, body: {} }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'SETTLE_DEBT_FIRST');
    console.log('✅ Test 3 Passed: Overdrawn wallet/credit card requires debt settlement before closing.\n');

    // ── Test 4: Chặn đóng ví khi còn số dư > 0 mà chưa chọn ví đích ──
    console.log('--- Test 4: Requires destination wallet if balance > 0 ---');
    Wallet.findOne = async () => ({
        _id: wallet1Id,
        isDefault: false,
        archived: false,
        initialBalance: 2000000
    });
    Transaction.aggregate = async () => []; // balance = 2,000,000
    res = mockRes();
    await postArchive({ params: { id: wallet1Id }, user: { id: userId }, body: {} }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'WALLET_BALANCE_NOT_ZERO');
    console.log('✅ Test 4 Passed: Wallet with positive balance requires explicit transfer destination.\n');

    // ── Test 5: Chặn đóng ví khi còn Installments mà chưa chọn ví thay thế ──
    console.log('--- Test 5: Requires replacement wallet if active installments exist ---');
    Wallet.findOne = async ({ _id }) => {
        if (_id === targetWalletId) return { _id: targetWalletId, archived: false };
        return { _id: wallet1Id, name: 'Ví nguồn', isDefault: false, archived: false, initialBalance: 0 };
    };
    Transaction.aggregate = async () => []; // balance = 0
    Installment.find = async () => [{ _id: 'inst_1', name: 'Tiền nhà' }];

    res = mockRes();
    await postArchive({
        params: { id: wallet1Id },
        user: { id: userId },
        body: { transferToWalletId: targetWalletId }
    }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'HAS_ACTIVE_INSTALLMENTS');
    console.log('✅ Test 5 Passed: Active installments must have a replacement wallet specified.\n');

    // ── Test 6: Đóng ví thành công (Chuyển tiền + Reassign Installments + Set Archived) ──
    console.log('--- Test 6: Archive wallet execution (Transfer + Reassign + Archive) ---');
    let createdTransactions = [];
    let updatedInstallments = [];
    let savedWallet = null;

    Wallet.findOne = async ({ _id }) => {
        if (_id === targetWalletId) return { _id: targetWalletId, archived: false };
        return {
            _id: wallet1Id,
            name: 'Ví Techcombank',
            isDefault: false,
            archived: false,
            initialBalance: 3000000,
            save: async () => { savedWallet = true; },
            toJSON() { return { id: wallet1Id, name: this.name, archived: true }; }
        };
    };
    Transaction.aggregate = async () => []; // balance = 3,000,000
    Installment.find = async () => [{ _id: 'inst_1', name: 'Tiền nhà' }];
    Installment.updateMany = async (...args) => { updatedInstallments.push(args); return { modifiedCount: 1 }; };
    Transaction.create = async (docs) => { createdTransactions.push(...docs); return docs; };

    res = mockRes();
    await postArchive({
        params: { id: wallet1Id },
        user: { id: userId },
        body: {
            transferToWalletId: targetWalletId,
            replacementWalletId: targetWalletId
        }
    }, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(createdTransactions.length, 1, 'Must create transfer transaction to sweep balance');
    assert.strictEqual(createdTransactions[0].amount, 3000000);
    assert.strictEqual(createdTransactions[0].walletId, wallet1Id);
    assert.strictEqual(createdTransactions[0].toWalletId, targetWalletId);
    assert.strictEqual(updatedInstallments.length, 1, 'Must reassign active installments');
    assert.deepStrictEqual(updatedInstallments[0][1], { $set: { walletId: targetWalletId } });
    assert.strictEqual(savedWallet, true, 'Wallet must be marked as archived');
    console.log('✅ Test 6 Passed: Archive wallet cleanly sweeps balance, reassigns installments, and archives wallet.\n');

    // ── Test 7: Mở lại ví đã lưu trữ (Unarchive) ──
    console.log('--- Test 7: Unarchive wallet ---');
    let unarchivedSaved = false;
    Wallet.findOne = async ({ _id, archived }) => {
        if (archived === true) {
            return {
                _id,
                name: 'Ví Techcombank',
                archived: true,
                archivedAt: new Date(),
                save: async () => { unarchivedSaved = true; },
                toJSON() { return { id: _id, name: this.name, archived: false }; }
            };
        }
        return null;
    };

    res = mockRes();
    await postUnarchive({ params: { id: wallet1Id }, user: { id: userId } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(unarchivedSaved, true, 'Wallet must be saved with archived = false');
    console.log('✅ Test 7 Passed: Unarchive wallet restores active state cleanly.\n');

    console.log('🎉 ALL WALLET ARCHIVE BACKEND TESTS PASSED SUCCESSFULLY! 🚀\n');
}

runTests().catch(err => {
    console.error('❌ Wallet Archive Test failed:', err);
    process.exit(1);
});
