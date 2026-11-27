const HEADER_OFFSET_PX = 88;

let activeCancel = null;

/**
 * Cubic ease-in-out matching tryliner.fun's measured topbar glide:
 * gentle ramp-up (6.25% at 25% time), smooth midpoint (50% at 50%), soft cushion at landing.
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

export function cancelSmoothScroll() {
  if (typeof activeCancel === 'function') {
    activeCancel();
    activeCancel = null;
  }
}

/**
 * Smoothly glides to an in-page section anchor (#features, #themes, #security, #faq, #top)
 * using tryliner.fun's measured duration curve: min(1200, 500 + distance * 0.14) ms.
 */
export function smoothScrollToHash(hash, event, { updateHistory = true } = {}) {
  if (typeof window === 'undefined' || !hash || !hash.startsWith('#')) return false;

  const isTop = hash === '#top';
  const target = isTop ? null : document.getElementById(hash.slice(1));
  if (!isTop && !target) return false;

  if (event) {
    event.preventDefault();
  }

  cancelSmoothScroll();

  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  let targetY = 0;
  if (!isTop && target) {
    const computedMargin = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop);
    const offset = Number.isFinite(computedMargin) && computedMargin > 0 ? computedMargin : HEADER_OFFSET_PX;
    targetY = Math.min(maxScroll, Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - offset)));
  }

  if (updateHistory && typeof window.history?.pushState === 'function') {
    const nextUrl = isTop ? window.location.pathname : `${window.location.pathname}${hash}`;
    if (`${window.location.pathname}${window.location.hash}` !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
    }
  }

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const startY = window.scrollY;
  const delta = targetY - startY;

  if (reducedMotion || Math.abs(delta) < 2) {
    window.scrollTo({ top: targetY, behavior: 'instant' });
    return true;
  }

  const duration = Math.min(1200, Math.round(500 + Math.abs(delta) * 0.14));
  const startTime = performance.now();
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  let rafId = 0;

  const stopEvents = ['wheel', 'touchstart', 'mousedown', 'keydown'];
  const cleanup = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    root.style.scrollBehavior = previousScrollBehavior;
    stopEvents.forEach((evt) => window.removeEventListener(evt, handleInterrupt));
    if (activeCancel === cleanup) {
      activeCancel = null;
    }
  };

  const handleInterrupt = (evt) => {
    if (evt.type === 'keydown') {
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (!scrollKeys.includes(evt.key)) return;
    }
    cleanup();
  };

  stopEvents.forEach((evt) => window.addEventListener(evt, handleInterrupt, { passive: true }));
  activeCancel = cleanup;

  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = easeInOutCubic(progress);
    window.scrollTo({ top: startY + delta * eased, behavior: 'instant' });

    if (progress < 1) {
      rafId = window.requestAnimationFrame(step);
    } else {
      window.scrollTo({ top: targetY, behavior: 'instant' });
      cleanup();
    }
  };

  rafId = window.requestAnimationFrame(step);
  return true;
}
