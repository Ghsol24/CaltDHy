import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, ok, fail, deferred, metrics, inThisMonth, invalidateSession,
  THIS_MONTH, OLD_MONTH,
  useTransactionStore, useWalletStore, useSpendingStore, useToastStore
} from './helpers/store-harness.mjs';

const store = () => useTransactionStore.getState();

// What the server sends: Mongo ids, ISO dates, populated wallet references.
const serverTxn = (overrides = {}) => ({
  _id: 't1', type: 'expense', desc: 'Cà phê', amount: 30000, category: 'Food & Dining',
  date: `${inThisMonth('05')}T00:00:00.000Z`, walletId: 'w1', ...overrides
});

const ledger = [
  serverTxn({ _id: 'salary', type: 'income', amount: 10_000_000, category: 'Salary', date: `${inThisMonth('01')}T00:00:00.000Z` }),
  serverTxn({ _id: 'lunch', type: 'expense', amount: 200_000, fee: 5_000, date: `${inThisMonth('02')}T00:00:00.000Z` }),
  serverTxn({ _id: 'old-income', type: 'income', amount: 1_000_000, date: `${OLD_MONTH}-10T00:00:00.000Z` }),
  serverTxn({ _id: 'old-expense', type: 'expense', amount: 300_000, fee: 1_000, date: `${OLD_MONTH}-11T00:00:00.000Z` }),
  serverTxn({ _id: 'move', type: 'transfer', amount: 4_000_000, fee: 2_000, toWalletId: 'w2', date: `${inThisMonth('03')}T00:00:00.000Z` })
];

test('loading transactions normalises server records for the screens', async (t) => {
  setup(t, { 'GET /api/spending': () => ok([
    serverTxn({ _id: 'a', walletId: { _id: 'w1', name: 'Tiền mặt' }, toWalletId: { _id: 'w2' }, fee: '1500', amount: '30000' }),
    { id: 'b', type: 'income', amount: 5000, category: 'Salary' }
  ]) });

  const result = await store().fetchTransactions();

  assert.equal(result.success, true);
  assert.deepEqual(store().transactions[0], {
    id: 'a', type: 'expense', desc: 'Cà phê', amount: 30000, category: 'Food & Dining',
    date: inThisMonth('05'), walletId: 'w1', toWalletId: 'w2', fee: 1500,
    jarId: null, installmentId: null, systemGenerated: false,
    tags: [], note: '', splitGroupId: null
  });
  assert.deepEqual(store().transactions[1], {
    id: 'b', type: 'income', desc: '', amount: 5000, category: 'Salary',
    date: '', walletId: null, toWalletId: null, fee: 0,
    jarId: null, installmentId: null, systemGenerated: false,
    tags: [], note: '', splitGroupId: null
  });
  assert.equal(store().isLoading, false);
  assert.equal(store().hasLoadedTransactions, true);
});

test('the balance counts every month; income and expense count only this month; fees are spending', async (t) => {
  setup(t, { 'GET /api/spending': () => ok(ledger) });

  await store().fetchTransactions();

  assert.deepEqual(metrics(), {
    // 10,000,000 + 1,000,000 − (200,000 + 5,000) − (300,000 + 1,000)
    balance: 10_494_000,
    income: 10_000_000,
    expense: 205_000
  });
});

test('a transfer between wallets is neither income nor expense and leaves the balance alone', async (t) => {
  setup(t, { 'GET /api/spending': () => ok([ledger[4]]) });

  await store().fetchTransactions();

  assert.deepEqual(metrics(), { balance: 0, income: 0, expense: 0 });
});

test('a failed load reports the error, keeps the previous list and stops the spinner', async (t) => {
  const api = setup(t, { 'GET /api/spending': () => ok([serverTxn()]) });
  await store().fetchTransactions();
  api.routes['GET /api/spending'] = () => fail(500, 'boom');

  const result = await store().fetchTransactions();

  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.equal(store().error, result.error);
  assert.equal(store().isLoading, false);
  assert.equal(store().hasLoadedTransactions, true);
  assert.deepEqual(store().transactions.map((txn) => txn.id), ['t1']);
  assert.deepEqual(metrics(), { balance: -30000, income: 0, expense: 30000 });
});

