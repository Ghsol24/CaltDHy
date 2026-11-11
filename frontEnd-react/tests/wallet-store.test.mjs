import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, ok, fail, inThisMonth,
  useTransactionStore, useWalletStore
} from './helpers/store-harness.mjs';

const store = () => useWalletStore.getState();
const balances = () => Object.fromEntries(
  [...store().wallets, ...store().archivedWallets].map((wallet) => [wallet.id, wallet.currentBalance])
);

const cash = { _id: 'cash', name: 'Tiền mặt', type: 'cash', initialBalance: 1_000_000, isDefault: true };
const bank = { _id: 'bank', name: 'Ngân hàng', type: 'bank', initialBalance: 5_000_000 };
const card = { _id: 'card', name: 'Thẻ', type: 'credit', initialBalance: 0, creditLimit: 20_000_000 };
const closed = { _id: 'closed', name: 'Ví cũ', type: 'cash', initialBalance: 250_000, archived: true };

const txn = (overrides) => ({
  _id: 't', type: 'expense', amount: 0, category: 'Other Expense', date: `${inThisMonth('05')}T00:00:00.000Z`, ...overrides
});
const ledger = [
  txn({ _id: 'salary', type: 'income', amount: 3_000_000, walletId: 'bank' }),
  txn({ _id: 'lunch', type: 'expense', amount: 150_000, fee: 2_000, walletId: 'cash' }),
  txn({ _id: 'move', type: 'transfer', amount: 2_000_000, fee: 5_500, walletId: 'bank', toWalletId: 'cash' }),
  txn({ _id: 'swipe', type: 'expense', amount: 700_000, walletId: 'card' }),
  txn({ _id: 'unlinked', type: 'expense', amount: 999_999 })
];

async function loaded(t, extraRoutes = {}) {
  const api = setup(t, {
    'GET /api/spending': () => ok(ledger),
    'GET /api/wallets': () => ok([cash, bank, card, closed], { history: [{ id: 'h1', action: 'create' }] }),
    ...extraRoutes
  });
  await useTransactionStore.getState().fetchTransactions();
  await store().fetchWallets();
  return api;
}

test('loading wallets fills in defaults and separates open wallets from archived ones', async (t) => {
  setup(t, { 'GET /api/wallets': () => ok([{ _id: 'a', balance: 42 }, closed], { history: [{ id: 'h1' }] }) });

  const result = await store().fetchWallets();

  assert.equal(result.success, true);
  assert.deepEqual(store().wallets, [{
    id: 'a', name: '', type: 'cash', icon: 'cash', color: '#078A59', initialBalance: 42, creditLimit: 0,
    isExcludedFromTotal: false, isDefault: false, archived: false, currentBalance: 42
  }]);
  assert.deepEqual(store().archivedWallets.map((wallet) => [wallet.id, wallet.archived]), [['closed', true]]);
  assert.deepEqual(store().walletHistory, [{ id: 'h1' }]);
  assert.equal(store().isLoading, false);
});

// The server only returns archived wallets when the request carries
// includeArchived=true (backEnd/server/routes/wallets.js). The store asks for
// them, but services/api.js drops the `params` option, so the query string is
// never sent and the archived list in the app stays empty.
test('loading wallets asks the server to include archived wallets', { todo: 'api.get ignores options.params' }, async (t) => {
  const api = setup(t, { 'GET /api/wallets': () => ok([cash]) });

  await store().fetchWallets();

  assert.deepEqual(api.sent('GET /api/wallets')[0].query, { includeArchived: 'true' });
});

test('a wallet balance is its opening balance plus income, minus spending and fees', async (t) => {
  await loaded(t);

  assert.deepEqual(balances(), {
    // 1,000,000 − (150,000 + 2,000) + 2,000,000 received
    cash: 2_848_000,
    // 5,000,000 + 3,000,000 − (2,000,000 + 5,500 fee paid by the sending wallet)
    bank: 5_994_500,
    card: -700_000,
    closed: 250_000
  });
});

test('a transfer moves the amount between wallets and only the fee leaves the total', async (t) => {
  setup(t, {
    'GET /api/spending': () => ok([ledger[2]]),
    'GET /api/wallets': () => ok([cash, bank])
  });
  await useTransactionStore.getState().fetchTransactions();
  await store().fetchWallets();

  const before = cash.initialBalance + bank.initialBalance;
  assert.equal(balances().cash + balances().bank, before - 5_500);
});

