import { getIntlLocale, normalizeLocale, translate } from '../i18n/translations.js';
import { getActiveUsdRate, hasUsableUsdRate } from './exchangeRate.js';

const LANG_KEY = 'caltdhy_lang';
const CURRENCY_KEY = 'caltdhy_curr';
const BASE_CURRENCY = 'VND';
const MAX_FORMATTER_CACHE_SIZE = 64;
const numberFormatterCache = new Map();
const dateFormatterCache = new Map();
let activeLocaleCache;
let activeDisplayCurrencyCache;

function getCachedFormatter(cache, Formatter, locale, options) {
  const serializedOptions = Object.keys(options)
    .sort()
    .map((key) => `${key}:${String(options[key])}`)
    .join('|');
  const cacheKey = `${locale}|${serializedOptions}`;
  let formatter = cache.get(cacheKey);
  if (!formatter) {
    formatter = new Formatter(locale, options);
    if (cache.size >= MAX_FORMATTER_CACHE_SIZE) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, formatter);
  }
  return formatter;
}

function getNumberFormatter(locale, options) {
  return getCachedFormatter(numberFormatterCache, Intl.NumberFormat, locale, options);
}

function getDateFormatter(locale, options) {
  return getCachedFormatter(dateFormatterCache, Intl.DateTimeFormat, locale, options);
}

function configuredRate() {
  const rate = getActiveUsdRate();
  return hasUsableUsdRate(rate) ? rate.vndPerUsd : null;
}

function getActiveLocale() {
  if (activeLocaleCache) return activeLocaleCache;
  try { activeLocaleCache = normalizeLocale(localStorage.getItem(LANG_KEY)); } catch { activeLocaleCache = 'vi'; }
  return activeLocaleCache;
}

export function setActiveFormattingLocale(locale) {
  activeLocaleCache = normalizeLocale(locale);
}

function getActiveDisplayCurrency() {
  if (activeDisplayCurrencyCache) return activeDisplayCurrencyCache;
  try {
    activeDisplayCurrencyCache = localStorage.getItem(CURRENCY_KEY) === 'USD' && configuredRate() ? 'USD' : BASE_CURRENCY;
  } catch {
    activeDisplayCurrencyCache = BASE_CURRENCY;
  }
  return activeDisplayCurrencyCache;
}

export function setActiveFormattingCurrency(currency) {
  activeDisplayCurrencyCache = currency === 'USD' && configuredRate() ? 'USD' : BASE_CURRENCY;
}

export function resolveLocale(options = {}) {
  return normalizeLocale(options.locale || getActiveLocale());
}

export function resolveDisplayCurrency(options = {}) {
  const requested = options.currency || getActiveDisplayCurrency();
  return requested === 'USD' && (options.vndPerUsd || configuredRate()) ? 'USD' : BASE_CURRENCY;
}

/**
 * Convert a VND base amount for display only. This helper must never be used by
 * financial calculations, API payloads or persistence code.
 */
export function convertVndForDisplay(value, { currency, vndPerUsd } = {}) {
  const displayCurrency = resolveDisplayCurrency({ currency, vndPerUsd });
  if (displayCurrency === BASE_CURRENCY) return value;
  const rate = Number(vndPerUsd || configuredRate());
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return null;
  return amount / rate;
}

export function formatNumber(value, options = {}) {
  const locale = getIntlLocale(resolveLocale(options));
  const number = typeof value === 'bigint' ? value : Number(value);
  if (typeof number === 'number' && !Number.isFinite(number)) return '';
  return getNumberFormatter(locale, {
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    minimumFractionDigits: options.minimumFractionDigits,
    useGrouping: options.useGrouping ?? true,
  }).format(number);
}

export function formatInputNumber(value, options = {}) {
  if (value === '' || value === null || value === undefined) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits ? formatNumber(Number(digits), options) : '';
}