test('adding a transaction puts it first, updates the totals and the wallet balance', async (t) => {
  const api = setup(t, {
    'GET /api/spending': () => ok([ledger[0]]),
    'GET /api/wallets': () => ok([{ _id: 'w1', name: 'Tiền mặt', initialBalance: 500_000 }]),
    'POST /api/spending': ({ body }) => ok({ _id: 'new', ...body })
  });
  await store().fetchTransactions();
  await useWalletStore.getState().fetchWallets();
  assert.equal(useWalletStore.getState().wallets[0].currentBalance, 10_500_000);

  const payload = { type: 'expense', amount: 120_000, fee: 3_000, category: 'Shopping', date: inThisMonth('04'), walletId: 'w1', desc: 'Áo' };
  const result = await store().addTransaction(payload);

  assert.deepEqual(api.sent('POST /api/spending')[0].body, payload);
  assert.equal(result.data.id, 'new');
  assert.deepEqual(store().transactions.map((txn) => txn.id), ['new', 'salary']);
  assert.deepEqual(metrics(), { balance: 9_877_000, income: 10_000_000, expense: 123_000 });
  assert.equal(useWalletStore.getState().wallets[0].currentBalance, 10_377_000);
  assert.equal(store().isLoading, false);
});

test('a rejected add throws, changes nothing and stops the spinner', async (t) => {
  setup(t, {
    'GET /api/spending': () => ok([ledger[0]]),
    'POST /api/spending': () => fail(400, 'Số tiền không hợp lệ.')
  });
  await store().fetchTransactions();
  const before = metrics();

  await assert.rejects(store().addTransaction({ type: 'expense', amount: -1 }), { status: 400 });

  assert.deepEqual(store().transactions.map((txn) => txn.id), ['salary']);
  assert.deepEqual(metrics(), before);
  assert.equal(store().isLoading, false);
  assert.ok(store().error);
});

test('editing a transaction replaces it in place, recomputes the totals and closes the editor', async (t) => {
  const api = setup(t, {
    'GET /api/spending': () => ok([ledger[0], ledger[1]]),
    'PUT /api/spending/lunch': ({ body }) => ok({ ...ledger[1], ...body })
  });
  await store().fetchTransactions();
  store().openEditTransaction(store().transactions[1]);

  await store().updateTransaction('lunch', { amount: 500_000, fee: 0 });

  assert.deepEqual(api.sent('PUT /api/spending/lunch')[0].body, { amount: 500_000, fee: 0 });
  assert.deepEqual(store().transactions.map((txn) => [txn.id, txn.amount]), [['salary', 10_000_000], ['lunch', 500_000]]);
  assert.deepEqual(metrics(), { balance: 9_500_000, income: 10_000_000, expense: 500_000 });
  assert.equal(store().editingTransaction, null);
});

test('changing an expense into income moves it between the totals', async (t) => {
  setup(t, {
    'GET /api/spending': () => ok([ledger[1]]),
    'PUT /api/spending/lunch': ({ body }) => ok({ ...ledger[1], ...body })
  });
  await store().fetchTransactions();
  assert.deepEqual(metrics(), { balance: -205_000, income: 0, expense: 205_000 });

  await store().updateTransaction('lunch', { type: 'income', fee: 0 });

  assert.deepEqual(metrics(), { balance: 200_000, income: 200_000, expense: 0 });
});

test('a rejected edit throws and keeps the original transaction and the open editor', async (t) => {
  setup(t, {
    'GET /api/spending': () => ok([ledger[1]]),
    'PUT /api/spending/lunch': () => fail(400, 'Không thể sửa.')
  });
  await store().fetchTransactions();
  const original = store().transactions[0];
  store().openEditTransaction(original);

  await assert.rejects(store().updateTransaction('lunch', { amount: 1 }), { status: 400 });

  assert.deepEqual(store().transactions, [original]);
  assert.equal(store().editingTransaction, original);
  assert.equal(store().isLoading, false);
});

