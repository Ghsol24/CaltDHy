import { getLocalDateString } from './formatters.js';

export function historyDateRange(preset, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (preset === 'thisMonth') {
    return { from: getLocalDateString(new Date(year, month, 1)),
      to: getLocalDateString(new Date(year, month + 1, 0)) };
  }
  if (preset === 'lastMonth') {
    return { from: getLocalDateString(new Date(year, month - 1, 1)),
      to: getLocalDateString(new Date(year, month, 0)) };
  }
  if (preset === 'last7Days') {
    return { from: getLocalDateString(new Date(year, month, day - 6)),
      to: getLocalDateString(today) };
  }
  return { from: '', to: '' };
}
