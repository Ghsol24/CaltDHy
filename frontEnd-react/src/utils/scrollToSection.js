// Glides the window to a block of the current page instead of opening another screen,
// then moves focus to the block's heading so keyboard and screen-reader users land
// there too. Honors "reduce motion" (jumps instantly) and stops if the user scrolls.
const SCROLL_DURATION = 600;
const CANCEL_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown'];
let cancelRunning = null;

const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - ((-2 * p + 2) ** 3) / 2);

function focusHeading(section) {
  const heading = section.querySelector('h1, h2, h3') || section;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

export function scrollToSection(id) {
  const section = document.getElementById(id);
  if (!section) return false;
  cancelRunning?.();

  const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  const startY = window.scrollY;
  const targetY = Math.max(0, Math.min(maxY, section.getBoundingClientRect().top + startY - margin));
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || Math.abs(targetY - startY) < 2) {
    window.scrollTo({ top: targetY, behavior: 'instant' });
    focusHeading(section);
    return true;
  }

  let frame = 0;
  const startTime = performance.now();
  const stop = () => {
    cancelAnimationFrame(frame);
    CANCEL_EVENTS.forEach((type) => window.removeEventListener(type, stop));
    if (cancelRunning === stop) cancelRunning = null;
  };
  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / SCROLL_DURATION);
    window.scrollTo({ top: startY + (targetY - startY) * easeInOutCubic(progress), behavior: 'instant' });
    if (progress < 1) {
      frame = requestAnimationFrame(step);
    } else {
      stop();
      focusHeading(section);
    }
  };
  // A click on the menu itself must not count as the user taking over the scroll.
  requestAnimationFrame(() => CANCEL_EVENTS.forEach((type) => window.addEventListener(type, stop, { passive: true })));
  cancelRunning = stop;
  frame = requestAnimationFrame(step);
  return true;
}
