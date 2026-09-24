import { useEffect, useRef } from 'react';

/**
 * Scroll spy with geometry measured only on mount and layout changes. The
 * scroll path reads scrollY and cached positions, so it cannot force layout.
 */
export function useSectionScrollSpy({ disabled = false, sections, onActiveChange, topOffset = 160 }) {
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  useEffect(() => {
    if (disabled) return undefined;

    let positions = [];
    let documentHeight = 0;
    let scrollFrame = 0;
    let measureFrame = 0;

    const updateActiveSection = () => {
      scrollFrame = 0;
      if (positions.length === 0) return;

      let activeTab = positions[0].tab;
      if (window.scrollY + window.innerHeight >= documentHeight - 4) {
        activeTab = positions[positions.length - 1].tab;
      } else {
        const focalPosition = window.scrollY + topOffset;
        for (const section of positions) {
          if (section.top <= focalPosition) activeTab = section.tab;
          else break;
        }
      }
      onActiveChangeRef.current(activeTab);
    };

    const targets = sections
      .map(([id, tab]) => ({ element: document.getElementById(id), tab }))
      .filter(({ element }) => Boolean(element));

    const measureSections = () => {
      measureFrame = 0;
      const scrollY = window.scrollY;
      positions = targets
        .map(({ element, tab }) => ({ tab, top: element.getBoundingClientRect().top + scrollY }))
        .sort((a, b) => a.top - b.top);
      documentHeight = document.documentElement.scrollHeight;
      updateActiveSection();
    };

    const scheduleScrollUpdate = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateActiveSection);
    };
    const scheduleMeasure = () => {
      if (!measureFrame) measureFrame = requestAnimationFrame(measureSections);
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(document.body);
    targets.forEach(({ element }) => resizeObserver?.observe(element));
    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    measureSections();

    return () => {
      window.removeEventListener('scroll', scheduleScrollUpdate);
      window.removeEventListener('resize', scheduleMeasure);
      resizeObserver?.disconnect();
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      if (measureFrame) cancelAnimationFrame(measureFrame);
    };
  }, [disabled, sections, topOffset]);
}
