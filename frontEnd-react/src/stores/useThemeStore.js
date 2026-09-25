import { create } from 'zustand';

const KEY = 'caltdhy_theme';
const THEMES = ['dark', 'light', 'cream', 'green'];
const ALL_CLASSES = THEMES.map((theme) => `${theme}-theme`);

const normalizeTheme = (theme) => THEMES.includes(theme) ? theme : 'dark';

const updateThemeColor = () => {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const color = styles.getPropertyValue('--bg').trim()
    || styles.getPropertyValue('--theme-bootstrap-background').trim();
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
};

const applyThemeToDOM = (theme) => {
  const root = document.documentElement;
  ALL_CLASSES.forEach((c) => {
    root.classList.remove(c);
    if (document.body) document.body.classList.remove(c);
  });
  const themeClass = `${normalizeTheme(theme)}-theme`;
  root.classList.add(themeClass);
  if (document.body) document.body.classList.add(themeClass);
  updateThemeColor();
};

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (THEMES.includes(saved)) {
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
    const next = normalizeTheme(theme);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    applyThemeToDOM(next);
    set({ theme: next });
  },

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  }
}));
