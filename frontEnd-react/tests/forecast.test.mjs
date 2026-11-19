import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastMonthEnd, estimateJarCompletion, currentWeekRange, expenseBetween } from '../src/utils/forecast.js';
import { calculateAvailableToSpend } from '../src/utils/financeMath.js';

const DAY = 86400000;
const pad = (value) => String(value).padStart(2, '0');
const localIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// 21 September 2026, 10:00 local time: September has 30 days, so 21 have passed and 9 remain.
const now = new Date(2026, 8, 21, 10);
const wallets = [{ _id: 'w', id: 'w', name: 'Tiền mặt', type: 'cash', initialBalance: 1_000_000 }];
const tx = (overrides) => ({ type: 'expense', walletId: 'w', category: 'Food', amount: 0, ...overrides });
const transactions = [
  tx({ type: 'income', amount: 10_000_000, date: '2026-09-01' }),
  tx({ amount: 2_100_000, date: '2026-09-05' }),
  tx({ amount: 100_000, fee: 5_000, date: '2026-09-10' }),         // the fee counts as spending
  tx({ amount: 3_000_000, date: '2026-09-12' }),                   // a day marked "expected high spend"
  tx({ amount: 500_000, date: '2026-09-15', installmentId: 'rent' }), // recurring, already scheduled
  tx({ amount: 999, date: '2026-09-25' }),                         // dated in the future
  tx({ amount: 700_000, date: '2026-08-30' }),                     // last month
];
const installments = [
  { id: 'internet', name: 'Internet', amount: 300_000, nextDueDate: '2026-09-25T00:00:00.000Z' },
  { id: 'bonus', name: 'Thưởng', type: 'income', amount: 1_000_000, nextDueDate: '2026-09-28' },
  { id: 'today', name: 'Due today', amount: 50_000, nextDueDate: '2026-09-21' },
  { id: 'october', name: 'Next month', amount: 50_000, nextDueDate: '2026-10-01' },
  { id: 'paused', name: 'Paused', amount: 50_000, isActive: false, nextDueDate: '2026-09-26' },
  { id: 'loan', name: 'Trả góp', amount: 2_400_000, monthlyAmount: 200_000, nextDueDate: '2026-09-23' },
];

test('month-end forecast continues the everyday pace and adds only recurring items still due this month', () => {
  const result = forecastMonthEnd({ transactions, wallets, installments, expectedDays: ['2026-09-12'], now });
  const reference = calculateAvailableToSpend({ wallets, transactions, jars: [], currentMonthPrefix: '2026-09' });

  // Everyday spending: 2,100,000 + 105,000 over 21 days = 105,000 a day, continued for 9 days.
  assert.equal(result.dailyPace, 105_000);
  assert.equal(result.remainingDays, 9);
  assert.equal(result.projectedSpend, 945_000);

  assert.deepEqual(result.upcoming.map((item) => [item.id, item.date, item.amount]), [
    ['loan', '2026-09-23', 200_000],    // the monthly instalment, not the whole loan
    ['internet', '2026-09-25', 300_000],
    ['bonus', '2026-09-28', 1_000_000],
  ]);
  assert.equal(result.upcomingExpense, 500_000);
  assert.equal(result.upcomingIncome, 1_000_000);

  assert.equal(result.balanceNow, reference.availableToSpend);
  assert.ok(Number.isFinite(result.balanceNow));
  assert.equal(result.projectedBalance, reference.availableToSpend - 945_000 - 500_000 + 1_000_000);
  assert.equal(result.income, reference.monthlyIncome);
  assert.equal(result.expense, reference.monthlyExpense);
  assert.equal(result.savingsRate, Math.round(((reference.monthlyIncome - reference.monthlyExpense) * 100) / reference.monthlyIncome));
  assert.equal(result.hasData, true);
});

