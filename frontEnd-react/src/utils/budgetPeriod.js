const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// A monthly budget expires only after its calendar month ends, not when it is overspent.
export function isBudgetMonthOverdue(month, currentMonth) {
  return MONTH_PATTERN.test(month) && MONTH_PATTERN.test(currentMonth) && month < currentMonth;
}
