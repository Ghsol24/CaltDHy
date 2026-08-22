const assert = require('assert');
const Transaction = require('../backEnd/server/models/Transaction');
const Jar = require('../backEnd/server/models/Jar');
const spendingRouter = require('../backEnd/server/routes/spending');
const jarsRouter = require('../backEnd/server/routes/jars');

const userId = '507f1f77bcf86cd799439011';
const transactionId = '507f191e810c19729de860ea';

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
    const update = routeHandler(spendingRouter, 'put', '/:id');
    let call;
    Transaction.findOneAndUpdate = async (...args) => {
        call = args;
        return { toJSON: () => ({ id: transactionId, date: '2026-08-22', amount: 50000 }) };
    };

    let res = response();
    await update({
        params: { id: transactionId },
        user: { id: userId },
        body: { type: 'expense', desc: ' Cà phê ', amount: '50000', category: 'Food & Dining', date: '2026-08-22' }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(call[0], { _id: transactionId, userId });
    assert.equal(call[1].desc, 'Cà phê');
    assert(call[1].date instanceof Date);
    assert.equal(call[1].date.toISOString().slice(0, 10), '2026-08-22');
    assert.equal(call[2].runValidators, true);

    res = response();
    await update({ params: { id: 'not-an-object-id' }, user: { id: userId }, body: {} }, res);
    assert.equal(res.statusCode, 400);
}

async function testJarRoutes() {
    const deposit = routeHandler(jarsRouter, 'patch', '/:id/deposit');
    const withdraw = routeHandler(jarsRouter, 'patch', '/:id/withdraw');
    let call;

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
    Jar.exists = async () => true;
    res = response();
    await withdraw({ params: { id: transactionId }, user: { id: userId }, body: { amount: '200' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(call[0].current.$gte, 200);

    res = response();
    await deposit({ params: { id: 'bad-id' }, user: { id: userId }, body: { amount: '10' } }, res);
    assert.equal(res.statusCode, 400);
}

function testTransactionSerialization() {
    const transaction = new Transaction({
        userId,
        type: 'income',
        amount: 100,
        category: 'Salary',
        date: new Date('2026-08-22T00:00:00.000Z')
    });
    assert.equal(transaction.toJSON().date, '2026-08-22');
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

(async () => {
    await testTransactionRoutes();
    await testJarRoutes();
    testTransactionSerialization();
    testEscapedRenderedNames();
    console.log('API and security regression checks passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
