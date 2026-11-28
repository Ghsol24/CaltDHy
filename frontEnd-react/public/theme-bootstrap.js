/* Restore the saved theme before the React bundle and application CSS load. */
(() => {
  const themes = ['dark', 'light', 'cream', 'green'];
  let theme = 'dark';

  try {
    const saved = localStorage.getItem('caltdhy_theme');
    if (themes.includes(saved)) theme = saved;
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }

  const root = document.documentElement;
  root.classList.add(`${theme}-theme`);

  const color = getComputedStyle(root).getPropertyValue('--theme-bootstrap-background').trim();
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);

  // Sync cold-start boot caption with saved display language before React mounts.
  try {
    const savedLang = localStorage.getItem('caltdhy_lang');
    const bootLabels = { en: 'Loading data…', 'zh-CN': '正在加载数据…' };
    if (savedLang && bootLabels[savedLang]) {
      document.addEventListener('DOMContentLoaded', () => {
        const statusEl = document.getElementById('calt-boot-status');
        if (statusEl) statusEl.textContent = bootLabels[savedLang];
      }, { once: true });
    }
  } catch {
    // Ignore storage errors in restricted contexts.
  }
})();