test('deleting removes the transaction and its effect; undo restores it once under the same id', async (t) => {
  setup(t, {
    'GET /api/spending': () => ok([ledger[0], ledger[1]]),
    'DELETE /api/spending/lunch': () => ok(null),
    'POST /api/spending/lunch/restore': () => ok(ledger[1])
  });
  await store().fetchTransactions();

  await store().deleteTransaction('lunch');
  assert.deepEqual(store().transactions.map((txn) => txn.id), ['salary']);
  assert.deepEqual(metrics(), { balance: 10_000_000, income: 10_000_000, expense: 0 });

  const restored = await store().restoreTransaction('lunch');
  assert.equal(restored.data.id, 'lunch');
  await store().restoreTransaction('lunch');
  assert.deepEqual(store().transactions.map((txn) => txn.id).sort(), ['lunch', 'salary']);
  assert.deepEqual(metrics(), { balance: 9_795_000, income: 10_000_000, expense: 205_000 });
});

test('a rejected delete throws and keeps the transaction', async (t) => {
  setup(t, {
    'GET /api/spending': () => ok([ledger[1]]),
    'DELETE /api/spending/lunch': () => fail(409, 'Không thể xóa.')
  });
  await store().fetchTransactions();

  await assert.rejects(store().deleteTransaction('lunch'), { status: 409 });

  assert.deepEqual(store().transactions.map((txn) => txn.id), ['lunch']);
  assert.equal(metrics().expense, 205_000);
});

test('undoing an add deletes it and tells the person; without an id it does nothing', async (t) => {
  const api = setup(t, {
    'GET /api/spending': () => ok([ledger[1]]),
    'DELETE /api/spending/lunch': () => ok(null)
  });
  await store().fetchTransactions();

  await store().undoAddTransaction(undefined);
  assert.equal(api.sent('DELETE /api/spending/lunch').length, 0);

  await store().undoAddTransaction('lunch');
  assert.deepEqual(store().transactions, []);
  assert.equal(useToastStore.getState().toasts.length, 1);
  assert.equal(useToastStore.getState().toasts[0].type, 'info');
});

test('resetting financial data empties the ledger, limits and totals, and wallets return to their opening balance', async (t) => {
  setup(t, {
    'GET /api/spending': () => ok([ledger[0], ledger[1]]),
    'GET /api/wallets': () => ok([{ _id: 'w1', initialBalance: 500_000 }], { history: [{ id: 'h1' }] }),
    'GET /api/spending/budget': () => ok({ Shopping: 1_000_000 }),
    'GET /api/spending/categories': () => ok(['Shopping']),
    'POST /api/spending/reset-data': () => ok(null)
  });
  await store().fetchTransactions();
  await useWalletStore.getState().fetchWallets();
  await store().fetchBudgets();
  const version = store().financialResetVersion;

  await store().resetAllFinancialData();

  assert.deepEqual(store().transactions, []);
  assert.deepEqual(store().budgets, {});
  assert.equal(store().budgetMonth, null);
  assert.deepEqual(store().budgetsByMonth, {});
  assert.equal(store().financialResetVersion, version + 1);
  assert.deepEqual(metrics(), { balance: 0, income: 0, expense: 0 });
  assert.equal(useWalletStore.getState().wallets[0].currentBalance, 500_000);
  assert.deepEqual(useWalletStore.getState().walletHistory, []);
});

test('an answer that arrives after the account changed is not written into the new session', async (t) => {
  const held = deferred();
  setup(t, { 'GET /api/spending': async () => { await held.promise; return ok([ledger[0]]); } });

  const loading = store().fetchTransactions();
  await new Promise((resolve) => setImmediate(resolve));
  invalidateSession();
  held.resolve();
  const result = await loading;

  assert.equal(result.success, false);
  assert.deepEqual(store().transactions, []);
  assert.equal(store().error, null);
  assert.deepEqual(metrics(), { balance: 0, income: 0, expense: 0 });
});

