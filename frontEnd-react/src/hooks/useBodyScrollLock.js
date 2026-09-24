import { useEffect } from 'react';

let activeLocks = 0;
let previousOverflow = '';

export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    if (activeLocks === 0) previousOverflow = document.body.style.overflow;
    activeLocks += 1;
    document.body.style.overflow = 'hidden';

    return () => {
      activeLocks -= 1;
      if (activeLocks === 0) document.body.style.overflow = previousOverflow;
    };
  }, [locked]);
}
