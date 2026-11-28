import { create } from 'zustand';
import { fetchUsdRate, getActiveUsdRate, hasUsableUsdRate, normalizeRateSnapshot, setActiveUsdRate } from '../utils/exchangeRate';
import { setActiveFormattingCurrency } from '../utils/formatters';

const BASE_CURRENCY = 'VND';
const KEY = 'caltdhy_curr';
// Máy chủ làm mới tỷ giá mỗi ngày; trong một phiên trình duyệt không cần hỏi lại dày hơn.
const REFETCH_MS = 6 * 60 * 60 * 1000;

function readSavedCurrency() {
  try {
    return localStorage.getItem(KEY) === 'USD' ? 'USD' : BASE_CURRENCY;
  } catch {
    return BASE_CURRENCY;
  }
}

const preferredCurrency = readSavedCurrency();
const initialCurrency = preferredCurrency === 'USD' && hasUsableUsdRate() ? 'USD' : BASE_CURRENCY;
setActiveFormattingCurrency(initialCurrency);

let pendingLoad = null;
let loadedAt = 0;

const isNewer = (candidate, current) => !normalizeRateSnapshot(current)
  || Date.parse(candidate.asOf) >= Date.parse(current.asOf);

export const useCurrencyStore = create((set, get) => ({
  displayCurrency: initialCurrency,
  // Lựa chọn người dùng đã lưu; có thể là USD trong lúc chưa có tỷ giá dùng được.
  preferredCurrency,
  usdAvailable: hasUsableUsdRate(),
  exchangeRate: getActiveUsdRate(),
  rateStatus: 'idle', // 'loading' | 'ready' | 'unavailable'
  /** Fetches the server's reference rate. Resolves to whether USD can be shown. */
  loadExchangeRate: ({ force = false, fetchImpl } = {}) => {
    if (pendingLoad) return pendingLoad;
    if (!force && loadedAt && Date.now() - loadedAt < REFETCH_MS) return Promise.resolve(get().usdAvailable);
    set({ rateStatus: 'loading' });
    pendingLoad = fetchUsdRate({ fetchImpl }).then((snapshot) => {
      if (snapshot && isNewer(snapshot, getActiveUsdRate())) setActiveUsdRate(snapshot);
      const usdAvailable = hasUsableUsdRate();
      // Chỉ thôi hỏi lại khi đã có bản dùng được; lỗi hay bản quá cũ thì lần mở Cài đặt sau thử tiếp.
      if (usdAvailable) loadedAt = Date.now();
      const state = get();
      // Tỷ giá quá cũ thì quay về VND nhưng vẫn nhớ người dùng muốn USD.
      const displayCurrency = usdAvailable && state.preferredCurrency === 'USD' ? 'USD'
        : usdAvailable ? state.displayCurrency : BASE_CURRENCY;
      setActiveFormattingCurrency(displayCurrency);
      set({
        usdAvailable, displayCurrency, exchangeRate: getActiveUsdRate(),
        rateStatus: usdAvailable ? 'ready' : 'unavailable',
      });
      return usdAvailable;
    }).finally(() => { pendingLoad = null; });
    return pendingLoad;
  },
  setDisplayCurrency: (requested) => {
    const displayCurrency = requested === 'USD' && hasUsableUsdRate() ? 'USD' : BASE_CURRENCY;
    try { localStorage.setItem(KEY, displayCurrency); } catch { /* keep in memory */ }
    setActiveFormattingCurrency(displayCurrency);
    set({ displayCurrency, preferredCurrency: displayCurrency });
    return displayCurrency === requested;
  },
}));

// Người dùng đã chọn USD: lấy tỷ giá mới ngay khi ứng dụng mở, không đợi vào Cài đặt.
if (preferredCurrency === 'USD' && typeof window !== 'undefined') {
  queueMicrotask(() => { void useCurrencyStore.getState().loadExchangeRate(); });
}