// ── Monthly limits ──────────────────────────────────────────────────────────

test('limits of the selected month are shown, with categories from the server plus any category that has a limit', async (t) => {
  const api = setup(t, {
    'GET /api/spending/budget': () => ok({ Shopping: 2_000_000, 'Thú cưng': 300_000 }),
    'GET /api/spending/categories': () => ok(['Shopping', 'Food & Dining'])
  });

  const result = await store().fetchBudgets();

  assert.equal(result.success, true);
  assert.deepEqual(api.sent('GET /api/spending/budget')[0].query, { month: THIS_MONTH });
  assert.deepEqual(store().budgets, { Shopping: 2_000_000, 'Thú cưng': 300_000 });
  assert.equal(store().budgetMonth, THIS_MONTH);
  assert.deepEqual(store().expenseCategories, [
    { name: 'Shopping', icon: 'shopping' },
    { name: 'Food & Dining', icon: 'food' },
    { name: 'Thú cưng', icon: 'other-expense' }
  ]);
});

test('loading another month only fills its cache and never changes what the selected month shows', async (t) => {
  setup(t, {
    'GET /api/spending/budget': ({ query }) => ok(query.month === OLD_MONTH ? { Travel: 9 } : { Shopping: 1 }),
    'GET /api/spending/categories': () => ok(['Shopping'])
  });
  await store().fetchBudgets();

  const result = await store().fetchBudgets(OLD_MONTH);

  assert.deepEqual(result.data, { Travel: 9 });
  assert.deepEqual(store().budgetsByMonth[OLD_MONTH].data, { Travel: 9 });
  assert.deepEqual(store().budgets, { Shopping: 1 });
  assert.equal(store().budgetMonth, THIS_MONTH);
});

test('a month is read once: repeat and simultaneous reads share the cached answer until forced', async (t) => {
  const api = setup(t, {
    'GET /api/spending/budget': () => ok({ Shopping: 1 }),
    'GET /api/spending/categories': () => ok(['Shopping'])
  });

  const [first, second] = await Promise.all([store().loadBudgetMonth(OLD_MONTH), store().loadBudgetMonth(OLD_MONTH)]);
  const third = await store().loadBudgetMonth(OLD_MONTH);

  assert.deepEqual([first.data, second.data, third.data], [{ Shopping: 1 }, { Shopping: 1 }, { Shopping: 1 }]);
  assert.equal(api.sent('GET /api/spending/budget').length, 1);
  assert.equal(api.sent('GET /api/spending/categories').length, 1);

  await store().loadBudgetMonth(OLD_MONTH, { force: true });
  assert.equal(api.sent('GET /api/spending/budget').length, 2);
});

test('a value that is not a month is refused without calling the server', async (t) => {
  const api = setup(t);

  for (const month of ['2026-13', '2026-1', '', null, 202601]) {
    assert.deepEqual(await store().loadBudgetMonth(month), { success: false });
  }

  assert.equal(api.calls.length, 0);
});

test('a failed read of the selected month reports an error and keeps the limits already shown', async (t) => {
  const api = setup(t, {
    'GET /api/spending/budget': () => ok({ Shopping: 1 }),
    'GET /api/spending/categories': () => ok(['Shopping'])
  });
  await store().fetchBudgets();
  api.routes['GET /api/spending/budget'] = () => fail(500, 'boom');
  useTransactionStore.setState({ budgetsByMonth: {} });

  const result = await store().fetchBudgets();

  assert.equal(result.success, false);
  assert.ok(store().error);
  assert.deepEqual(store().budgets, { Shopping: 1 });
});

