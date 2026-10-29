import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanAlerts, countAlertTiers } from '../src/utils/planAlerts.js';

const budget = (category, percent, remaining = 0) => ({ category, percent, remaining, hasLimit: true });
// Stub the due-date math so tests don't depend on today's date.
const dueBy = (map) => (item) => map[item.id];

test('budgets are tiered by how much of the limit is used', () => {
  const alerts = buildPlanAlerts({
    categoryBudgets: [budget('Ăn uống', 81), budget('Di chuyển', 109, -27000), budget('Chi tiêu khác', 960, -1719224),
      budget('Sắp chạm', 92), budget('Ổn', 40), { category: 'Không hạn mức', percent: 0, hasLimit: false }],
  });
  assert.deepEqual(alerts.map((a) => [a.category, a.tier, a.reason]), [
    ['Chi tiêu khác', 'critical', 'overSevere'],
    ['Di chuyển', 'high', 'over'],
    ['Sắp chạm', 'watch', 'nearLimit'],
    ['Ăn uống', 'watch', 'watch'],
  ]);
  assert.equal(alerts[0].overAmount, 1719224);
  assert.equal(alerts[2].overAmount, 0);
});

test('the worst overspend comes first even when categories are listed in another order', () => {
  // Screenshot order: Sức khỏe 132% was shown before Chi tiêu khác 960%.
  const alerts = buildPlanAlerts({
    categoryBudgets: [budget('Sức khỏe', 132), budget('Chi tiêu khác', 960), budget('Mua sắm', 509),
      budget('Cà phê', 155), budget('Di chuyển', 109)],
  });
  assert.deepEqual(alerts.map((a) => a.category), ['Chi tiêu khác', 'Mua sắm', 'Cà phê', 'Sức khỏe', 'Di chuyển']);
  assert.deepEqual(countAlertTiers(alerts), { critical: 3, high: 2, watch: 0 });
});

test('150% is the first "way over" value', () => {
  const [atLimit, below] = buildPlanAlerts({ categoryBudgets: [budget('A', 150), budget('B', 149.9)] });
  assert.equal(atLimit.tier, 'critical');
  assert.equal(below.tier, 'high');
});

test('bills: overdue is critical, today is high, upcoming is watch, paid or far away is hidden', () => {
  const installments = [
    { id: 'soon', name: 'Internet', amount: 200000 },
    { id: 'late', name: 'Tiền nhà', amount: 3000000 },
    { id: 'paid', name: 'Netflix', amount: 100000 },
    { id: 'today', name: 'Điện', amount: 500000 },
    { id: 'far', name: 'Bảo hiểm', amount: 900000 },
  ];
  const alerts = buildPlanAlerts({
    installments,
    getTier: dueBy({
      soon: { tier: 'danger', diffDays: 2, text: 'Còn 2 ngày' },
      late: { tier: 'danger', isOverdue: true, diffDays: -3, text: 'Quá hạn 3 ngày' },
      paid: { tier: 'paid', isPaidThisMonth: true },
      today: { tier: 'danger', isToday: true, diffDays: 0, text: 'Hôm nay' },
      far: { tier: 'normal', diffDays: 25, text: 'Còn 25 ngày' },
    }),
  });
  assert.deepEqual(alerts.map((a) => [a.name, a.tier, a.reason]), [
    ['Tiền nhà', 'critical', 'overdue'],
    ['Điện', 'high', 'today'],
    ['Internet', 'watch', 'dueSoon'],
  ]);
  assert.equal(alerts[0].dueText, 'Quá hạn 3 ngày');
});

test('within a tier, bills come before budgets', () => {
  const alerts = buildPlanAlerts({
    installments: [{ id: 'late', name: 'Tiền nhà', amount: 1 }],
    categoryBudgets: [budget('Mua sắm', 509)],
    getTier: dueBy({ late: { isOverdue: true, diffDays: -1, text: '' } }),
  });
  assert.deepEqual(alerts.map((a) => a.kind), ['recurring', 'budget']);
});
