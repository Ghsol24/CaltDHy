// Formatters used only by on-demand screens (charts, reports, jar calendar). Kept out of
// formatters.js so they stay out of the initial bundle.
import { getIntlLocale, translate } from '../i18n/translations.js';
import { convertVndForDisplay, formatNumber, formatPercent, resolveDisplayCurrency, resolveLocale } from './formatters.js';

const BASE_CURRENCY = 'VND';

// Vietnamese shorthand people already write: 600k, 1,5tr, 2 tỷ (X-04).
const VI_COMPACT_UNITS = [[1e9, ' tỷ'], [1e6, 'tr'], [1e3, 'k']];

/** Compact axis labels; only the returned label is converted, never the plotted VND value. */
export function formatCompactCurrency(value, options = {}) {
  const locale = resolveLocale(options);
  const currency = resolveDisplayCurrency(options);
  const amount = convertVndForDisplay(value, { currency, vndPerUsd: options.vndPerUsd });
  if (amount === null || !Number.isFinite(Number(amount))) return translate(locale, 'common.outOfRange');
  if (locale === 'vi' && currency === BASE_CURRENCY) {
    const number = Number(amount);
    const abs = Math.abs(number);
    const sign = number < 0 ? '−' : '';
    const unit = VI_COMPACT_UNITS.find(([size]) => abs >= size);
    if (!unit) return `${sign}${formatNumber(abs, { locale })}`;
    return `${sign}${formatNumber(abs / unit[0], { locale, maximumFractionDigits: 1 })}${unit[1]}`;
  }
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol', notation: 'compact',
    maximumFractionDigits: currency === 'USD' ? 2 : 1,
  }).format(amount);
}

/**
 * "↑ +18,6%" / "↓ -42,0%"; a rise of 300% or more reads "↑ gấp 41 lần" because a
 * percentage that large (usually against a tiny previous period) says little.
 */
export function formatChangePercent(value, options = {}) {
  const pct = Number(value);
  if (!Number.isFinite(pct)) return '—';
  const locale = resolveLocale(options);
  const fractionDigits = options.fractionDigits ?? 1;
  if (pct >= 300) {
    return `↑ ${translate(locale, 'change.times', { count: formatNumber(Math.round(pct / 100 + 1), { locale }) })}`;
  }
  if (pct > 0) return `↑ +${formatPercent(pct, { locale, fractionDigits })}`;
  if (pct < 0) return `↓ -${formatPercent(Math.abs(pct), { locale, fractionDigits })}`;
  return `~ ${formatPercent(0, { locale, fractionDigits })}`;
}