test('month-end forecast has no invented numbers without data', () => {
  const empty = forecastMonthEnd({ now });
  assert.equal(empty.hasData, false);
  assert.equal(empty.dailyPace, 0);
  assert.equal(empty.projectedSpend, 0);
  assert.deepEqual(empty.upcoming, []);
  assert.equal(empty.savingsRate, null, 'no income means no savings rate, not 0% or -100%');

  const spendingOnly = forecastMonthEnd({ wallets, transactions: [tx({ amount: 210_000, date: '2026-09-02' })], now });
  assert.equal(spendingOnly.savingsRate, null);
  assert.equal(spendingOnly.dailyPace, 10_000);
  assert.equal(spendingOnly.hasData, true);
});

test('jar completion uses the last 90 days of net deposits and never invents a date', () => {
  const at = (daysAgo) => new Date(now.getTime() - daysAgo * DAY).toISOString();
  assert.deepEqual(estimateJarCompletion({ target: 100, current: 100 }, now), { done: true });
  assert.deepEqual(estimateJarCompletion({ target: 100, current: 0 }, now), { stalled: true });
  assert.deepEqual(estimateJarCompletion({ target: 100, current: 0, history: [
    { type: 'deposit', amount: 50, date: at(10) }, { type: 'withdraw', amount: 80, date: at(5) },
  ] }, now), { stalled: true }, 'more withdrawn than deposited');

  // 600,000 net over the 60 days since the first counted deposit: 10,000 a day, 600,000 still missing.
  const jar = { target: 1_000_000, current: 400_000, targetDate: '2026-10-31', history: [
    { type: 'deposit', amount: 300_000, date: at(60) },
    { type: 'deposit', amount: 300_000, date: at(30) },
    { type: 'withdraw', amount: 900_000, date: at(120) }, // outside the 90-day window
    { type: 'deposit', amount: 5_000_000, date: at(-3) }, // in the future
    { type: 'deposit', amount: 1, date: 'not a date' },
  ] };
  assert.deepEqual(estimateJarCompletion(jar, now), {
    date: localIso(new Date(now.getTime() + 60 * DAY)), monthly: 300_000, late: true,
  });
  assert.equal(estimateJarCompletion({ ...jar, targetDate: '2027-12-31' }, now).late, false);
  assert.equal(estimateJarCompletion({ ...jar, targetDate: undefined }, now).late, false);

  // A jar opened two days ago is judged over 30 days, so one big first deposit is not read as the pace.
  assert.deepEqual(estimateJarCompletion({ target: 600_000, current: 300_000, history: [
    { type: 'deposit', amount: 300_000, date: at(2) },
  ] }, now), { date: localIso(new Date(now.getTime() + 30 * DAY)), monthly: 300_000, late: false });

  assert.deepEqual(estimateJarCompletion({ target: 1e12, current: 0, history: [
    { type: 'deposit', amount: 1_000, date: at(1) },
  ] }, now), { stalled: true }, 'more than 30 years away');
});

test('current week runs Monday to Sunday for every day of that week', () => {
  const week = { from: '2026-09-21', to: '2026-09-27' };
  for (let day = 21; day <= 27; day += 1) assert.deepEqual(currentWeekRange(new Date(2026, 8, day, 23, 59)), week, String(day));
  assert.deepEqual(currentWeekRange(new Date(2026, 8, 28)), { from: '2026-09-28', to: '2026-10-04' }, 'crosses the month');
});

test('expenses between two dates include fees and both end days, and nothing but expenses', () => {
  const list = [
    tx({ amount: 100, fee: 10, date: '2026-09-21' }),
    tx({ amount: 200, date: '2026-09-27' }),
    tx({ amount: 400, date: '2026-09-28' }),
    tx({ type: 'income', amount: 1_000, date: '2026-09-22' }),
    tx({ type: 'transfer', amount: 1_000, fee: 5, date: '2026-09-22' }),
  ];
  assert.equal(expenseBetween(list, '2026-09-21', '2026-09-27'), 310);
  assert.equal(expenseBetween([], '2026-09-21', '2026-09-27'), 0);
});
