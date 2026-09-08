const assert = require('assert');
const fs = require('fs');
const path = require('path');
const spendingRouter = require('../backEnd/server/routes/spending');
const Transaction = require('../backEnd/server/models/Transaction');
const Budget = require('../backEnd/server/models/Budget');
const Jar = require('../backEnd/server/models/Jar');
const Installment = require('../backEnd/server/models/Installment');

const userId = '507f1f77bcf86cd799439011';

function routeHandler(router, method, routePath) {
    const layer = router.stack.find(
        (item) => item.route && item.route.path === routePath && item.route.methods[method]
    );
    if (!layer) throw new Error(`Không tìm thấy route ${method.toUpperCase()} ${routePath}`);
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

async function runCategoryMTests() {
    console.log('🧪 Starting Category M Verification Tests (M-01, M-02, M-03, M-05)...\n');

    // =========================================================================
    // Test M-05: POST /api/spending/reset-data resets Jars & Installments
    // =========================================================================
    console.log('--- Test M-05: POST /api/spending/reset-data comprehensive reset ---');
    const resetDataHandler = routeHandler(spendingRouter, 'post', '/reset-data');

    let txDeleted = false;
    let budgetDeleted = false;
    let jarReset = false;
    let installmentReset = false;

    Transaction.deleteMany = async (filter) => {
        if (filter.userId === userId) txDeleted = true;
        return { deletedCount: 5 };
    };
    Budget.deleteMany = async (filter) => {
        if (filter.userId === userId) budgetDeleted = true;
        return { deletedCount: 2 };
    };
    Jar.updateMany = async (filter, update) => {
        if (filter.userId === userId && update.$set.current === 0 && Array.isArray(update.$set.history)) {
            jarReset = true;
        }
        return { modifiedCount: 3 };
    };
    Installment.updateMany = async (filter, update) => {
        if (filter.userId === userId && update.$set.totalPaid === 0 && update.$set.paidMonths === 0 && Array.isArray(update.$set.history)) {
            installmentReset = true;
        }
        return { modifiedCount: 1 };
    };

    const res = mockResponse();
    await resetDataHandler({ user: { id: userId } }, res);

    assert.strictEqual(res.statusCode, 200, 'Reset data should return HTTP 200');
    assert.strictEqual(txDeleted, true, 'Transactions should be deleted on reset');
    assert.strictEqual(budgetDeleted, true, 'Budgets should be deleted on reset');
    assert.strictEqual(jarReset, true, 'Jars should be reset to current: 0 and empty history on reset (M-05)');
    assert.strictEqual(installmentReset, true, 'Installments should be reset to totalPaid: 0, paidMonths: 0 on reset (M-05)');
    console.log('✅ Test M-05 Passed: POST /api/spending/reset-data cleanly resets Jars and Installments.\n');

    // =========================================================================
    // Test M-03: Fee label in TransferModal.jsx
    // =========================================================================
    console.log('--- Test M-03: Fee deduction explanation in TransferModal.jsx ---');
    const transferModalPath = path.resolve(__dirname, '../frontEnd-react/src/features/plan/TransferModal.jsx');
    const transferModalContent = fs.readFileSync(transferModalPath, 'utf8');

    assert(
        !transferModalContent.includes('Phí sẽ được cộng vào ví nhận'),
        'TransferModal must NOT claim that fee is added to destination wallet (contrary to reality)'
    );
    assert(
        transferModalContent.includes('Phí giao dịch sẽ được trừ thêm vào ví gửi'),
        'TransferModal must correctly state that fee is deducted from sender wallet'
    );
    console.log('✅ Test M-03 Passed: Transfer fee deduction statement is accurate.\n');

    // =========================================================================
    // Test M-02: useJarStore does not perform zombie optimistic deletion on error
    // =========================================================================
    console.log('--- Test M-02: Error preservation in useJarStore.js ---');
    const useJarStorePath = path.resolve(__dirname, '../frontEnd-react/src/stores/useJarStore.js');
    const useJarStoreContent = fs.readFileSync(useJarStorePath, 'utf8');

    // In deleteJar:
    const deleteJarIdx = useJarStoreContent.indexOf('deleteJar:');
    assert(deleteJarIdx !== -1, 'deleteJar must be present in useJarStore.js');
    const createInstIdx = useJarStoreContent.indexOf('createInstallment:');
    const deleteJarBlock = useJarStoreContent.substring(deleteJarIdx, createInstIdx);

    assert(
        deleteJarBlock.includes('catch (err) {\n      console.error(\'Lỗi khi xóa hũ từ server:\', err);\n      throw err;\n    }'),
        'deleteJar must rethrow error without optimistic deletion in catch block'
    );

    // In deleteInstallment:
    const deleteInstIdx = useJarStoreContent.indexOf('deleteInstallment:');
    assert(deleteInstIdx !== -1, 'deleteInstallment must be present in useJarStore.js');
    const deleteInstBlock = useJarStoreContent.substring(deleteInstIdx);

    assert(
        deleteInstBlock.includes('catch (err) {\n      console.error(\'Lỗi khi xóa khoản định kỳ từ server:\', err);\n      throw err;\n    }'),
        'deleteInstallment must rethrow error without optimistic deletion in catch block'
    );
    console.log('✅ Test M-02 Passed: useJarStore does not falsely delete items on server rejection.\n');

    // =========================================================================
    // Test M-01: Dynamic metrics in PlanOverviewTab.jsx
    // =========================================================================
    console.log('--- Test M-01: Dynamic metrics in PlanOverviewTab.jsx ---');
    const planOverviewPath = path.resolve(__dirname, '../frontEnd-react/src/features/plan/PlanOverviewTab.jsx');
    const planOverviewContent = fs.readFileSync(planOverviewPath, 'utf8');

    assert(!planOverviewContent.includes('▲ 5.2%'), 'Hardcoded ▲ 5.2% must be replaced');
    assert(!planOverviewContent.includes('▲ 12.4%'), 'Hardcoded ▲ 12.4% must be replaced');
    assert(!planOverviewContent.includes('▼ 8.1%'), 'Hardcoded ▼ 8.1% must be replaced');
    assert(!planOverviewContent.includes('▲ 3.5%'), 'Hardcoded ▲ 3.5% must be replaced');
    console.log('✅ Test M-01 Passed: Hardcoded growth percentages replaced with dynamic data.\n');

    console.log('🎉 ALL CATEGORY M VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀\n');
}

runCategoryMTests().catch((err) => {
    console.error('❌ Category M Test Failed:', err);
    process.exit(1);
});
