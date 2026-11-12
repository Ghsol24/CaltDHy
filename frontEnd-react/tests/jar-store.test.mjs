import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, ok, fail, inThisMonth,
  useJarStore
} from './helpers/store-harness.mjs';

const store = () => useJarStore.getState();

const trip = { _id: 'trip', name: 'Du lịch', target: 10_000_000, current: 2_000_000, targetDate: '2030-01-01',
  history: [{ _id: 'e1', type: 'deposit', amount: 2_000_000, reason: 'Mở hũ', date: '2026-01-02T00:00:00.000Z' }] };
const laptop = { _id: 'laptop', name: 'Laptop', target: 30_000_000, current: 0 };
const rent = { _id: 'rent', name: 'Tiền nhà', category: 'Housing & Bills', amount: 5_000_000,
  nextDueDate: inThisMonth('10'), walletId: { _id: 'bank', name: 'Ngân hàng' }, active: true };
const phone = { _id: 'phone', name: 'Trả góp điện thoại', amount: 900_000, totalAmount: 10_800_000,
  totalMonths: 12, paidMonths: 3, nextDueDate: inThisMonth('20'), walletId: 'cash', isActive: false };

async function loaded(t, extraRoutes = {}) {
  const api = setup(t, {
    'GET /api/jars': () => ok([trip, laptop]),
    'GET /api/jars/installments': () => ok([rent, phone]),
    'GET /api/spending': () => ok([]),
    'GET /api/wallets': () => ok([]),
    'GET /api/spending/budget': () => ok({}),
    'GET /api/spending/categories': () => ok([]),
    ...extraRoutes
  });
  await store().fetchData();
  return api;
}

test('loading normalises jars and recurring items for the screens', async (t) => {
  await loaded(t);

  assert.equal(store().hasLoaded, true);
  assert.equal(store().isLoading, false);
  assert.deepEqual(store().jars[0], {
    id: 'trip', name: 'Du lịch', category: 'Mục tiêu chung', target: 10_000_000, current: 2_000_000,
    targetDate: '2030-01-01', icon: '🫙', color: '#5356F1',
    history: [{ id: 'e1', type: 'deposit', amount: 2_000_000, reason: 'Mở hũ', date: '2026-01-02T00:00:00.000Z' }],
    createdAt: null, updatedAt: null
  });
  assert.deepEqual(store().jars[1].history, []);
  assert.deepEqual(store().installments[0], {
    id: 'rent', type: 'expense', name: 'Tiền nhà', category: 'Housing & Bills', icon: 'recurring', amount: 5_000_000,
    cycle: 'monthly', nextDueDate: inThisMonth('10'), endDate: null, active: true, totalPaid: 0, history: [],
    totalAmount: 5_000_000, remainingAmount: 0, monthlyAmount: 5_000_000, dueDate: inThisMonth('10'),
    totalMonths: 0, paidMonths: 0, walletId: 'bank', isActive: true
  });
  const paused = store().installments[1];
  assert.deepEqual([paused.active, paused.isActive, paused.walletId, paused.totalAmount, paused.totalMonths, paused.paidMonths],
    [false, false, 'cash', 10_800_000, 12, 3]);
});

test('a failed load reports the error and still marks loading as finished', async (t) => {
  setup(t, { 'GET /api/jars': () => fail(500, 'boom'), 'GET /api/jars/installments': () => ok([]) });

  const result = await store().fetchData();

  assert.equal(result.success, false);
  assert.equal(store().error, result.error);
  assert.equal(store().hasLoaded, true);
  assert.equal(store().isLoading, false);
  assert.deepEqual(store().jars, []);
});

