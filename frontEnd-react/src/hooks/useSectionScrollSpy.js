import { useEffect, useRef } from 'react';

/**
 * Scroll spy with geometry measured only on mount and layout changes. The
 * scroll path reads scrollY and cached positions, so it cannot force layout.
 *
 * `sections` is a stable array of [elementId, value] pairs. The value of the
 * section above the focal line is reported (a section may map to `null`, e.g.
 * a page header that has no menu item); reaching the bottom of a scrolled page
 * reports the last section. `onActiveChange` only fires when the value changes.
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
    let reported;

    const updateActiveSection = () => {
      scrollFrame = 0;
      if (positions.length === 0) return;

      let activeValue = positions[0].value;
      // Only a page that has actually been scrolled can "reach the bottom"; a page
      // shorter than the window keeps the focal-line rule.
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= documentHeight - 4) {
        activeValue = positions[positions.length - 1].value;
      } else {
        const focalPosition = window.scrollY + topOffset;
        for (const section of positions) {
          if (section.top <= focalPosition) activeValue = section.value;
          else break;
        }
      }
      if (activeValue === reported) return;
      reported = activeValue;
      onActiveChangeRef.current(activeValue);
    };

    const targets = sections
      .map(([id, value]) => ({ element: document.getElementById(id), value }))
      .filter(({ element }) => Boolean(element));

    const measureSections = () => {
      measureFrame = 0;
      const scrollY = window.scrollY;
      positions = targets
        .map(({ element, value }) => ({ value, top: element.getBoundingClientRect().top + scrollY }))
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