/** Format a VND base amount in the selected display currency. */
export function formatCurrency(value, options = {}) {
  const locale = resolveLocale(options);
  const displayCurrency = resolveDisplayCurrency(options);
  const original = typeof value === 'bigint' ? value : Number(value);
  if (typeof original === 'number' && (!Number.isFinite(original) || Math.abs(original) > Number.MAX_SAFE_INTEGER)) {
    return translate(locale, 'common.outOfRange');
  }

  const isNegative = original < 0;
  const absOriginal = typeof original === 'bigint' ? (original < 0n ? -original : original) : Math.abs(original);
  const converted = convertVndForDisplay(absOriginal, {
    currency: displayCurrency,
    vndPerUsd: options.vndPerUsd,
  });
  if (converted === null) return translate(locale, 'common.outOfRange');

  const amount = displayCurrency === BASE_CURRENCY
    ? (typeof converted === 'bigint' ? converted : Math.round(converted))
    : converted;
  const formatted = getNumberFormatter(getIntlLocale(locale), {
    style: 'currency',
    currency: displayCurrency,
    currencyDisplay: options.currencyDisplay || 'narrowSymbol',
    minimumFractionDigits: displayCurrency === 'USD' ? 2 : 0,
    maximumFractionDigits: displayCurrency === 'USD' ? 2 : 0,
  }).format(amount);

  if (!options.showSign) return isNegative ? `−${formatted}` : formatted;
  if (original === 0 || original === 0n) return formatted;
  if (isNegative || (!options.isIncome && original > 0)) return `−${formatted}`;
  return `+${formatted}`;
}