test('balances follow the ledger when a transaction is added, edited or removed', async (t) => {
  await loaded(t, {
    'POST /api/spending': ({ body }) => ok({ _id: 'gift', ...body }),
    'PUT /api/spending/gift': ({ body }) => ok({ _id: 'gift', type: 'income', category: 'Gift & Bonus', date: inThisMonth('06'), ...body }),
    'DELETE /api/spending/gift': () => ok(null)
  });
  const transactions = useTransactionStore.getState();

  await transactions.addTransaction({ type: 'income', amount: 400_000, category: 'Gift & Bonus', date: inThisMonth('06'), walletId: 'cash' });
  assert.equal(balances().cash, 3_248_000);

  await transactions.updateTransaction('gift', { amount: 100_000, walletId: 'bank' });
  assert.equal(balances().cash, 2_848_000);
  assert.equal(balances().bank, 6_094_500);

  await transactions.deleteTransaction('gift');
  assert.equal(balances().bank, 5_994_500);
});

test('a failed load reports the error and keeps the wallets already shown', async (t) => {
  const api = await loaded(t);
  api.routes['GET /api/wallets'] = () => fail(500, 'boom');

  const result = await store().fetchWallets();

  assert.equal(result.success, false);
  assert.equal(store().error, result.error);
  assert.equal(store().isLoading, false);
  assert.deepEqual(store().wallets.map((wallet) => wallet.id), ['cash', 'bank', 'card']);
});

test('creating a default wallet takes the default flag from the others and logs the activity once', async (t) => {
  const api = await loaded(t, {
    'POST /api/wallets': ({ body }) => ok({ _id: 'new', ...body }, { activity: { id: 'h1', action: 'create-again' } })
  });

  const result = await store().createWallet({ name: 'Quỹ', type: 'bank', initialBalance: 80_000, isDefault: true });

  assert.equal(api.sent('POST /api/wallets')[0].body.name, 'Quỹ');
  assert.equal(result.data.id, 'new');
  assert.deepEqual(store().wallets.map((wallet) => [wallet.id, wallet.isDefault]),
    [['cash', false], ['bank', false], ['card', false], ['new', true]]);
  assert.equal(balances().new, 80_000);
  assert.equal(balances().cash, 2_848_000);
  assert.deepEqual(store().walletHistory, [{ id: 'h1', action: 'create-again' }]);
});

test('creating an ordinary wallet leaves the default wallet alone', async (t) => {
  await loaded(t, { 'POST /api/wallets': ({ body }) => ok({ _id: 'new', ...body }) });

  await store().createWallet({ name: 'Quỹ', initialBalance: 0 });

  assert.deepEqual(store().wallets.filter((wallet) => wallet.isDefault).map((wallet) => wallet.id), ['cash']);
  assert.deepEqual(store().walletHistory, [{ id: 'h1', action: 'create' }]);
});

test('editing a wallet replaces it, moves the default flag and recomputes its balance', async (t) => {
  const api = await loaded(t, { 'PUT /api/wallets/bank': ({ body }) => ok({ ...bank, ...body }) });

  await store().updateWallet('bank', { name: 'Lương', initialBalance: 6_000_000, isDefault: true });

  assert.deepEqual(api.sent('PUT /api/wallets/bank')[0].body, { name: 'Lương', initialBalance: 6_000_000, isDefault: true });
  assert.deepEqual(store().wallets.map((wallet) => [wallet.id, wallet.name, wallet.isDefault]),
    [['cash', 'Tiền mặt', false], ['bank', 'Lương', true], ['card', 'Thẻ', false]]);
  assert.equal(balances().bank, 6_994_500);
});

