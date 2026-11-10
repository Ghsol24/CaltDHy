import { useEffect, useState } from 'react';

// Shared layout breakpoints (max-width, px). CSS media queries use the same
// numbers — see the "Breakpoints" note in assets/css/tokens.css — so a
// component never ends up half in phone layout and half in tablet layout.
export const BREAKPOINTS = Object.freeze({
  smallPhone: 480,
  phone: 599, // phones are narrower than 600px; 600px and up is tablet
  tablet: 768,
  nav: 900, // sidebar ↔ bottom navigation
  laptop: 1024,
  desktop: 1280
});

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(query).matches
  ));

  useEffect(() => {
    const media = window.matchMedia(query);
    const syncMatch = () => setMatches(media.matches);
    syncMatch();
    media.addEventListener?.('change', syncMatch);
    return () => media.removeEventListener?.('change', syncMatch);
  }, [query]);

  return matches;
}

export function useIsMobile(maxWidth = BREAKPOINTS.nav) {
  return useMediaQuery(`(max-width: ${maxWidth}px)`);
}