export function getLocalDateString(value = new Date()) {
  const date = value instanceof Date ? value : parseDate(value) || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthString(value = new Date()) {
  const date = value instanceof Date ? value : parseDate(value) || new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Two date shapes for the whole app (X-03): long "13 tháng 11, 2026" for headings
// and short "13/11" for lists and tables (the year is added when it is not this year).
const DATE_OPTIONS = {
  full: { year: 'numeric', month: 'long', day: 'numeric' },
  short: { month: '2-digit', day: '2-digit' },
  'short-with-year': { year: 'numeric', month: '2-digit', day: '2-digit' },
  compact: { year: 'numeric', month: '2-digit', day: '2-digit' },
  'day-date': { year: 'numeric', month: '2-digit', day: '2-digit' },
  month: { year: 'numeric', month: 'long' },
  'weekday-day-month': { weekday: 'short', day: '2-digit', month: '2-digit' },
};

function appLocaleFromIntl(intlLocale) {
  const tag = String(intlLocale || '').toLowerCase();
  if (tag.startsWith('en')) return 'en';
  if (tag.startsWith('zh')) return 'zh-CN';
  return 'vi';
}

function capitalizeFirst(text, intlLocale) {
  return text ? text.charAt(0).toLocaleUpperCase(intlLocale) + text.slice(1) : text;
}

/**
 * "Tháng 11, 2026" (vi) / "November 2026" (en). `omitCurrentYear` drops the year
 * when it is this year ("Tháng 11"); `lowercase` gives "tháng 11" for use inside
 * a Vietnamese sentence. Accepts an app locale or, for components that only
 * know it, an Intl locale (`intlLocale`).
 */
export function formatMonthYear(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '';
  const locale = options.intlLocale ? appLocaleFromIntl(options.intlLocale) : resolveLocale(options);
  const intlLocale = getIntlLocale(locale);
  const omitYear = options.omitCurrentYear && date.getFullYear() === new Date().getFullYear();
  if (locale === 'vi') {
    const text = `tháng ${date.getMonth() + 1}${omitYear ? '' : `, ${date.getFullYear()}`}`;
    return options.lowercase ? text : capitalizeFirst(text, intlLocale);
  }
  const text = getDateFormatter(intlLocale, omitYear ? { month: 'long' } : { month: 'long', year: 'numeric' }).format(date);
  return capitalizeFirst(text, intlLocale);
}

export function formatDate(value, format = 'full', options = {}) {
  const date = parseDate(value);
  if (!date) return '';
  if (format === 'month') return formatMonthYear(date, options);
  const appLocale = resolveLocale(options);
  const otherYear = date.getFullYear() !== new Date().getFullYear();
  // ICU writes "13-11" for vi day+month without a year; Vietnamese readers expect "13/11".
  if (format === 'short' && appLocale === 'vi') {
    const dayMonth = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    return otherYear ? `${dayMonth}/${date.getFullYear()}` : dayMonth;
  }
  const key = format === 'short' && otherYear ? 'short-with-year' : format;
  return getDateFormatter(getIntlLocale(appLocale), DATE_OPTIONS[key] || DATE_OPTIONS.short).format(date);
}

// Date-only values are stored at midnight; "00:00" adds nothing, so it is left out.
function hasClockTime(date) {
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

export function formatDateTime(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '';
  const locale = resolveLocale(options);
  const day = formatDate(date, 'short', { locale });
  return hasClockTime(date) ? `${day}, ${formatTime(date, { locale })}` : day;
}

export function formatMonthShort(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '';
  return getDateFormatter(getIntlLocale(resolveLocale(options)), {
    month: 'short', year: '2-digit',
  }).format(date);
}

export function formatTime(value = new Date(), options = {}) {
  const date = parseDate(value);
  if (!date) return '';
  return getDateFormatter(getIntlLocale(resolveLocale(options)), {
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function formatRelativeDate(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '';
  const locale = resolveLocale(options);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return translate(locale, 'date.today');
  if (diffDays === 1) return translate(locale, 'date.yesterday');
  return formatDate(date, 'short', { locale });
}

export function formatRelativeDateTime(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '';
  const locale = resolveLocale(options);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0 || diffDays === 1) {
    const dayText = translate(locale, diffDays === 0 ? 'date.today' : 'date.yesterday');
    return hasClockTime(date) ? `${dayText}, ${formatTime(date, { locale })}` : dayText;
  }
  return formatDateTime(date, { locale });
}

export function formatPercent(value, options = {}) {
  const number = Number(value);
  const fractionDigits = Number.isInteger(options.fractionDigits)
    ? Math.min(2, Math.max(0, options.fractionDigits))
    : 0;
  return getNumberFormatter(getIntlLocale(resolveLocale(options)), {
    style: 'percent', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(number) ? number / 100 : 0);
}

export function getDueStatus(value, options = {}) {
  const locale = resolveLocale(options);
  const date = parseDate(value);
  if (!date) return {
    diffDays: null, text: translate(locale, 'date.noDate'), isOverdue: false, isToday: false, isSoon: false,
  };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return {
    diffDays, text: translate(locale, 'date.overdueDays', { count: Math.abs(diffDays) }),
    isOverdue: true, isToday: false, isSoon: true,
  };
  if (diffDays === 0) return {
    diffDays: 0, text: translate(locale, 'date.dueToday'), isOverdue: false, isToday: true, isSoon: true,
  };
  return {
    diffDays, text: translate(locale, 'date.daysLeft', { count: diffDays }),
    isOverdue: false, isToday: false, isSoon: diffDays <= 7,
  };
}

// One-line weekday for date tiles: "THỨ 3" wrapped and pushed the day number out (PLAN-01).
const VI_WEEKDAY_TILE = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function getCalendarDateParts(value, options = {}) {
  const date = parseDate(value);
  if (!date) return { weekdayShort: '--', day: '--', month: '--' };
  const appLocale = resolveLocale(options);
  const locale = getIntlLocale(appLocale);
  return {
    weekdayShort: appLocale === 'vi'
      ? VI_WEEKDAY_TILE[date.getDay()]
      : getDateFormatter(locale, { weekday: 'short' }).format(date).toLocaleUpperCase(locale),
    day: getDateFormatter(locale, { day: '2-digit' }).format(date),
    month: getDateFormatter(locale, { month: 'short' }).format(date),
  };
}

export function getRecurringTier(item, currentMonthStr = getLocalMonthString(), options = {}) {
  const locale = resolveLocale(options);
  if (!item) return {
    tier: 'normal', isPaidThisMonth: false, isOverdue: false, isToday: false,
    text: translate(locale, 'date.noDate'), shortText: translate(locale, 'date.noDate'), diffDays: null,
  };
  const isPaidThisMonth = Array.isArray(item.history) && item.history.some(
    (entry) => entry && typeof entry.paidDate === 'string' && entry.paidDate.startsWith(currentMonthStr),
  );
  if (isPaidThisMonth) return {
    tier: 'paid', isPaidThisMonth: true, isOverdue: false, isToday: false,
    text: translate(locale, 'date.paidThisMonth'), shortText: translate(locale, 'date.paid'), diffDays: null,
  };
  const due = getDueStatus(item.nextDueDate, { locale });
  const tier = due.isOverdue || due.isToday || due.diffDays <= 3
    ? 'danger' : due.diffDays <= 10 ? 'warning' : 'normal';
  return { tier, isPaidThisMonth: false, ...due, shortText: due.text };
}
