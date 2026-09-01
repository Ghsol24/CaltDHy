const assert = require('assert');
const Transaction = require('../backEnd/server/models/Transaction');
const Jar = require('../backEnd/server/models/Jar');
const Wallet = require('../backEnd/server/models/Wallet');
const Budget = require('../backEnd/server/models/Budget');
const spendingRouter = require('../backEnd/server/routes/spending');
const jarsRouter = require('../backEnd/server/routes/jars');
const walletsRouter = require('../backEnd/server/routes/wallets');

const userId = '507f1f77bcf86cd799439011';
const transactionId = '507f191e810c19729de860ea';
const wallet1Id = '507f1f77bcf86cd799439031';
const wallet2Id = '507f1f77bcf86cd799439032';

function routeHandler(router, method, routePath) {
    const layer = router.stack.find((item) => item.route && item.route.path === routePath && item.route.methods[method]);
    if (!layer) throw new Error(`Không tìm thấy route ${method.toUpperCase()} ${routePath}`);
    return layer.route.stack[0].handle;
}

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

async function testTransactionRoutes() {
    const create = routeHandler(spendingRouter, 'post', '/');
    const update = routeHandler(spendingRouter, 'put', '/:id');
    const jarId = '507f1f77bcf86cd799439022';
    let createCall;
    let updateCall;

    Wallet.findOne = async () => ({ _id: wallet1Id, isDefault: true });

    Transaction.create = async (...args) => {
        createCall = args;
        return { toJSON: () => ({ id: transactionId, date: '2026-08-22', amount: 50000, jarId }) };
    };

    let res = response();
    await create({
        user: { id: userId },
        body: { type: 'expense', desc: 'Nạp vào hũ', amount: '50000', category: 'Savings', date: '2026-08-22', jarId }
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(createCall[0].jarId.toString(), jarId);

    // Test temporary walletId 'w_default_cash' auto-resolves to user default wallet
    res = response();
    await create({
        user: { id: userId },
        body: { type: 'expense', desc: 'Cơm trưa', amount: '35000', category: 'Food & Dining', date: '2026-08-22', walletId: 'w_default_cash' }
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(createCall[0].walletId.toString(), wallet1Id, 'Temporary wallet ID should be resolved to default wallet ObjectId');

    Transaction.findOne = async () => ({ _id: transactionId, userId, type: 'expense', walletId: wallet1Id });
    Transaction.findOneAndUpdate = async (...args) => {
        updateCall = args;
        return { toJSON: () => ({ id: transactionId, date: '2026-08-22', amount: 50000, jarId }) };
    };

    res = response();
    await update({
        params: { id: transactionId },
        user: { id: userId },
        body: { type: 'expense', desc: ' Cà phê ', amount: '50000', category: 'Food & Dining', date: '2026-08-22', jarId }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(updateCall[0], { _id: transactionId, userId });
    assert.equal(updateCall[1].desc, 'Cà phê');
    assert.equal(updateCall[1].jarId.toString(), jarId);
    assert(updateCall[1].date instanceof Date);
    assert.equal(updateCall[1].date.toISOString().slice(0, 10), '2026-08-22');
    assert.equal(updateCall[2].runValidators, true);

    res = response();
    await update({ params: { id: 'not-an-object-id' }, user: { id: userId }, body: {} }, res);
    assert.equal(res.statusCode, 400);
}

async function testJarRoutes() {
    const deposit = routeHandler(jarsRouter, 'patch', '/:id/deposit');
    const withdraw = routeHandler(jarsRouter, 'patch', '/:id/withdraw');
    const deleteJar = routeHandler(jarsRouter, 'delete', '/:id');
    let call;
    let deleteManyCall;

    Jar.findOneAndUpdate = async (...args) => {
        call = args;
        return { toJSON: () => ({ id: transactionId, current: 125 }) };
    };

    let res = response();
    await deposit({ params: { id: transactionId }, user: { id: userId }, body: { amount: '25', reason: '  Savings  ' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(call[1].$inc, { current: 25 });
    assert.equal(call[1].$push.history.$position, 0);
    assert.equal(call[1].$push.history.$slice, 200);
    assert.equal(call[1].$push.history.$each[0].reason, 'Savings');

    Jar.findOneAndUpdate = async (...args) => { call = args; return null; };
    Jar.findOne = async () => ({ _id: transactionId, userId });
    Jar.exists = async () => true;
    res = response();
    await withdraw({ params: { id: transactionId }, user: { id: userId }, body: { amount: '200' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(call[0].current.$gte, 200);

    res = response();
    await deposit({ params: { id: 'bad-id' }, user: { id: userId }, body: { amount: '10' } }, res);
    assert.equal(res.statusCode, 400);

    // Test cascade delete of transactions when jar is deleted
    Jar.findOneAndDelete = async () => ({ _id: transactionId });
    Transaction.deleteMany = async (...args) => { deleteManyCall = args; return { deletedCount: 3 }; };
    res = response();
    await deleteJar({ params: { id: transactionId }, user: { id: userId } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(deleteManyCall[0], { jarId: transactionId, userId });
}

function testTransactionSerialization() {
    const jarId = '507f1f77bcf86cd799439022';
    const transaction = new Transaction({
        userId,
        type: 'income',
        amount: 100,
        category: 'Salary',
        date: new Date('2026-08-22T00:00:00.000Z'),
        jarId
    });
    assert.equal(transaction.toJSON().date, '2026-08-22');
    assert.equal(transaction.toJSON().jarId, jarId);
}

function testEscapedRenderedNames() {
    const fs = require('fs');
    const source = fs.readFileSync(require('path').resolve(__dirname, '../frontEnd/spending.js'), 'utf8');
    const jars = source.slice(source.indexOf('function renderJarCards()'), source.indexOf('function formatTimelineDate('));
    const installments = source.slice(source.indexOf('function renderInstallmentList()'), source.indexOf('/* ============================================================', source.indexOf('function renderInstallmentList()')));
    assert.match(jars, /const capName = escHtml\(jar\.name\.charAt\(0\)\.toUpperCase\(\) \+ jar\.name\.slice\(1\)\);/);
    assert.doesNotMatch(jars, /\$\{jar\.name\}/);
    assert.match(installments, /const capName = escHtml\(inst\.name\.charAt\(0\)\.toUpperCase\(\) \+ inst\.name\.slice\(1\)\);/);
}

function testEvalMathExpression() {
    const fs = require('fs');
    const source = fs.readFileSync(require('path').resolve(__dirname, '../frontEnd/spending.js'), 'utf8');
    const vm = require('vm');
    const ctx = { Math, parseFloat, parseInt, isNaN, isFinite, String, Intl };
    vm.createContext(ctx);
    
    const tokenFn = source.slice(source.indexOf('function normalizeNumberToken('), source.indexOf('function evalMathExpression('));
    const evalFn = source.slice(source.indexOf('function evalMathExpression('), source.indexOf('function fmt(n)'));
    vm.runInContext(tokenFn + '\n' + evalFn, ctx);
    
    assert.equal(ctx.evalMathExpression('50.000'), 50000, '50.000 should parse to 50000 (Vietnamese thousands separator)');
    assert.equal(ctx.evalMathExpression('50,000'), 50000, '50,000 should parse to 50000');
    assert.equal(ctx.evalMathExpression('1.500.000'), 1500000, '1.500.000 should parse to 1500000');
    assert.equal(ctx.evalMathExpression('50.000 + 20.000'), 70000, '50.000 + 20.000 should evaluate to 70000');
    assert.equal(ctx.evalMathExpression('50k'), 50000, '50k should parse to 50000');
    assert.equal(ctx.evalMathExpression('1.5tr'), 1500000, '1.5tr should parse to 1500000');
    assert.equal(ctx.evalMathExpression('10.5'), 10.5, '10.5 should parse to 10.5 (decimal)');
    assert.equal(ctx.evalMathExpression('10,5'), 10.5, '10,5 should parse to 10.5 (decimal)');
}

function testOfflineQueueIntegrity() {
    const fs = require('fs');
    const source = fs.readFileSync(require('path').resolve(__dirname, '../frontEnd/spending.js'), 'utf8');
    assert(source.includes("const PENDING_ADDS_KEY = 'caltdhy_pending_adds'"));
    assert(source.includes("const PENDING_DELETES_KEY = 'caltdhy_pending_deletes'"));
    assert(source.includes('function loadOfflineQueues()'));
    assert(source.includes('function persistOfflineQueues()'));
}

function testJarAtomicRollbackAndCascade() {
    const fs = require('fs');
    const source = fs.readFileSync(require('path').resolve(__dirname, '../frontEnd/spending.js'), 'utf8');
    assert(source.includes('// Rollback số dư hũ'));
    assert(source.includes('// 2. Cascade delete: Dọn sạch tất cả giao dịch liên quan đến hũ này'));
}

function testAdvanceNextDueDateClamping() {
    const fs = require('fs');
    const source = fs.readFileSync(require('path').resolve(__dirname, '../frontEnd/spending.js'), 'utf8');
    const vm = require('vm');
    const ctx = { Math, parseInt, String, Date };
    vm.createContext(ctx);

    const fnCode = source.slice(source.indexOf('function advanceNextDueDate('), source.indexOf('function cycleLabel('));
    vm.runInContext(fnCode, ctx);

    // 1. End of Jan to Feb non-leap
    assert.equal(ctx.advanceNextDueDate('2026-01-31', 'monthly'), '2026-02-28', 'Jan 31 -> Feb 28 on 2026 (non-leap)');
    // 2. End of Jan to Feb leap year
    assert.equal(ctx.advanceNextDueDate('2024-01-31', 'monthly'), '2024-02-29', 'Jan 31 -> Feb 29 on 2024 (leap year)');
    // 3. 31st to 30-day month (Mar 31 -> Apr 30)
    assert.equal(ctx.advanceNextDueDate('2026-03-31', 'monthly'), '2026-04-30', 'Mar 31 -> Apr 30');
    // 4. May 31 -> Jun 30
    assert.equal(ctx.advanceNextDueDate('2026-05-31', 'monthly'), '2026-06-30', 'May 31 -> Jun 30');
    // 5. Aug 31 -> Sep 30
    assert.equal(ctx.advanceNextDueDate('2026-08-31', 'monthly'), '2026-09-30', 'Aug 31 -> Sep 30');
    // 6. Oct 31 -> Nov 30
    assert.equal(ctx.advanceNextDueDate('2026-10-31', 'monthly'), '2026-11-30', 'Oct 31 -> Nov 30');
    // 7. Dec 31 -> Jan 31 next year
    assert.equal(ctx.advanceNextDueDate('2026-12-31', 'monthly'), '2027-01-31', 'Dec 31 -> Jan 31');
    // 8. Quarterly clamping: Nov 30 -> Feb 28
    assert.equal(ctx.advanceNextDueDate('2025-11-30', 'quarterly'), '2026-02-28', 'Nov 30 -> Feb 28 quarterly');
    // 9. Yearly clamping: Feb 29 leap -> Feb 28 non-leap
    assert.equal(ctx.advanceNextDueDate('2024-02-29', 'yearly'), '2025-02-28', 'Feb 29 -> Feb 28 yearly');
}

async function testInstallmentRoutes() {
    const pay = routeHandler(jarsRouter, 'patch', '/installments/:id/pay');
    const deleteInst = routeHandler(jarsRouter, 'delete', '/installments/:id');
    const Installment = require('../backEnd/server/models/Installment');
    let deleteManyCall;

    const mockItem = {
        _id: transactionId,
        userId,
        amount: 250000,
        cycle: 'monthly',
        nextDueDate: '2026-01-31',
        totalPaid: 0,
        history: [],
        save: async () => {},
        toJSON() {
            return {
                id: this._id.toString(),
                nextDueDate: this.nextDueDate,
                totalPaid: this.totalPaid,
                history: this.history
            };
        }
    };

    Installment.findOne = async () => mockItem;

    let res = response();
    await pay({ params: { id: transactionId }, user: { id: userId } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(mockItem.nextDueDate, '2026-02-28', 'Backend pay route must clamp 31/1 to 28/2');
    assert.equal(mockItem.totalPaid, 250000);
    assert.equal(mockItem.history.length, 1);
    assert.equal(mockItem.history[0].amount, 250000);
    assert.equal(mockItem.history[0].cycleDate, '2026-01-31');

    // Test cascade delete of transactions when installment is deleted
    Installment.findOneAndDelete = async () => ({ _id: transactionId });
    Transaction.deleteMany = async (...args) => { deleteManyCall = args; return { deletedCount: 2 }; };
    res = response();
    await deleteInst({ params: { id: transactionId }, user: { id: userId } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(deleteManyCall[0], { installmentId: transactionId, userId });
}

function testDuplicateTransactionDetection() {
    const fs = require('fs');
    const source = fs.readFileSync(require('path').resolve(__dirname, '../frontEnd/spending.js'), 'utf8');
    const vm = require('vm');
    const ctx = {
        Date,
        transactions: [
            { id: '1', amount: 50000, category: 'Food', date: '2026-08-24', createdAt: new Date(Date.now() - 30 * 1000).toISOString() }, // 30s ago
            { id: '2', amount: 100000, category: 'Coffee', date: '2026-08-24', createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() } // 10m ago
        ]
    };
    vm.createContext(ctx);

    const fnCode = source.slice(source.indexOf('function detectDuplicateTransaction('), source.indexOf('function showConfirmToast('));
    vm.runInContext(fnCode, ctx);

    // Matches txn 1 within 5m
    const dup1 = ctx.detectDuplicateTransaction(50000, 'Food', '2026-08-24');
    assert(dup1 !== null, 'Should detect duplicate transaction created 30s ago');
    assert.equal(dup1.id, '1');

    // Does not match different amount
    const noDup1 = ctx.detectDuplicateTransaction(60000, 'Food', '2026-08-24');
    assert(noDup1 === null, 'Different amount should not be duplicate');

    // Does not match different category
    const noDup2 = ctx.detectDuplicateTransaction(50000, 'Transport', '2026-08-24');
    assert(noDup2 === null, 'Different category should not be duplicate');

    // Does not match outside 5 min window (txn 2 is 10 min ago)
    const noDup3 = ctx.detectDuplicateTransaction(100000, 'Coffee', '2026-08-24');
    assert(noDup3 === null, 'Transaction older than 5m should not be duplicate');
}

async function testWalletRoutes() {
    const listWallets = routeHandler(walletsRouter, 'get', '/');
    const createWallet = routeHandler(walletsRouter, 'post', '/');
    const updateWallet = routeHandler(walletsRouter, 'put', '/:id');
    const deleteWallet = routeHandler(walletsRouter, 'delete', '/:id');

    let createdData;
    let updatedData;
    let reassignedTxns;

    Wallet.countDocuments = async () => 0;
    Wallet.create = async (payload) => {
        createdData = payload;
        return {
            toJSON: () => ({ id: wallet1Id, ...payload, userId: payload.userId.toString() })
        };
    };
    Wallet.find = () => ({
        sort: () => [{ toJSON: () => ({ id: wallet1Id, name: 'Tiền mặt', type: 'cash', isDefault: true }) }]
    });

    // Test GET /api/wallets auto provisions default wallet
    let res = response();
    await listWallets({ user: { id: userId } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].name, 'Tiền mặt');
    assert.equal(createdData.name, 'Tiền mặt');
    assert.equal(createdData.isDefault, true);

    // Test POST /api/wallets
    res = response();
    await createWallet({
        user: { id: userId },
        body: { name: 'Vietcombank', type: 'bank', icon: '🏦', color: '#3498db', initialBalance: 5000000 }
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(createdData.name, 'Vietcombank');
    assert.equal(createdData.type, 'bank');
    assert.equal(createdData.initialBalance, 5000000);

    // Test PUT /api/wallets/:id
    Wallet.findOne = async () => ({
        _id: wallet1Id,
        userId,
        name: 'Tiền mặt',
        isDefault: false,
        save: async () => true,
        toJSON: () => ({ id: wallet1Id, name: 'Tiền mặt cập nhật' })
    });
    Wallet.updateMany = async () => true;

    res = response();
    await updateWallet({
        params: { id: wallet1Id },
        user: { id: userId },
        body: { name: 'Tiền mặt cập nhật', isDefault: true }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.name, 'Tiền mặt cập nhật');

    // Test DELETE /api/wallets/:id cascade reassigns transactions to default wallet
    Wallet.countDocuments = async () => 2;
    Wallet.findOne = async (query) => {
        if (query._id === wallet2Id) return { _id: wallet2Id, name: 'Ví cần xóa' };
        return { _id: wallet1Id, name: 'Tiền mặt', isDefault: true, save: async () => true };
    };
    Wallet.findOneAndDelete = async () => true;
    Transaction.updateMany = async (...args) => {
        reassignedTxns = args;
        return true;
    };

    res = response();
    await deleteWallet({ params: { id: wallet2Id }, user: { id: userId } }, res);
    assert.equal(res.statusCode, 200);
    assert(reassignedTxns !== undefined, 'Transactions must be reassigned when wallet is deleted');
}

function testWalletCalculations() {
    const wallets = [
        { id: 'w1', name: 'Tiền mặt', initialBalance: 1000000, isExcludedFromTotal: false },
        { id: 'w2', name: 'Vietcombank', initialBalance: 5000000, isExcludedFromTotal: false },
        { id: 'w3', name: 'Tiết kiệm', initialBalance: 10000000, isExcludedFromTotal: true }
    ];

    const transactions = [
        { id: 't1', type: 'expense', amount: 200000, walletId: 'w1' }, // Tiền mặt -200k = 800k
        { id: 't2', type: 'income', amount: 3000000, walletId: 'w2' },  // VCB +3tr = 8tr
        { id: 't3', type: 'transfer', amount: 500000, fee: 5000, walletId: 'w2', toWalletId: 'w1' } // Chuyển 500k từ VCB sang Tiền mặt (phí 5k)
    ];

    function calcWalletBalance(wid) {
        const w = wallets.find(item => item.id === wid);
        if (!w) return 0;
        let bal = w.initialBalance || 0;
        transactions.forEach(t => {
            if (t.walletId === wid) {
                if (t.type === 'income') bal += t.amount;
                else if (t.type === 'expense') bal -= t.amount;
                else if (t.type === 'transfer') bal -= (t.amount + (t.fee || 0));
            }
            if (t.toWalletId === wid && t.type === 'transfer') {
                bal += t.amount;
            }
        });
        return bal;
    }

    function calcTotalNetWorth() {
        return wallets
            .filter(w => !w.isExcludedFromTotal)
            .reduce((sum, w) => sum + calcWalletBalance(w.id), 0);
    }

    // Tiền mặt: 1,000,000 - 200,000 + 500,000 = 1,300,000
    assert.equal(calcWalletBalance('w1'), 1300000, 'Wallet 1 balance calculation');

    // Vietcombank: 5,000,000 + 3,000,000 - (500,000 + 5,000) = 7,495,000
    assert.equal(calcWalletBalance('w2'), 7495000, 'Wallet 2 balance calculation');

    // Tiết kiệm: 10,000,000
    assert.equal(calcWalletBalance('w3'), 10000000, 'Wallet 3 balance calculation');

    // Total Net Worth (excludes w3): 1,300,000 + 7,495,000 = 8,795,000
    assert.equal(calcTotalNetWorth(), 8795000, 'Total Net Worth calculation');
}

async function testBudgetRoutes() {
    const getBudget = routeHandler(spendingRouter, 'get', '/budget');
    const updateBudget = routeHandler(spendingRouter, 'put', '/budget');

    // Test GET /api/spending/budget
    Budget.find = async (query) => {
        assert.equal(query.userId, userId);
        return [
            { category: 'Food & Dining', limit: 2000000 },
            { category: 'Transport', limit: 500000 }
        ];
    };

    let res = response();
    await getBudget({ user: { id: userId } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, {
        'Food & Dining': 2000000,
        'Transport': 500000
    });

    // Test PUT /api/spending/budget (Verifying atomic bulkWrite upsert & deleteMany for missing categories)
    let bulkOpsCalled;
    let deleteManyCalled;

    Budget.bulkWrite = async (ops) => {
        bulkOpsCalled = ops;
        return { ok: 1 };
    };
    Budget.deleteMany = async (query) => {
        deleteManyCalled = query;
        return { ok: 1 };
    };

    res = response();
    await updateBudget({
        user: { id: userId },
        body: {
            'Food & Dining': 3000000,
            'Shopping': 1000000,
            'DisabledCat': 0 // Should not be in bulkWrite upsert
        }
    }, res);

    assert.equal(res.statusCode, 200);
    assert(Array.isArray(bulkOpsCalled), 'bulkWrite must be called with an array of operations');
    assert.equal(bulkOpsCalled.length, 2, 'Only valid positive limits should be bulk upserted');
    assert.deepEqual(bulkOpsCalled[0], {
        updateOne: {
            filter: { userId, category: 'Food & Dining' },
            update: { $set: { limit: 3000000 } },
            upsert: true
        }
    });
    assert.deepEqual(bulkOpsCalled[1], {
        updateOne: {
            filter: { userId, category: 'Shopping' },
            update: { $set: { limit: 1000000 } },
            upsert: true
        }
    });
    assert.deepEqual(deleteManyCalled, {
        userId,
        category: { $nin: ['Food & Dining', 'Shopping'] }
    });
}

async function testLinkedInstallmentAtomicRollback() {
    const fs = require('fs');
    const source = fs.readFileSync(require('path').resolve(__dirname, '../frontEnd/spending.js'), 'utf8');
    const vm = require('vm');

    const ctx = {
        Date,
        window: {},
        isServerConnected: true,
        transactions: [],
        installments: [
            {
                id: 'inst_1',
                name: 'Trả góp Macbook',
                amount: 2000000,
                cycle: 'monthly',
                nextDueDate: '2026-08-25',
                totalPaid: 4000000,
                history: [{ amount: 2000000, paidDate: '2026-07-25', cycleDate: '2026-07-25', date: '2026-07-25T00:00:00.000Z' }]
            }
        ],
        saveTransactions: () => {},
        saveInstallments: () => {},
        closeModal: () => {},
        triggerUIUpdates: () => {},
        showToast: () => {},
        todayISO: () => '2026-08-24',
        t: (k) => k,
        syncPayInstallmentToServer: async () => false // Simulate server error
    };
    vm.createContext(ctx);

    // Extract advanceNextDueDate and _commitNewTransaction
    const advanceNextDueDateCode = source.slice(source.indexOf('function advanceNextDueDate('), source.indexOf('function cycleLabel('));
    const commitCode = source.slice(source.indexOf('async function _commitNewTransaction('), source.indexOf('function showFormError('));

    vm.runInContext(advanceNextDueDateCode, ctx);
    vm.runInContext(commitCode, ctx);

    const txn = {
        id: 'txn_test_1',
        type: 'expense',
        desc: 'Thanh toán: Trả góp Macbook',
        amount: 2000000,
        category: 'Installment',
        date: '2026-08-24',
        installmentId: 'inst_1'
    };

    // When sync fails, _commitNewTransaction should rollback nextDueDate, totalPaid, history, and txn
    await ctx._commitNewTransaction(txn, 'Installment', 'inst_1', 2000000);

    const inst = ctx.installments[0];
    assert.equal(inst.nextDueDate, '2026-08-25', 'nextDueDate should rollback on sync failure');
    assert.equal(inst.totalPaid, 4000000, 'totalPaid should rollback on sync failure');
    assert.equal(inst.history.length, 1, 'history entry should rollback on sync failure');
    assert.equal(ctx.transactions.length, 0, 'Transaction should rollback from transactions array on sync failure');
}

async function testJarLinkedTransactionGuard() {
    // PUT /:id và DELETE /:id phải CHẶN nếu giao dịch hiện tại đã gắn jarId/installmentId
    // (do Hũ/Khoản định kỳ tự sinh ra) — sửa/xóa trực tiếp sẽ làm lệch Jar.current /
    // Installment.totalPaid so với Transaction thật. Xem docs/financial-transaction-rules.md.
    const update = routeHandler(spendingRouter, 'put', '/:id');
    const del = routeHandler(spendingRouter, 'delete', '/:id');
    const jarId = '507f1f77bcf86cd799439022';
    const installmentId = '507f1f77bcf86cd799439099';
    let deleteOneCalled = false;

    // --- Bị chặn: giao dịch gắn jarId ---
    Transaction.findOne = async () => ({ _id: transactionId, userId, type: 'transfer', jarId, installmentId: null });
    let res = response();
    await update({ params: { id: transactionId }, user: { id: userId }, body: { type: 'transfer', amount: '50000', category: 'x', date: '2026-08-22' } }, res);
    assert.equal(res.statusCode, 400, 'PUT phải trả 400 cho giao dịch gắn jarId');
    assert(/Hũ/.test(res.body.message), 'Thông báo lỗi phải nhắc tới Hũ');

    deleteOneCalled = false;
    Transaction.deleteOne = async () => { deleteOneCalled = true; };
    res = response();
    await del({ params: { id: transactionId }, user: { id: userId } }, res);
    assert.equal(res.statusCode, 400, 'DELETE phải trả 400 cho giao dịch gắn jarId');
    assert.equal(deleteOneCalled, false, 'Không được gọi deleteOne khi bị chặn');

    // --- Bị chặn: giao dịch gắn installmentId ---
    Transaction.findOne = async () => ({ _id: transactionId, userId, type: 'expense', jarId: null, installmentId });
    res = response();
    await update({ params: { id: transactionId }, user: { id: userId }, body: { type: 'expense', amount: '50000', category: 'x', date: '2026-08-22' } }, res);
    assert.equal(res.statusCode, 400, 'PUT phải trả 400 cho giao dịch gắn installmentId');
    assert(/Khoản định kỳ/.test(res.body.message), 'Thông báo lỗi phải nhắc tới Khoản định kỳ');

    deleteOneCalled = false;
    res = response();
    await del({ params: { id: transactionId }, user: { id: userId } }, res);
    assert.equal(res.statusCode, 400, 'DELETE phải trả 400 cho giao dịch gắn installmentId');
    assert.equal(deleteOneCalled, false, 'Không được gọi deleteOne khi bị chặn');

    // --- Vẫn cho phép: giao dịch thường, không gắn jarId/installmentId ---
    Transaction.findOne = async () => ({ _id: transactionId, userId, type: 'expense', jarId: null, installmentId: null });
    deleteOneCalled = false;
    res = response();
    await del({ params: { id: transactionId }, user: { id: userId } }, res);
    assert.equal(res.statusCode, 200, 'DELETE phải cho phép với giao dịch thường');
    assert.equal(deleteOneCalled, true, 'Phải gọi deleteOne với giao dịch thường');
}

(async () => {
    await testTransactionRoutes();
    await testJarLinkedTransactionGuard();
    await testJarRoutes();
    await testInstallmentRoutes();
    await testWalletRoutes();
    await testBudgetRoutes();
    testWalletCalculations();
    testTransactionSerialization();

    const fs = require('fs');
    const hasLegacyFrontend = fs.existsSync(require('path').resolve(__dirname, '../frontEnd/spending.js'));
    if (hasLegacyFrontend) {
        await testLinkedInstallmentAtomicRollback();
        testEscapedRenderedNames();
        testEvalMathExpression();
        testOfflineQueueIntegrity();
        testJarAtomicRollbackAndCascade();
        testAdvanceNextDueDateClamping();
        testDuplicateTransactionDetection();
    } else {
        console.log('[Note] Legacy frontEnd/spending.js migrated to React; skipped vanilla DOM checks.');
    }
    console.log('All API contracts (including Budget bulkWrite & atomic rollbacks), Multi-Wallet, Transfer, date clamping, history tracking, cascade delete, and duplicate detection tests passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
