const assert = require('assert');
const path = require('path');
const jwt = require(path.resolve(__dirname, '../backEnd/server/node_modules/jsonwebtoken'));
const mongoose = require(path.resolve(__dirname, '../backEnd/server/node_modules/mongoose'));

const User = require('../backEnd/server/models/User');
const Wallet = require('../backEnd/server/models/Wallet');
const Budget = require('../backEnd/server/models/Budget');
const Transaction = require('../backEnd/server/models/Transaction');
const Installment = require('../backEnd/server/models/Installment');

const { protect } = require('../backEnd/server/middleware/authMiddleware');
const authRouter = require('../backEnd/server/routes/auth');
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
    console.log('🧪 Starting Category H Verification Tests (H-01, H-02, H-03, H-04)...\n');

    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_caltdhy_super_secure';

    // ─────────────────────────────────────────────────────────────
    // Test H-01: authMiddleware Graceful Degradation on DB Failure
    // ─────────────────────────────────────────────────────────────
    console.log('--- Test H-01: authMiddleware handles DB downtime without dropping user sessions ---');
    const validUserId = '507f1f77bcf86cd799439011';
    const validToken = jwt.sign({ id: validUserId, email: 'test@caltdhy.vn' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 1a. Mô phỏng database connection timeout / network glitch
    User.findById = () => ({
        select: () => ({
            lean: async () => {
                throw new Error('MongoServerSelectionError: connection timed out');
            }
        })
    });

    let res = mockRes();
    let nextCalled = false;
    let req = {
        headers: { authorization: `Bearer ${validToken}` },
        cookies: {}
    };

    await protect(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 503, 'DB failure must return 503 Service Unavailable');
    assert.strictEqual(res.body.code, 'DATABASE_ERROR', 'Must return DATABASE_ERROR code to prevent client logout');
    assert.strictEqual(nextCalled, false, 'next() must not be called when DB errors');

    // 1b. Mô phỏng DB bình thường
    User.findById = () => ({
        select: () => ({
            lean: async () => ({
                _id: validUserId,
                name: 'Minh Quan',
                email: 'test@caltdhy.vn'
            })
        })
    });

    res = mockRes();
    nextCalled = false;
    await protect(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'next() must be called when DB query succeeds');
    assert.strictEqual(req.user.id, validUserId, 'User data must be attached to req.user');
    console.log('✅ Test H-01 Passed: authMiddleware returns 503 on DB outage, preventing user session purging.\n');

    // ─────────────────────────────────────────────────────────────
    // Test H-02: Auto-create default wallet on user registration
    // ─────────────────────────────────────────────────────────────
    console.log('--- Test H-02: Auto-create default wallet on registration ---');
    const registerHandler = getHandler(authRouter, 'post', '/register');

    User.findOne = async () => null; // Email chưa tồn tại
    let createdUser = null;
    User.create = async (doc) => {
        createdUser = { _id: '507f1f77bcf86cd799439099', ...doc };
        return createdUser;
    };

    let createdWallet = null;
    Wallet.create = async (doc) => {
        createdWallet = doc;
        return { _id: 'wallet_cash_001', ...doc };
    };

    Budget.insertMany = async () => [];

    res = mockRes();
    await registerHandler({
        body: {
            name: 'New Registered User',
            email: 'newuser@caltdhy.vn',
            password: 'SecurePassword123!'
        }
    }, res);

    assert.strictEqual(res.statusCode, 201, 'Registration must return 201 Created');
    assert.ok(createdWallet !== null, 'A default wallet must be created during registration');
    assert.strictEqual(createdWallet.userId.toString(), createdUser._id.toString(), 'Wallet must belong to the new user');
    assert.strictEqual(createdWallet.name, 'Tiền mặt', 'Wallet name must be Tiền mặt');
    assert.strictEqual(createdWallet.isDefault, true, 'Wallet must be set as default');
    assert.strictEqual(createdWallet.type, 'cash', 'Wallet type must be cash');
    console.log('✅ Test H-02 Passed: New user registration automatically provisions default cash wallet.\n');

    // ─────────────────────────────────────────────────────────────
    // Test H-03: Include transaction fee in calculateMonthlyStats
    // ─────────────────────────────────────────────────────────────
    console.log('--- Test H-03: Transaction fee synchronization in calculateMonthlyStats ---');
    const financeMathModule = await import('../frontEnd-react/src/utils/financeMath.js');
    const { calculateMonthlyStats, calculateAvailableToSpend } = financeMathModule;

    const sampleTransactions = [
        { id: 't1', type: 'income', amount: 15000000, date: '2026-09-01' },
        { id: 't2', type: 'expense', amount: 500000, fee: 15000, category: 'Ăn uống', date: '2026-09-02', walletId: 'w1' },
        { id: 't3', type: 'expense', amount: 200000, fee: 0, category: 'Ăn uống', date: '2026-09-03', walletId: 'w1' },
        { id: 't4', type: 'expense', amount: 1200000, fee: 25000, category: 'Mua sắm', date: '2026-09-04', walletId: 'w1' },
        { id: 't5', type: 'transfer', amount: 1000000, fee: 5000, date: '2026-09-05', walletId: 'w1', toWalletId: 'w2' }
    ];

    const monthlyStats = calculateMonthlyStats(sampleTransactions, '2026-09');

    // Chi phí = (500k + 15k) + (200k + 0) + (1.2tr + 25k) = 1,940,000 VND
    const expectedExpense = (500000 + 15000) + 200000 + (1200000 + 25000);
    assert.strictEqual(monthlyStats.expense, expectedExpense, `Total expense (${monthlyStats.expense}) must include transaction fees (${expectedExpense})`);
    assert.strictEqual(monthlyStats.byCategory['Ăn uống'], 500000 + 15000 + 200000, 'Category Ăn uống must include fees');
    assert.strictEqual(monthlyStats.byCategory['Mua sắm'], 1200000 + 25000, 'Category Mua sắm must include fees');
    assert.strictEqual(monthlyStats.net, 15000000 - expectedExpense, 'Net income must properly subtract fees');

    // Kiểm tra đồng bộ hoàn hảo với calculateAvailableToSpend
    const availableStats = calculateAvailableToSpend({
        wallets: [{ id: 'w1', initialBalance: 20000000 }, { id: 'w2', initialBalance: 0 }],
        transactions: sampleTransactions,
        currentMonthPrefix: '2026-09'
    });
    assert.strictEqual(monthlyStats.expense, availableStats.monthlyExpense, 'calculateMonthlyStats expense must match calculateAvailableToSpend monthlyExpense exactly');
    console.log('✅ Test H-03 Passed: calculateMonthlyStats and calculateAvailableToSpend are 100% consistent with fees.\n');

    // ─────────────────────────────────────────────────────────────
    // Test H-04: Wallet Cascade Delete & Self-transfer Cleanup & Installments
    // ─────────────────────────────────────────────────────────────
    console.log('--- Test H-04: Wallet delete updates Installments & handles self-transfers ---');
    const deleteWalletHandler = getHandler(walletsRouter, 'delete', '/:id');

    const walletToDeleteId = '507f1f77bcf86cd799439001';
    const defaultWalletId = '507f1f77bcf86cd799439002';
    const currentUserId = '507f1f77bcf86cd799439011';

    Wallet.countDocuments = async () => 3;
    Wallet.findOne = async (query) => {
        if (query._id === walletToDeleteId) {
            return {
                _id: walletToDeleteId,
                userId: currentUserId,
                name: 'Ví phụ sắp xóa',
                initialBalance: 500000,
                isDefault: false
            };
        }
        return {
            _id: defaultWalletId,
            userId: currentUserId,
            name: 'Ví mặc định',
            initialBalance: 1000000,
            isDefault: true,
            save: async () => true
        };
    };
    Wallet.findOneAndDelete = async () => true;

    let transactionUpdateCalls = [];
    let transactionDeleteCalls = [];
    let installmentUpdateCalls = [];

    Transaction.updateMany = async (...args) => {
        transactionUpdateCalls.push(args);
        return { modifiedCount: 1 };
    };

    Transaction.deleteMany = async (...args) => {
        transactionDeleteCalls.push(args);
        return { deletedCount: 1 };
    };

    Installment.updateMany = async (...args) => {
        installmentUpdateCalls.push(args);
        return { modifiedCount: 1 };
    };

    res = mockRes();
    await deleteWalletHandler({
        params: { id: walletToDeleteId },
        user: { id: currentUserId }
    }, res);

    assert.strictEqual(res.statusCode, 200, 'Wallet deletion should return 200');

    // 4a. Kiểm tra Installments được cập nhật về ví mặc định
    assert.strictEqual(installmentUpdateCalls.length, 1, 'Installment.updateMany must be called');
    assert.deepStrictEqual(installmentUpdateCalls[0][0], { walletId: walletToDeleteId, userId: currentUserId });
    assert.deepStrictEqual(installmentUpdateCalls[0][1], { $set: { walletId: defaultWalletId } });

    // 4b. Kiểm tra self-transfer có phí được chuyển thành expense
    const feeSelfTransferUpdate = transactionUpdateCalls.find(call => 
        call[0] && call[0].type === 'transfer' && call[0].walletId === defaultWalletId && call[0].fee
    );
    assert.ok(feeSelfTransferUpdate, 'Self-transfers with fee must be converted to expense');

    // 4c. Kiểm tra self-transfer 0đ bị xóa dọn dẹp
    assert.strictEqual(transactionDeleteCalls.length, 1, 'Transaction.deleteMany must clean up zero-fee self-transfers');
    assert.deepStrictEqual(transactionDeleteCalls[0][0], {
        userId: currentUserId,
        type: 'transfer',
        walletId: defaultWalletId,
        toWalletId: defaultWalletId
    });

    console.log('✅ Test H-04 Passed: Wallet delete seamlessly re-points installments and sanitizes self-transfers.\n');

    console.log('🎉 ALL CATEGORY H VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀\n');
}

runTests().catch(err => {
    console.error('❌ Category H Test failed:', err);
    process.exit(1);
});
