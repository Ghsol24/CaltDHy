import { create } from 'zustand';
import { DEFAULT_LOCALE, normalizeLocale, SUPPORTED_LOCALES } from '../i18n/translations';
import { setActiveFormattingLocale } from '../utils/formatters';

const KEY = 'caltdhy_lang';

const getInitialLang = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return normalizeLocale(saved);
    const browserLocale = navigator.language || '';
    if (browserLocale.toLowerCase().startsWith('zh')) return 'zh-CN';
    if (browserLocale.toLowerCase().startsWith('en')) return 'en';
  } catch {
    // Browser storage can be unavailable in restricted contexts.
  }
  return DEFAULT_LOCALE;
};

const initialLang = getInitialLang();
setActiveFormattingLocale(initialLang);

export const useLangStore = create((set) => ({
  lang: initialLang,
  supportedLocales: SUPPORTED_LOCALES,
  setLang: (value) => {
    const lang = normalizeLocale(value);
    try {
      localStorage.setItem(KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // Keep the in-memory preference when persistence is unavailable.
    }
    setActiveFormattingLocale(lang);
    set({ lang });
  },
}));
