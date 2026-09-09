const assert = require('assert');
const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backEnd/server/node_modules/mongoose'));

const User = require('../backEnd/server/models/User');
const Budget = require('../backEnd/server/models/Budget');
const Category = require('../backEnd/server/models/Category');
const Jar = require('../backEnd/server/models/Jar');
const Installment = require('../backEnd/server/models/Installment');
const Wallet = require('../backEnd/server/models/Wallet');
const Transaction = require('../backEnd/server/models/Transaction');

const spendingRouter = require('../backEnd/server/routes/spending');

function getHandler(router, method, path) {
    const layer = router.stack.find(l => l.route && l.route.path === path && l.route.methods[method]);
    if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
    return layer.route.stack[0].handle;
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
    console.log('🧪 Starting Category C Verification Tests...\n');

    // ── Test C-01: PUT /api/spending/categories contract ──
    console.log('--- Test C-01: PUT /api/spending/categories contract ---');
    const putCategories = getHandler(spendingRouter, 'put', '/categories');
    
    let savedCats = null;
    User.findByIdAndUpdate = async (id, update) => {
        savedCats = update.customCategories;
        return { customCategories: savedCats };
    };
    Category.ensureCategorySafe = async () => {};

    // 1a. Payload là direct Array (Frontend cũ gửi mảng)
    let res = mockRes();
    await putCategories({
        user: { id: '507f1f77bcf86cd799439011' },
        body: ['Ăn uống', 'Mua sắm', 'Học tập']
    }, res);
    assert.equal(res.statusCode, 200, 'Direct array payload must return 200');
    assert.deepEqual(res.body.data, ['Ăn uống', 'Mua sắm', 'Học tập']);

    // 1b. Payload là Object { categories: [...] } (Frontend mới gửi object)
    res = mockRes();
    await putCategories({
        user: { id: '507f1f77bcf86cd799439011' },
        body: { categories: ['Ăn uống', 'Đầu tư'] }
    }, res);
    assert.equal(res.statusCode, 200, 'Object payload must return 200');
    assert.deepEqual(res.body.data, ['Ăn uống', 'Đầu tư']);

    // 1c. Payload không hợp lệ -> phải trả 400
    res = mockRes();
    await putCategories({
        user: { id: '507f1f77bcf86cd799439011' },
        body: 'not an array'
    }, res);
    assert.equal(res.statusCode, 400, 'Invalid payload must return 400');
    console.log('✅ Test C-01 Passed: PUT /categories accepts both array and object payloads.\n');

    // ── Test C-02: IDOR Ownership Verification ──
    console.log('--- Test C-02: IDOR check on jarId & installmentId ---');
    const postTransaction = getHandler(spendingRouter, 'post', '/');
    
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    const userA = '507f1f77bcf86cd799439011';
    const foreignJarId = '507f1f77bcf86cd799439099';
    const foreignInstId = '507f1f77bcf86cd799439088';

    Wallet.findOne = async ({ _id, userId }) => ({ _id, userId });
    Jar.findOne = async ({ _id, userId }) => {
        if (_id.toString() === foreignJarId && userId !== userA) return { _id, userId: 'foreign_user' };
        return null;
    };
    Installment.findOne = async ({ _id, userId }) => {
        if (_id.toString() === foreignInstId && userId !== userA) return { _id, userId: 'foreign_user' };
        return null;
    };

    // User A thử gắn jarId của người khác
    res = mockRes();
    await postTransaction({
        user: { id: userA },
        body: {
            type: 'expense',
            amount: 50000,
            category: 'Ăn uống',
            date: '2026-09-07',
            walletId: '507f1f77bcf86cd799439021',
            jarId: foreignJarId
        }
    }, res);
    assert.equal(res.statusCode, 400, 'Foreign jarId must be rejected with 400');
    assert.ok(res.body.message.includes('Hũ tiết kiệm không tồn tại hoặc không thuộc quyền sở hữu'), 'Must reject foreign jar ownership');

    // User A thử gắn installmentId của người khác
    res = mockRes();
    await postTransaction({
        user: { id: userA },
        body: {
            type: 'expense',
            amount: 50000,
            category: 'Ăn uống',
            date: '2026-09-07',
            walletId: '507f1f77bcf86cd799439021',
            installmentId: foreignInstId
        }
    }, res);
    assert.equal(res.statusCode, 400, 'Foreign installmentId must be rejected with 400');
    assert.ok(res.body.message.includes('Khoản định kỳ không tồn tại hoặc không thuộc quyền sở hữu'), 'Must reject foreign installment ownership');
    console.log('✅ Test C-02 Passed: IDOR protection successfully blocks foreign jarId/installmentId.\n');

    // ── Test C-03: Per-Category Auto-Carryover ──
    console.log('--- Test C-03: Per-Category Auto-Carryover ---');
    const getBudget = getHandler(spendingRouter, 'get', '/budget');

    Budget.find = (query) => {
        if (query.month && query.month.$lt) {
            return {
                sort: () => [
                    { category: 'Ăn uống', limit: 3000000, month: '2026-08' },
                    { category: 'Nhà cửa', limit: 5000000, month: '2026-08' },
                    { category: 'Đi lại', limit: 1000000, month: '2026-08' }
                ]
            };
        }
        if (query.month === '2026-09') {
            return Promise.resolve([
                { category: 'Ăn uống', limit: 4000000, month: '2026-09' }
            ]);
        }
        return Promise.resolve([]);
    };

    res = mockRes();
    await getBudget({
        user: { id: userA },
        query: { month: '2026-09' }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data['Ăn uống'], 4000000, 'Current month custom limit overrides baseline');
    assert.equal(res.body.data['Nhà cửa'], 5000000, 'Previous category "Nhà cửa" carried over');
    assert.equal(res.body.data['Đi lại'], 1000000, 'Previous category "Đi lại" carried over');
    console.log('✅ Test C-03 Passed: Per-category carryover merges customized and previous categories.\n');

    // ── Test C-04: Default targetMonth fallback when query.month is omitted ──
    console.log('--- Test C-04: Default targetMonth fallback when query.month is omitted ---');
    const { getVietnamTodayString } = require('../backEnd/server/utils/localDate');
    const currentVnMonth = getVietnamTodayString().slice(0, 7);

    Budget.find = (query) => {
        if (query.month && query.month.$lt) {
            return {
                sort: () => [
                    { category: 'Other Expense', limit: 200000, month: '2026-08' }
                ]
            };
        }
        if (query.month === currentVnMonth) {
            return Promise.resolve([
                { category: 'Other Expense', limit: 450000, month: currentVnMonth }
            ]);
        }
        return Promise.resolve([]);
    };

    res = mockRes();
    await getBudget({
        user: { id: userA },
        query: {} // không truyền month!
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data['Other Expense'], 450000, 'When query.month is omitted, defaults to current month instead of stale global');
    console.log('✅ Test C-04 Passed: Default targetMonth fallback resolves current month budget correctly.\n');

    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });

    console.log('🎉 ALL CATEGORY C BACKEND TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