test('rejected wallet writes throw, change nothing and stop the spinner', async (t) => {
  await loaded(t, {
    'POST /api/wallets': () => fail(400, 'Tên ví không hợp lệ.'),
    'PUT /api/wallets/bank': () => fail(400, 'Tên ví không hợp lệ.'),
    'DELETE /api/wallets/bank': () => fail(409, 'Không thể xóa ví.'),
    'POST /api/wallets/bank/archive': () => fail(409, 'Ví vẫn còn số dư.'),
    'POST /api/wallets/closed/unarchive': () => fail(409, 'Không thể mở lại.'),
    'POST /api/spending': () => fail(409, 'Số dư ví không đủ hoặc vượt hạn mức tín dụng.')
  });
  const before = structuredClone(store().wallets);

  await assert.rejects(store().createWallet({ name: '' }), { status: 400 });
  await assert.rejects(store().updateWallet('bank', { name: '' }), { status: 400 });
  await assert.rejects(store().deleteWallet('bank'), { status: 409 });
  await assert.rejects(store().archiveWallet('bank'), { status: 409 });
  await assert.rejects(store().unarchiveWallet('closed'), { status: 409 });
  await assert.rejects(store().transferMoney({ fromWalletId: 'cash', toWalletId: 'bank', amount: 1 }), { status: 409 });

  assert.deepEqual(store().wallets, before);
  assert.equal(store().isLoading, false);
  assert.ok(store().error);
});

test('deleting a wallet reloads transactions and wallets, because the server moves its entries', async (t) => {
  const api = await loaded(t, { 'DELETE /api/wallets/bank': () => ok(null) });
  api.routes['GET /api/spending'] = () => ok([txn({ _id: 'moved', type: 'income', amount: 10, walletId: 'cash' })]);
  api.routes['GET /api/wallets'] = () => ok([{ ...cash, initialBalance: 9_000_000 }]);

  const result = await store().deleteWallet('bank');

  assert.deepEqual(result, { success: true });
  assert.deepEqual(useTransactionStore.getState().transactions.map((entry) => entry.id), ['moved']);
  assert.deepEqual(balances(), { cash: 9_000_010 });
  assert.equal(store().isLoading, false);
});

test('archiving reloads wallets, and also transactions only when the balance was moved out', async (t) => {
  const api = await loaded(t, { 'POST /api/wallets/bank/archive': () => ok({ archived: true }) });
  const reads = () => api.sent('GET /api/spending').length;
  const before = reads();

  await store().archiveWallet('bank');
  assert.equal(reads(), before);
  assert.deepEqual(api.sent('POST /api/wallets/bank/archive')[0].body, {});

  const result = await store().archiveWallet('bank', { transferToWalletId: 'cash' });
  assert.equal(reads(), before + 1);
  assert.deepEqual(api.sent('POST /api/wallets/bank/archive')[1].body, { transferToWalletId: 'cash' });
  assert.deepEqual(result, { success: true, data: { archived: true } });
});

test('reopening an archived wallet reloads the wallet lists', async (t) => {
  const api = await loaded(t, { 'POST /api/wallets/closed/unarchive': () => ok({ archived: false }) });
  api.routes['GET /api/wallets'] = () => ok([cash, { ...closed, archived: false }]);

  await store().unarchiveWallet('closed');

  assert.deepEqual(store().wallets.map((wallet) => wallet.id), ['cash', 'closed']);
  assert.deepEqual(store().archivedWallets, []);
});

test('a transfer is recorded as one transfer transaction with whole numbers, then everything is reloaded', async (t) => {
  const api = await loaded(t, { 'POST /api/spending': ({ body }) => ok({ _id: 'x', ...body }) });
  const reads = api.sent('GET /api/wallets').length;

  await store().transferMoney({ fromWalletId: 'bank', toWalletId: 'cash', amount: '250000', fee: '1100', date: inThisMonth('09'), desc: 'Rút tiền' });
  await store().transferMoney({ fromWalletId: 'cash', toWalletId: 'bank', amount: 5 });

  const [first, second] = api.sent('POST /api/spending').map((call) => call.body);
  assert.deepEqual(first, {
    type: 'transfer', amount: 250_000, date: inThisMonth('09'), walletId: 'bank', toWalletId: 'cash',
    desc: 'Rút tiền', category: 'Chuyển tiền', fee: 1_100
  });
  assert.equal(second.fee, 0);
  assert.equal(second.desc, 'Chuyển tiền');
  assert.match(second.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(api.sent('GET /api/wallets').length, reads + 2);
});

test('choosing a wallet is remembered', (t) => {
  setup(t);
  store().setSelectedWalletId('bank');
  assert.equal(store().selectedWalletId, 'bank');
});
