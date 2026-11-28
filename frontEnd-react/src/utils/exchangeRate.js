// Tỷ giá USD→VND chỉ dùng để hiển thị. Nó không bao giờ được lưu cùng dữ liệu tài chính
// hay đi vào phép tính, payload API hoặc số tiền nhập (vẫn luôn là VND).
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RATE_AGE_MS = 7 * DAY_MS;
const RATE_CACHE_KEY = 'caltdhy_fx_usd';
const RATE_ENDPOINT = '/api/fx/usd';
const FETCH_TIMEOUT_MS = 8000;

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

function safeSourceUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

/** A validated `{ vndPerUsd, source, sourceUrl, asOf }` snapshot, or null. Age is not checked here. */
export function normalizeRateSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const vndPerUsd = parsePositiveRate(value.vndPerUsd);
  const source = String(value.source || '').trim().slice(0, 80);
  const asOf = String(value.asOf || '').trim();
  if (!vndPerUsd || !source || !isIsoAsOf(asOf)) return null;
  return Object.freeze({ vndPerUsd, source, sourceUrl: safeSourceUrl(value.sourceUrl), asOf });
}

// Dự phòng do bản build cung cấp (VITE_*). Bản lấy từ máy chủ được ưu tiên khi có.
export const exchangeRateConfig = Object.freeze({
  vndPerUsd: parsePositiveRate(import.meta.env?.VITE_VND_PER_USD),
  source: String(import.meta.env?.VITE_FX_SOURCE || '').trim(),
  sourceUrl: '',
  asOf: String(import.meta.env?.VITE_FX_AS_OF || '').trim(),
});

function readCachedRate() {
  try {
    return normalizeRateSnapshot(JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || 'null'));
  } catch {
    return null;
  }
}

function newest(...snapshots) {
  return snapshots.filter(Boolean)
    .sort((a, b) => Date.parse(b.asOf) - Date.parse(a.asOf))[0] || exchangeRateConfig;
}

// Bản đang dùng: bản mới nhất giữa bản trình duyệt đã nhớ và bản dự phòng của build.
let activeRate = newest(readCachedRate(), normalizeRateSnapshot(exchangeRateConfig));

/** True when the snapshot is complete and published no more than 7 days before `now`. */
export function hasUsableUsdRate(config = activeRate, { now = Date.now() } = {}) {
  const snapshot = normalizeRateSnapshot(config);
  if (!snapshot) return false;
  const age = now - Date.parse(snapshot.asOf);
  return age <= MAX_RATE_AGE_MS && age >= -DAY_MS;
}

export function getActiveUsdRate() {
  return activeRate;
}

/** Replaces the active snapshot if it is valid; returns whether it was accepted. */
export function setActiveUsdRate(value) {
  const snapshot = normalizeRateSnapshot(value);
  if (!snapshot) return false;
  activeRate = snapshot;
  try { localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(snapshot)); } catch { /* memory only */ }
  return true;
}

/** Fetches the server snapshot. Resolves to a validated snapshot or null; never throws. */
export async function fetchUsdRate({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    const response = await fetchImpl(RATE_ENDPOINT, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response?.ok) return null;
    const data = await response.json();
    return data?.success === true ? normalizeRateSnapshot(data) : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
