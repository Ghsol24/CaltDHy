import { create } from 'zustand';

const KEY = 'caltdhy_lang';
const SUPPORTED = ['en', 'vi', 'zh'];

const getInitialLang = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {
    // ignore
  }
  return 'vi';
};

export const useLangStore = create((set) => ({
  lang: getInitialLang(),
  setLang: (lang) => {
    if (!SUPPORTED.includes(lang)) return;
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      // ignore
    }
    set({ lang });
  },
}));
