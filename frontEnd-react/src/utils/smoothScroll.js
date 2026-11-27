const HEADER_OFFSET_PX = 88;

let activeCancel = null;

function easeOutQuint(t) {
  return 1 - (1 - t) ** 5;
}

export function cancelSmoothScroll() {
  if (typeof activeCancel === 'function') {
    activeCancel();
    activeCancel = null;
  }
}

/**
 * Smoothly glides to an in-page section anchor (#features, #themes, #security, #faq, #top)
 * with distance-aware easing and immediate cancellation on manual user scroll input.
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

  const duration = Math.min(860, Math.max(460, Math.round(360 + Math.abs(delta) * 0.18)));
  const startTime = performance.now();
  let rafId = 0;

  const stopEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  const cleanup = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
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
    const eased = easeOutQuint(progress);
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
