import { create } from 'zustand';
import { exchangeRateConfig, hasUsableUsdRate } from '../utils/exchangeRate';
import { setActiveFormattingCurrency } from '../utils/formatters';

export { exchangeRateConfig, hasUsableUsdRate } from '../utils/exchangeRate';

export const BASE_CURRENCY = 'VND';
export const DISPLAY_CURRENCIES = Object.freeze(['VND', 'USD']);
const KEY = 'caltdhy_curr';

function getInitialCurrency() {
  try {
    if (localStorage.getItem(KEY) === 'USD' && hasUsableUsdRate()) return 'USD';
  } catch {
    // Ignore unavailable storage.
  }
  return BASE_CURRENCY;
}

const initialCurrency = getInitialCurrency();
setActiveFormattingCurrency(initialCurrency);

export const useCurrencyStore = create((set) => ({
  displayCurrency: initialCurrency,
  usdAvailable: hasUsableUsdRate(),
  exchangeRate: exchangeRateConfig,
  setDisplayCurrency: (requested) => {
    const displayCurrency = requested === 'USD' && hasUsableUsdRate() ? 'USD' : BASE_CURRENCY;
    try { localStorage.setItem(KEY, displayCurrency); } catch { /* keep in memory */ }
    setActiveFormattingCurrency(displayCurrency);
    set({ displayCurrency });
    return displayCurrency === requested;
  },
}));