test('saving limits sends them for the month, shows them and drops cached later months that inherit them', async (t) => {
  const api = setup(t, { 'PUT /api/spending/budget': () => ok(null) });
  const earlier = { data: { A: 1 }, fetchedAt: 1 };
  useTransactionStore.setState({ budgetsByMonth: {
    '2000-12': earlier, [OLD_MONTH]: { data: { B: 2 }, fetchedAt: 1 }, '2001-02': { data: { C: 3 }, fetchedAt: 1 }
  } });

  const result = await store().updateBudgets({ Shopping: 750_000 }, OLD_MONTH);

  const sent = api.sent('PUT /api/spending/budget')[0];
  assert.deepEqual(sent.query, { month: OLD_MONTH });
  assert.deepEqual(sent.body, { Shopping: 750_000 });
  assert.deepEqual(result, { success: true, data: { Shopping: 750_000 } });
  assert.deepEqual(store().budgets, { Shopping: 750_000 });
  assert.equal(store().budgetMonth, OLD_MONTH);
  assert.deepEqual(Object.keys(store().budgetsByMonth).sort(), ['2000-12', OLD_MONTH]);
  assert.equal(store().budgetsByMonth['2000-12'], earlier);
  assert.deepEqual(store().budgetsByMonth[OLD_MONTH].data, { Shopping: 750_000 });
});

test('saving limits together with categories sends both and updates the category list', async (t) => {
  const api = setup(t, { 'PUT /api/spending/budget': () => ok(null) });
  const categories = [{ name: 'Shopping', icon: 'shopping' }, { name: 'Thú cưng', icon: 'other-expense' }];

  await store().updateBudgetsAndCategories({ 'Thú cưng': 100_000 }, categories, OLD_MONTH);

  assert.deepEqual(api.sent('PUT /api/spending/budget')[0].body,
    { budgets: { 'Thú cưng': 100_000 }, categories: ['Shopping', 'Thú cưng'] });
  assert.deepEqual(store().expenseCategories, categories);
  assert.deepEqual(store().budgetCategoryBase.names, ['Shopping', 'Thú cưng']);
  assert.deepEqual(store().budgets, { 'Thú cưng': 100_000 });
});

test('a rejected save throws and keeps the limits that were shown', async (t) => {
  setup(t, { 'PUT /api/spending/budget': () => fail(400, 'Hạn mức không hợp lệ.') });
  useTransactionStore.setState({ budgets: { Shopping: 1 }, budgetMonth: OLD_MONTH });

  await assert.rejects(store().updateBudgets({ Shopping: -5 }, OLD_MONTH), { status: 400 });
  await assert.rejects(store().updateBudgetsAndCategories({ Shopping: -5 }, null, OLD_MONTH), { status: 400 });

  assert.deepEqual(store().budgets, { Shopping: 1 });
  assert.equal(store().isLoading, false);
  assert.ok(store().error);
});

test('a read that started before a save cannot overwrite the limits just saved', async (t) => {
  const held = deferred();
  setup(t, {
    'GET /api/spending/budget': async () => { await held.promise; return ok({ Shopping: 111 }); },
    'GET /api/spending/categories': () => ok(['Shopping']),
    'PUT /api/spending/budget': () => ok(null)
  });
  useSpendingStore.setState({ selectedMonth: OLD_MONTH });

  const staleRead = store().fetchBudgets(OLD_MONTH);
  await new Promise((resolve) => setImmediate(resolve));
  await store().updateBudgets({ Shopping: 999 }, OLD_MONTH);
  held.resolve();
  await staleRead;

  assert.deepEqual(store().budgets, { Shopping: 999 });
  assert.deepEqual(store().budgetsByMonth[OLD_MONTH].data, { Shopping: 999 });
});

test('replacing the category list saves the names and remembers them', async (t) => {
  const api = setup(t, { 'PUT /api/spending/categories': () => ok(['Shopping', 'Thú cưng']) });
  const categories = [{ name: 'Shopping', icon: 'shopping' }, { name: 'Thú cưng', icon: 'other-expense' }];

  await store().setExpenseCategories(categories);

  assert.deepEqual(api.sent('PUT /api/spending/categories')[0].body, { categories: ['Shopping', 'Thú cưng'] });
  assert.deepEqual(store().expenseCategories, categories);
  assert.deepEqual(store().budgetCategoryBase.names, ['Shopping', 'Thú cưng']);
});
