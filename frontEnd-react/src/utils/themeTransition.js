import { flushSync } from 'react-dom';

const LIGHT_THEMES = ['light', 'green', 'cream'];
let lastLightTheme = 'light';

/**
 * Remember the user's most recent non-dark palette so the Quick Sun/Moon pill
 * returns to Green, Cream, or Light seamlessly instead of forcing one palette.
 */
export function rememberLightTheme(theme) {
  if (LIGHT_THEMES.includes(theme)) {
    lastLightTheme = theme;
  }
}

export function getPreferredLightTheme(currentTheme) {
  if (LIGHT_THEMES.includes(currentTheme)) return currentTheme;
  return lastLightTheme;
}

/**
 * Switches theme with a circular View Transitions API clip-path ripple originating
 * from the clicked control, matching modern native-feel theme toggles.
 * Falls back immediately when View Transitions are unsupported or reduced motion is on.
 */
export function switchThemeWithTransition(nextTheme, setTheme, event) {
  rememberLightTheme(nextTheme);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    reducedMotion
  ) {
    setTheme(nextTheme);
    return;
  }

  let x = window.innerWidth / 2;
  let y = 40;
  const target = event?.currentTarget;
  if (target && typeof target.getBoundingClientRect === 'function') {
    const rect = target.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  } else if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
    x = event.clientX;
    y = event.clientY;
  }

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = document.startViewTransition(() => {
    flushSync(() => {
      setTheme(nextTheme);
    });
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {});
}
