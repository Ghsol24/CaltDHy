import { create } from 'zustand';

const KEY = 'caltdhy_theme';
const ALL_CLASSES = ['dark-theme', 'light-theme', 'cream-theme', 'green-theme'];

const applyThemeToDOM = (theme) => {
  const root = document.documentElement;
  ALL_CLASSES.forEach((c) => {
    root.classList.remove(c);
    if (document.body) document.body.classList.remove(c);
  });
  if (theme) {
    const themeClass = `${theme}-theme`;
    root.classList.add(themeClass);
    if (document.body) document.body.classList.add(themeClass);
  }
};

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && ['dark', 'light', 'cream', 'green'].includes(saved)) {
      applyThemeToDOM(saved);
      return saved;
    }
  } catch {}
  applyThemeToDOM('dark');
  return 'dark';
};

export const useThemeStore = create((set, get) => ({
  theme: getInitialTheme(),

  setTheme: (theme) => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
    applyThemeToDOM(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  }
}));
