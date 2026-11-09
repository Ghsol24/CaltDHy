const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthString = (value) => typeof value === 'string' && MONTH_PATTERN.test(value);

// A monthly budget expires only after its calendar month ends, not when it is overspent.
export function isBudgetMonthOverdue(month, currentMonth) {
  return isMonthString(month) && isMonthString(currentMonth) && month < currentMonth;
}

/** 'YYYY-MM' moved by `delta` months, e.g. shiftMonth('2026-01', -1) === '2025-12'. */
export function shiftMonth(month, delta) {
  const [year, value] = month.split('-').map(Number);
  const total = year * 12 + (value - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Where a budget month sits relative to today's month. */
export function monthPeriod(month, currentMonth) {
  if (month === currentMonth) return 'current';
  return month < currentMonth ? 'past' : 'future';
}

/**
 * Cache after saving limits for `month`. A month without its own limits inherits
 * the latest earlier month on the server, so every cached later month may now be
 * stale and is dropped; earlier months cannot change.
 */
export function withBudgetEdit(cache, month, data, fetchedAt = Date.now()) {
  const next = {};
  for (const [key, entry] of Object.entries(cache || {})) {
    if (key < month) next[key] = entry;
  }
  next[month] = { data, fetchedAt };
  return next;
}
