import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';

// The palette, its copy and its CSS load on the first Ctrl/Cmd + K; only this listener ships with the app frame.
const CommandPalette = lazy(() => import('../ui/CommandPalette').then((module) => ({ default: module.CommandPalette })));

// Desktop only (NAV-12): the sidebar layout, i.e. wider than the 900px nav breakpoint.
const DESKTOP = '(min-width: 901px)';

const isTyping = (target) => target instanceof Element
  && (target.isContentEditable || target.closest('input, textarea, select, [role="listbox"], [role="menu"]') !== null);
const otherDialogOpen = () => document.querySelector('[aria-modal="true"]:not(.cmdk-panel)') !== null;

/** Ctrl/Cmd + K toggles the command palette; N alone adds a transaction when nothing is being typed. */
export function CommandPaletteHost() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey) return;
      if (!window.matchMedia(DESKTOP).matches) return;
      const key = event.key?.toLowerCase();
      if (key === 'k' && (event.metaKey || event.ctrlKey)) {
        if (otherDialogOpen()) return;
        event.preventDefault();
        setIsOpen((open) => !open);
      } else if (key === 'n' && !event.metaKey && !event.ctrlKey && !event.repeat
        && !isTyping(event.target) && !otherDialogOpen() && !document.querySelector('.cmdk-panel')) {
        event.preventDefault();
        useSpendingStore.getState().openAddTxnModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette onClose={() => setIsOpen(false)} />
    </Suspense>
  );
}
