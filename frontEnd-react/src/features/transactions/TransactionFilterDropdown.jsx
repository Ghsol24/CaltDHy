import React, { useEffect, useId, useRef, useState } from 'react';
import { useAnchoredPlacement } from '../../hooks/useAnchoredPlacement';
import { BottomSheet } from '../../components/ui/BottomSheet';

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
);

/**
 * A filter chip: shows the filter name while unused ("Ví") and the chosen value while
 * filtering ("ZaloPay"). Options open in an anchored menu, or in a bottom sheet on
 * phones (`sheet`), where a menu inside a sideways-scrolling chip row would be clipped.
 */
export function TransactionFilterDropdown({ label, options, value, onChange, active = false, sheet = false, valueText }) {
  const id = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];
  const shown = active ? valueText || selected?.label : label;
  // Chips wrap onto several rows, so a menu can start anywhere across the screen.
  const menuStyle = useAnchoredPlacement(rootRef, menuRef, isOpen && !sheet);

  useEffect(() => {
    // The sheet has its own backdrop; its options live outside this element.
    if (!isOpen || sheet) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [isOpen, sheet]);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current[focusedIndex]?.focus();
      optionRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, focusedIndex]);

  const openMenu = (index = selectedIndex) => {
    setFocusedIndex(index);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (option) => {
    onChange(option.value);
    close();
  };

  // React events bubble out of the sheet portal, so this also drives the sheet list.
  const onKeyDown = (event) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        openMenu(event.key === 'End' ? options.length - 1 : event.key === 'Home' ? 0 : selectedIndex);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      if (!sheet) setIsOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setFocusedIndex(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key.length === 1 && event.key !== ' ') {
      const start = (focusedIndex + 1) % options.length;
      const next = [...options.slice(start), ...options.slice(0, start)]
        .findIndex((option) => option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (next >= 0) setFocusedIndex((start + next) % options.length);
    }
  };

  const list = <div ref={menuRef} className={`transaction-filter-menu${sheet ? ' is-sheet' : ''}`} id={`${id}-list`}
    role="listbox" aria-labelledby={`${id}-label`} style={!sheet && menuStyle ? menuStyle : undefined}>
    {options.map((option, index) => <button key={option.value} ref={(element) => { optionRefs.current[index] = element; }}
      type="button" className={`transaction-filter-option${option.value === value ? ' is-selected' : ''}`}
      role="option" aria-selected={option.value === value} tabIndex={focusedIndex === index ? 0 : -1}
      onClick={() => choose(option)}>
      <span>{option.label}</span>
      {option.value === value && <CheckIcon />}
    </button>)}
  </div>;

  return <div className={`transaction-filter-dropdown is-compact${isOpen ? ' is-open' : ''}${active ? ' is-filtering' : ''}`}
    ref={rootRef} onKeyDown={onKeyDown}>
    <span className="transaction-filter-label" id={`${id}-label`}>{label}</span>
    <button ref={triggerRef} type="button" className="transaction-filter-trigger"
      aria-label={`${label}: ${valueText || selected?.label || label}`} aria-haspopup={sheet ? 'dialog' : 'listbox'}
      aria-expanded={isOpen} aria-controls={isOpen ? `${id}-list` : undefined}
      onClick={() => isOpen ? setIsOpen(false) : openMenu()}>
      <span className="transaction-filter-value">{shown}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {isOpen && (sheet
      ? <BottomSheet open onClose={close} title={label} className="transaction-filter-sheet">{list}</BottomSheet>
      : list)}
  </div>;
}
