import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePasswordStrength, MIN_PASSWORD_LENGTH } from '../src/utils/passwordStrength.js';
import { isBudgetMonthOverdue } from '../src/utils/budgetPeriod.js';
import { translate } from '../src/i18n/translations.js';
import { useToastStore } from '../src/stores/useToastStore.js';
import { useConfirmStore } from '../src/stores/useConfirmStore.js';

test('password meter never calls a submit-invalid password strong', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 12);
  assert.equal(evaluatePasswordStrength('').level, 'none');
  assert.notEqual(evaluatePasswordStrength('Aa1!aaaaaa').level, 'strong');
  assert.notEqual(evaluatePasswordStrength('Aa1!aaaaaaa').level, 'strong');
  assert.deepEqual(evaluatePasswordStrength('Aa1!aaaaaaaa'), { score: 3, level: 'strong' });
  assert.equal(evaluatePasswordStrength('abcdefghijkl').level, 'fair');
});

test('a monthly budget expires after its month ends, independently of spending', () => {
  assert.equal(isBudgetMonthOverdue('2026-08', '2026-09'), true);
  assert.equal(isBudgetMonthOverdue('2025-12', '2026-01'), true);
  assert.equal(isBudgetMonthOverdue('2026-09', '2026-09'), false);
  assert.equal(isBudgetMonthOverdue('2026-10', '2026-09'), false);
  assert.equal(isBudgetMonthOverdue('2026-13', '2027-01'), false);
});

test('deduplicated feedback replaces the previous recurring-filter toast', () => {
  const store = useToastStore.getState();
  store.clearToasts();
  const firstId = store.addToast({ dedupeKey: 'analytics-recurring-filter', message: 'first', duration: 0 });
  const secondId = store.addToast({ dedupeKey: 'analytics-recurring-filter', message: 'second', duration: 0 });
  assert.equal(secondId, firstId);
  assert.equal(useToastStore.getState().toasts.length, 1);
  assert.equal(useToastStore.getState().toasts[0].message, 'second');
  useToastStore.getState().clearToasts();
});

test('new budget and recurring-filter feedback labels exist in all three locales', () => {
  for (const locale of ['vi', 'en', 'zh-CN']) {
    assert.notEqual(translate(locale, 'budgets.periodOverdue'), 'budgets.periodOverdue');
    assert.match(translate(locale, 'budgets.categoryDetailTitle', { month: '2026-09' }), /2026-09/);
    assert.match(translate(locale, 'analytics.recurringExcludedToast', { count: 3, amount: '100' }), /3/);
    assert.match(translate(locale, 'analytics.recurringIncludedToast', { count: 3, amount: '100' }), /100/);
  }
});

test('confirmation awaits async work, blocks duplicate submits and cannot cancel mid-flight', async () => {
  const store = useConfirmStore.getState();
  let finish;
  let calls = 0;
  const decision = store.confirm({ onConfirm: () => {
    calls += 1;
    return new Promise((resolve) => { finish = resolve; });
  } });
  const operation = store.handleConfirm();
  assert.equal(useConfirmStore.getState().isConfirming, true);
  store.handleCancel();
  assert.equal(useConfirmStore.getState().isOpen, true);
  assert.equal(await store.handleConfirm(), false);
  assert.equal(calls, 1);
  finish();
  assert.equal(await operation, true);
  assert.equal(await decision, true);
  assert.equal(useConfirmStore.getState().isOpen, false);
});

test('failed confirmation remains open with an error and can be retried or cancelled', async () => {
  const store = useConfirmStore.getState();
  let attempts = 0;
  const decision = store.confirm({ onConfirm: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Temporary failure');
  } });
  assert.equal(await store.handleConfirm(), false);
  assert.equal(useConfirmStore.getState().isOpen, true);
  assert.equal(useConfirmStore.getState().isConfirming, false);
  assert.equal(useConfirmStore.getState().error, 'Temporary failure');
  assert.equal(await store.handleConfirm(), true);
  assert.equal(await decision, true);
  assert.equal(attempts, 2);
});
