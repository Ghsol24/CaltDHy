import test from 'node:test';
import assert from 'node:assert/strict';
import { monthPeriod, shiftMonth, withBudgetEdit } from '../src/utils/budgetPeriod.js';
import { buildBudgetModel } from '../src/utils/budgetModel.js';

test('months shift across year boundaries and know their period', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2025-12', 1), '2026-01');
  assert.equal(shiftMonth('2026-11', 14), '2028-01');
  assert.equal(shiftMonth('2026-03', -27), '2023-12');
  assert.equal(monthPeriod('2026-10', '2026-11'), 'past');
  assert.equal(monthPeriod('2026-11', '2026-11'), 'current');
  assert.equal(monthPeriod('2027-01', '2026-11'), 'future');
});

test('saving limits keeps earlier months and drops later ones that inherit them', () => {
  const cache = {
    '2026-09': { data: { Food: 1 }, fetchedAt: 1 },
    '2026-10': { data: { Food: 2 }, fetchedAt: 1 },
    '2026-11': { data: { Food: 3 }, fetchedAt: 1 },
    '2026-12': { data: { Food: 3 }, fetchedAt: 1 }
  };
  const next = withBudgetEdit(cache, '2026-11', { Food: 9 }, 5);
  assert.deepEqual(Object.keys(next).sort(), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(next['2026-11'], { data: { Food: 9 }, fetchedAt: 5 });
  assert.equal(next['2026-10'], cache['2026-10']);
  assert.equal(cache['2026-12'].data.Food, 3, 'the input cache is not mutated');
});

test('a month model uses only that month: its spending against its own limits', () => {
  const transactions = [
    { type: 'expense', amount: 80000, category: 'Food', date: '2026-10-05' },
    { type: 'expense', amount: 300000, fee: 2000, category: 'Food', date: '2026-11-03' },
    { type: 'expense', amount: 50000, category: 'Gifts', date: '2026-11-04' },
    { type: 'income', amount: 9000000, category: 'Salary', date: '2026-11-01' },
    { type: 'transfer', amount: 400000, category: 'Transfer', date: '2026-11-02' }
  ];
  const october = buildBudgetModel({ transactions, month: '2026-10', budgets: { Food: 100000 }, categoryNames: ['Food'] });
  assert.equal(october.totalSpent, 80000);
  assert.equal(october.totalLimit, 100000);
  assert.equal(october.remaining, 20000);
  assert.equal(october.isOver, false);

  // "Rent" has a limit but is missing from the category list: it still gets a row.
  const november = buildBudgetModel({ transactions, month: '2026-11', budgets: { Food: 250000, Rent: 100000 }, categoryNames: ['Food'] });
  assert.deepEqual(november.limited.map((item) => item.category), ['Food', 'Rent']);
  assert.equal(november.totalSpent, 302000, 'fees count, transfers and income do not');
  assert.equal(november.isOver, false, '302.000 of 350.000 in total is still within the limits');
  assert.equal(november.overCount, 1, 'but Food alone is over its own limit');
  assert.equal(november.usedPercent, 86);
  assert.deepEqual(november.unbudgeted.map((item) => item.category), ['Gifts']);
  assert.equal(november.unbudgetedTotal, 50000);
  assert.equal(november.totalExpense, 352000);

  const empty = buildBudgetModel({ transactions, month: '2026-12', budgets: {}, categoryNames: ['Food'] });
  assert.equal(empty.hasAnyLimit, false);
  assert.equal(empty.isOver, false);
});
