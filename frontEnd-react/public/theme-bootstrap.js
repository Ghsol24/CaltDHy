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
})();
