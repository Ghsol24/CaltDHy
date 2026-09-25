import { create } from 'zustand';
import { THEME_OPTIONS } from '../utils/themes';

const KEY = 'caltdhy_theme';
const THEMES = THEME_OPTIONS.map(({ id }) => id);
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

// Theme is a device preference: logout keeps it, and other tabs should pick up
// the most recent choice without writing it back and causing a storage loop.
const restoreSavedTheme = () => {
  try {
    const theme = normalizeTheme(localStorage.getItem(KEY));
    if (theme === useThemeStore.getState().theme) return;
    applyThemeToDOM(theme);
    useThemeStore.setState({ theme });
  } catch {}
};
window.addEventListener('storage', (event) => {
  if (event.key === KEY || event.key === null) restoreSavedTheme();
});
window.addEventListener('pageshow', restoreSavedTheme);
window.addEventListener('focus', restoreSavedTheme);