test('a new jar goes first; editing replaces only that jar; deleting removes it', async (t) => {
  const api = await loaded(t, {
    'POST /api/jars': ({ body }) => ok({ _id: 'new', ...body }),
    'PUT /api/jars/laptop': ({ body }) => ok({ ...laptop, ...body }),
    'DELETE /api/jars/trip': () => ok(null)
  });

  const created = await store().createJar({ name: 'Quỹ khẩn cấp', target: 1_000_000 });
  assert.equal(created.data.id, 'new');
  assert.deepEqual(store().jars.map((jar) => jar.id), ['new', 'trip', 'laptop']);

  await store().updateJar('laptop', { target: 25_000_000 });
  assert.deepEqual(api.sent('PUT /api/jars/laptop')[0].body, { target: 25_000_000 });
  assert.deepEqual(store().jars.map((jar) => [jar.id, jar.target]),
    [['new', 1_000_000], ['trip', 10_000_000], ['laptop', 25_000_000]]);

  await store().deleteJar('trip');
  assert.deepEqual(store().jars.map((jar) => jar.id), ['new', 'laptop']);
});

test('a deposit and a withdrawal call their own endpoint with the wallet, then refresh transactions and wallets', async (t) => {
  const api = await loaded(t, {
    'PATCH /api/jars/trip/deposit': ({ body }) => ok({ ...trip, current: trip.current + body.amount }),
    'PATCH /api/jars/trip/withdraw': ({ body }) => ok({ ...trip, current: 2_500_000 - body.amount })
  });

  const deposited = await store().updateJarBalance('trip', 'deposit', 500_000, 'Thưởng', 'bank');
  await api.settle();
  assert.deepEqual(api.sent('PATCH /api/jars/trip/deposit')[0].body, { amount: 500_000, reason: 'Thưởng', walletId: 'bank' });
  assert.equal(deposited.data.current, 2_500_000);
  assert.equal(store().jars[0].current, 2_500_000);
  assert.equal(store().jars[1].current, 0);
  assert.equal(api.sent('GET /api/spending').length, 1);
  assert.equal(api.sent('GET /api/wallets').length, 1);

  await store().updateJarBalance('trip', 'withdraw', 700_000, 'Vé máy bay');
  await api.settle();
  assert.deepEqual(api.sent('PATCH /api/jars/trip/withdraw')[0].body, { amount: 700_000, reason: 'Vé máy bay', walletId: null });
  assert.equal(api.sent('PATCH /api/jars/trip/deposit').length, 1);
  assert.equal(store().jars[0].current, 1_800_000);
  assert.equal(api.sent('GET /api/spending').length, 2);
  assert.equal(api.sent('GET /api/wallets').length, 2);
});

test('a rejected deposit throws, keeps the jar amount and does not refresh anything', async (t) => {
  const api = await loaded(t, { 'PATCH /api/jars/trip/deposit': () => fail(409, 'Số dư ví không đủ hoặc vượt hạn mức tín dụng.') });

  await assert.rejects(store().updateJarBalance('trip', 'deposit', 99_000_000, '', 'cash'), { status: 409 });
  await api.settle();

  assert.equal(store().jars[0].current, 2_000_000);
  assert.ok(store().error);
  assert.equal(api.sent('GET /api/spending').length, 0);
  assert.equal(api.sent('GET /api/wallets').length, 0);
});

test('a new recurring item goes last; pausing and deleting change only that item', async (t) => {
  await loaded(t, {
    'POST /api/jars/installments': ({ body }) => ok({ _id: 'net', ...body }),
    'PATCH /api/jars/installments/rent/toggle': () => ok({ ...rent, active: false }),
    'DELETE /api/jars/installments/phone': () => ok(null)
  });

  await store().createInstallment({ name: 'Internet', amount: 200_000, nextDueDate: inThisMonth('15') });
  assert.deepEqual(store().installments.map((item) => item.id), ['rent', 'phone', 'net']);

  await store().toggleInstallment('rent');
  assert.deepEqual(store().installments.map((item) => [item.id, item.active]),
    [['rent', false], ['phone', false], ['net', true]]);

  await store().deleteInstallment('phone');
  assert.deepEqual(store().installments.map((item) => item.id), ['rent', 'net']);
});

