function parsePositiveRate(value) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function isIsoAsOf(value) {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  if (value.length === 10) return new Date(timestamp).toISOString().slice(0, 10) === value;
  return true;
}

// A deployment owns this snapshot. It is never persisted with financial data.
export const exchangeRateConfig = Object.freeze({
  vndPerUsd: parsePositiveRate(import.meta.env?.VITE_VND_PER_USD),
  source: String(import.meta.env?.VITE_FX_SOURCE || '').trim(),
  asOf: String(import.meta.env?.VITE_FX_AS_OF || '').trim(),
});

export function hasUsableUsdRate(config = exchangeRateConfig) {
  return Boolean(parsePositiveRate(config.vndPerUsd)
    && String(config.source || '').trim()
    && isIsoAsOf(String(config.asOf || '').trim()));
}
