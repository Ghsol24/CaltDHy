import { getCalendarDateParts, getRecurringTier } from './formatters.js';

/** Spending at or above this share of the limit counts as "way over" (critical). */
export const SEVERE_OVERSPEND_PERCENT = 150;
export const ALERT_TIERS = ['critical', 'high', 'watch'];
const TIER_RANK = { critical: 0, high: 1, watch: 2 };

/**
 * Every plan item that needs attention, most severe first.
 *
 * Tiers: critical = overdue bill or spending ≥ 150% of the limit; high = due today or
 * over the limit; watch = due within 10 days or ≥ 70% of the limit. Within a tier, bills
 * come before budgets, budgets by how far over they are, bills by due date.
 *
 * `reason` says why (and picks the badge text): overdue, today, dueSoon, overSevere,
 * over, nearLimit, watch.
 */
export function buildPlanAlerts({ installments = [], categoryBudgets = [], currentMonth, getTier = getRecurringTier }) {
  const list = [];

  installments.forEach((item) => {
    const due = getTier(item, currentMonth);
    if (due.isPaidThisMonth) return;
    let tier = null;
    let reason = null;
    if (due.isOverdue) [tier, reason] = ['critical', 'overdue'];
    else if (due.isToday) [tier, reason] = ['high', 'today'];
    else if (due.tier === 'danger' || due.tier === 'warning') [tier, reason] = ['watch', 'dueSoon'];
    if (!tier) return;
    list.push({
      id: `rec-${reason}-${item.id}`,
      kind: 'recurring',
      tier,
      reason,
      name: item.name,
      amount: Number(item.amount) || 0,
      dueText: due.text,
      diffDays: due.diffDays ?? 0,
      dateParts: getCalendarDateParts(item.nextDueDate),
      targetTab: 'recurring',
    });
  });

  categoryBudgets.forEach((budget) => {
    if (!budget.hasLimit) return;
    const percent = Number(budget.percent) || 0;
    let tier = null;
    let reason = null;
    if (percent >= SEVERE_OVERSPEND_PERCENT) [tier, reason] = ['critical', 'overSevere'];
    else if (percent >= 100) [tier, reason] = ['high', 'over'];
    else if (percent >= 90) [tier, reason] = ['watch', 'nearLimit'];
    else if (percent >= 70) [tier, reason] = ['watch', 'watch'];
    if (!tier) return;
    list.push({
      id: `bud-${reason}-${budget.category}`,
      kind: 'budget',
      tier,
      reason,
      category: budget.category,
      percent,
      overAmount: percent >= 100 ? Math.abs(Number(budget.remaining) || 0) : 0,
      targetTab: 'budgets',
    });
  });

  return list.sort((a, b) => (
    TIER_RANK[a.tier] - TIER_RANK[b.tier]
    || (a.kind === b.kind ? 0 : a.kind === 'recurring' ? -1 : 1)
    || (a.kind === 'budget' ? b.percent - a.percent : a.diffDays - b.diffDays)
  ));
}

/** { critical, high, watch } counts for the summary line. */
export function countAlertTiers(alerts) {
  return alerts.reduce((counts, alert) => ({ ...counts, [alert.tier]: counts[alert.tier] + 1 }),
    { critical: 0, high: 0, watch: 0 });
}
