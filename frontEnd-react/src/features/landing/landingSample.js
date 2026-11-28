import { formatCurrency } from '../../utils/formatters';

// The preview's sample month follows the real calendar so dates, month names
// and "days left" never go stale. "Today" in the sample is always the 13th.
export const SAMPLE_DAY = 13;
const SAMPLE_REMAINING = 1595000;
const SAMPLE_SPENT = 2905000;
const SAMPLE_PREV_LEFTOVER = 640000;

const roundDownToThousand = (value) => Math.floor(value / 1000) * 1000;

function shortMonth(lang, date) {
  const month = date.getMonth() + 1;
  if (lang === 'en') return date.toLocaleString('en-US', { month: 'short' });
  if (lang === 'zh-CN') return `${month}月`;
  return `T${month}`;
}

export function buildSampleCalendar(lang, now = new Date()) {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const at = (offset) => new Date(year, monthIndex + offset, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const left = days - SAMPLE_DAY + 1;
  const month = monthIndex + 1;
  const enShort = (date) => date.toLocaleString('en-US', { month: 'short' });
  return {
    tokens: {
      day: SAMPLE_DAY,
      days,
      left,
      m: month,
      mm: String(month).padStart(2, '0'),
      mon: enShort(at(0)),
      pm: at(-1).getMonth() + 1,
      pmon: at(-1).toLocaleString('en-US', { month: 'long' }),
      nm: at(1).getMonth() + 1,
      nmon: enShort(at(1)),
      ny: at(1).getFullYear(),
      pace: formatCurrency(roundDownToThousand(SAMPLE_SPENT / SAMPLE_DAY)),
      prevLeft: formatCurrency(SAMPLE_PREV_LEFTOVER),
    },
    months: [-5, -4, -3, -2, -1, 0].map((offset) => shortMonth(lang, at(offset))),
    dailyCap: roundDownToThousand(SAMPLE_REMAINING / left),
    todayPercent: (SAMPLE_DAY / days) * 100,
  };
}

/** Replaces {token} placeholders in every string of a copy object. */
export function fillSample(value, tokens) {
  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (match, key) => (key in tokens ? String(tokens[key]) : match));
  }
  if (Array.isArray(value)) return value.map((item) => fillSample(item, tokens));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillSample(item, tokens)]));
  }
  return value;
}
