import React, { useEffect, useRef } from 'react';

/**
 * A ⋮ menu that works from the keyboard (FORM-08): opening moves focus to the
 * first item, arrows/Home/End move between items, Escape closes and returns
 * focus to the button that opened it, Tab closes.
 */
export function MenuPopover({ className, label, onClose, triggerRef, children }) {
  const ref = useRef(null);
  const items = () => [...(ref.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];

  useEffect(() => {
    items()[0]?.focus();
  }, []);

  const onKeyDown = (event) => {
    const list = items();
    const index = list.indexOf(document.activeElement);
    const move = (next) => { event.preventDefault(); list[(next + list.length) % list.length]?.focus(); };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      triggerRef?.current?.focus();
    } else if (event.key === 'Tab') onClose();
  };

  return (
    <div ref={ref} className={className} role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}
