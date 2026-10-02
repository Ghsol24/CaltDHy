import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresHistoricalConfirmation, transactionEditImpact, previewCategoryBudgets } from '../src/utils/transactionEditing.js';
import { calculateMonthlyStats, calculateWalletBalances } from '../src/utils/financeMath.js';
import { translate } from '../src/i18n/translations.js';
import { historicalImpactMessage } from '../src/utils/transactionMessages.js';

const original = { id: 'september', type: 'expense', amount: 30000, fee: 2000,
  date: '2026-09-28', walletId: 'bank', category: 'Food', desc: 'Lunch' };

test('past financial edits need confirmation, notes alone and current-month edits do not', () => {
  assert.equal(requiresHistoricalConfirmation(original, { ...original, desc: 'Corrected note' }, '2026-10'), false);
  for (const change of [{ amount: 40000 }, { category: 'Coffee' }, { walletId: 'cash' },
    { type: 'income' }, { date: '2026-10-01' }, { fee: 3000 }]) {
    assert.equal(requiresHistoricalConfirmation(original, { ...original, ...change }, '2026-10'), true);
  }
  const current = { ...original, date: '2026-10-01' };
  assert.equal(requiresHistoricalConfirmation(current, { ...current, amount: 40000 }, '2026-10'), false);
  assert.equal(requiresHistoricalConfirmation(current, { ...current, date: '2026-09-30' }, '2026-10'), true);
  assert.equal(requiresHistoricalConfirmation(null, original, '2026-10'), true);
  assert.equal(requiresHistoricalConfirmation(original, null, '2026-10'), true);
  assert.equal(requiresHistoricalConfirmation({ ...original, date: '2025-12-31' }, null, '2026-01'), true);
});

test('impact preview agrees with the actual monthly totals and current wallet balances', () => {
  const updated = { ...original, amount: 40000, date: '2026-10-01', walletId: 'cash' };
  const wallets = [{ id: 'bank', initialBalance: 100000 }, { id: 'cash', initialBalance: 100000 }];
  const impact = transactionEditImpact(original, updated);
  assert.deepEqual(impact.months, [
    { month: '2026-09', income: 0n, expense: -32000n },
    { month: '2026-10', income: 0n, expense: 42000n }
  ]);
  for (const totals of impact.months) {
    const before = calculateMonthlyStats([original], totals.month);
    const after = calculateMonthlyStats([updated], totals.month);
    assert.equal(totals.expense, BigInt(after.expense - before.expense));
    assert.equal(totals.income, BigInt(after.income - before.income));
  }
  const beforeBalances = calculateWalletBalances(wallets, [original]).balances;
  const afterBalances = calculateWalletBalances(wallets, [updated]).balances;
  for (const { id, delta } of impact.wallets) assert.equal(delta, BigInt(afterBalances[id] - beforeBalances[id]));
});

test('transfer reversal changes both wallets and does not inflate monthly spending', () => {
  const transfer = { ...original, type: 'transfer', toWalletId: 'cash' };
  assert.deepEqual(transactionEditImpact(transfer, null), {
    months: [{ month: '2026-09', income: 0n, expense: 0n }],
    wallets: [{ id: 'bank', delta: 32000n }, { id: 'cash', delta: -30000n }]
  });
});

test('backdated creation does not promise an edit revision, while edits and deletions do', () => {
  const options = { t: (key) => key, wallets: [], locale: 'vi' };
  assert.ok(!historicalImpactMessage(null, original, options).includes('transaction.changeRecorded'));
  assert.ok(historicalImpactMessage(original, { ...original, amount: 40000 }, options).includes('transaction.changeRecorded'));
  assert.ok(historicalImpactMessage(original, null, options).includes('transaction.changeRecorded'));
});

test('budget preview uses the supplied period, replaces the edited expense once, and keeps fees', () => {
  const other = { ...original, id: 'october', amount: 20000, fee: 0, date: '2026-10-01' };
  const options = { transactions: [original, other], categories: [{ name: 'Food' }, { name: 'Coffee' }],
    editingId: original.id, draft: { ...original, amount: 40000 } };
  const september = previewCategoryBudgets({ ...options, month: '2026-09', budgets: { Food: 100000 } });
  assert.equal(september.Food.remaining, 58000);
  const october = previewCategoryBudgets({ ...options, month: '2026-10', budgets: { Food: 500000 },
    draft: { ...original, amount: 40000, date: '2026-10-01' } });
  assert.equal(october.Food.remaining, 438000);
  const categoryChange = previewCategoryBudgets({ ...options, month: '2026-09', budgets: { Food: 100000, Coffee: 50000 },
    draft: { ...original, category: 'Coffee' } });
  assert.equal(categoryChange.Food.remaining, 100000);
  assert.equal(categoryChange.Coffee.remaining, 18000);
  assert.equal(september.Coffee.hasLimit, false);
});

test('new period feedback has translations in every supported locale', () => {
  for (const locale of ['vi', 'en', 'zh-CN']) {
    for (const key of ['historicalPeriod', 'historicalHint', 'confirmHistorical', 'confirmSave', 'historicalImpact',
      'monthIncomeImpact', 'monthExpenseImpact', 'walletImpact', 'changeRecorded', 'budgetForPeriod',
      'budgetPreview', 'budgetLoading', 'budgetFailed', 'budgetUnavailable', 'revisionHistory',
      'historyLoading', 'historyFailed', 'historyEmpty', 'accountOwner', 'previousWallet',
      'receivingWallet', 'fee', 'amountRange', 'dateRequired']) {
      assert.notEqual(translate(locale, `transaction.${key}`), `transaction.${key}`);
    }
  }
});
