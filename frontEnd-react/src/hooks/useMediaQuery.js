import { useEffect, useState } from 'react';

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

export function useIsMobile(maxWidth = 900) {
  return useMediaQuery(`(max-width: ${maxWidth}px)`);
}
