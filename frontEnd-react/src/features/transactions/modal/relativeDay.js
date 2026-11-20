import { parseIsoDate } from '../../../utils/datePicker';

const pad = (value) => String(value).padStart(2, '0');

export function shiftIsoDays(iso, days) {
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  const date = new Date(parts.year, parts.month, parts.day + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Hôm nay" / "Hôm qua" / tên thứ trong tuần của một ngày ISO. */
export function relativeDayLabel(iso, todayIso, t, intlLocale) {
  if (iso === todayIso) return t('date.today');
  if (iso === shiftIsoDays(todayIso, -1)) return t('date.yesterday');
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  const weekday = new Intl.DateTimeFormat(intlLocale || 'vi-VN', { weekday: 'long' })
    .format(new Date(parts.year, parts.month, parts.day));
  return weekday.charAt(0).toLocaleUpperCase(intlLocale || 'vi-VN') + weekday.slice(1);
}