test('paying a recurring item pays the period currently due, then refreshes transactions and wallets', async (t) => {
  const api = await loaded(t, {
    'PATCH /api/jars/installments/phone/pay': () => ok({ ...phone, paidMonths: 4, totalPaid: 3_600_000, nextDueDate: '2031-02-20' })
  });

  await store().payInstallment('phone');
  await api.settle();

  assert.deepEqual(api.sent('PATCH /api/jars/installments/phone/pay')[0].body, { period: inThisMonth('20'), walletId: null });
  const [untouched, paid] = store().installments;
  assert.equal(untouched.nextDueDate, inThisMonth('10'));
  assert.deepEqual([paid.paidMonths, paid.totalPaid, paid.nextDueDate], [4, 3_600_000, '2031-02-20']);
  assert.equal(api.sent('GET /api/spending').length, 1);
  assert.equal(api.sent('GET /api/wallets').length, 1);
});

test('a rejected payment throws, keeps the item unpaid and does not refresh anything', async (t) => {
  const api = await loaded(t, { 'PATCH /api/jars/installments/phone/pay': () => fail(409, 'Kỳ này đã được thanh toán.') });

  await assert.rejects(store().payInstallment('phone'), { status: 409 });
  await api.settle();

  assert.equal(store().installments[1].paidMonths, 3);
  assert.equal(api.sent('GET /api/spending').length, 0);
});

test('renaming or recategorising a recurring item refreshes transactions and limits; other edits do not', async (t) => {
  const api = await loaded(t, { 'PUT /api/jars/installments/rent': ({ body }) => ok({ ...rent, ...body }) });

  await store().updateInstallment('rent', { amount: 5_500_000 });
  await api.settle();
  assert.equal(store().installments[0].amount, 5_500_000);
  assert.equal(api.sent('GET /api/spending').length, 0);
  assert.equal(api.sent('GET /api/spending/budget').length, 0);

  await store().updateInstallment('rent', { category: 'Other Expense' });
  await api.settle();
  assert.equal(store().installments[0].category, 'Other Expense');
  assert.equal(api.sent('GET /api/spending').length, 1);
  assert.equal(api.sent('GET /api/spending/budget').length, 1);

  await store().updateInstallment('rent', { name: 'Thuê nhà' });
  await api.settle();
  assert.equal(api.sent('GET /api/spending').length, 2);
});

test('other rejected writes throw and leave the lists as they were', async (t) => {
  await loaded(t, {
    'POST /api/jars': () => fail(400, 'Tên hũ không hợp lệ.'),
    'PUT /api/jars/trip': () => fail(400, 'Mục tiêu không hợp lệ.'),
    'DELETE /api/jars/trip': () => fail(409, 'Hũ vẫn còn tiền.'),
    'POST /api/jars/installments': () => fail(400, 'Số tiền không hợp lệ.'),
    'PUT /api/jars/installments/rent': () => fail(400, 'Số tiền không hợp lệ.'),
    'PATCH /api/jars/installments/rent/toggle': () => fail(409, 'Không thể tạm dừng.'),
    'DELETE /api/jars/installments/rent': () => fail(409, 'Không thể xóa.')
  });
  const before = structuredClone({ jars: store().jars, installments: store().installments });

  await assert.rejects(store().createJar({ name: '' }), { status: 400 });
  await assert.rejects(store().updateJar('trip', { target: -1 }), { status: 400 });
  await assert.rejects(store().deleteJar('trip'), { status: 409 });
  await assert.rejects(store().createInstallment({ amount: -1 }), { status: 400 });
  await assert.rejects(store().updateInstallment('rent', { amount: -1 }), { status: 400 });
  await assert.rejects(store().toggleInstallment('rent'), { status: 409 });
  await assert.rejects(store().deleteInstallment('rent'), { status: 409 });

  assert.deepEqual({ jars: store().jars, installments: store().installments }, before);
  assert.ok(store().error);
});
