import { create } from 'zustand';

const KEY = 'caltdhy_lang';
// Tạm thời chỉ hỗ trợ 'vi', 'en' và 'zh' đang trong quá trình cập nhật
const SUPPORTED = ['vi'];

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
