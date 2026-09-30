const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidInstallmentEndDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// The end date includes a payment due on that day. Once the next due date
// advances beyond it, there is no remaining payable period.
export function isInstallmentEnded(item) {
  const endDate = typeof item?.endDate === 'string' ? item.endDate.slice(0, 10) : null;
  const nextDueDate = typeof item?.nextDueDate === 'string' ? item.nextDueDate.slice(0, 10) : null;
  return isValidInstallmentEndDate(endDate)
    && (!isValidInstallmentEndDate(nextDueDate) || nextDueDate > endDate);
}
