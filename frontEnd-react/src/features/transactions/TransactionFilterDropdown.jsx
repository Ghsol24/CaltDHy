import React, { useEffect, useId, useRef, useState } from 'react';

export function TransactionFilterDropdown({ label, options, value, onChange, compact = false }) {
  const id = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [isOpen]);

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

  const choose = (option) => {
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

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
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      setIsOpen(false);
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

  return <div className={`transaction-filter-dropdown${isOpen ? ' is-open' : ''}${compact ? ' is-compact' : ''}`}
    ref={rootRef} onKeyDown={onKeyDown}>
    <span className="transaction-filter-label" id={`${id}-label`}>{label}</span>
    <button ref={triggerRef} type="button" className="transaction-filter-trigger"
      aria-label={`${label}: ${selected?.label || label}`} aria-haspopup="listbox"
      aria-expanded={isOpen} aria-controls={isOpen ? `${id}-list` : undefined}
      onClick={() => isOpen ? setIsOpen(false) : openMenu()}>
      <span id={`${id}-value`} className="transaction-filter-value">
        {compact && <span className="transaction-filter-prefix">{label}: </span>}{selected?.label || label}
      </span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {isOpen && <div className="transaction-filter-menu" id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>
      {options.map((option, index) => <button key={option.value} ref={(element) => { optionRefs.current[index] = element; }}
        type="button" className={`transaction-filter-option${option.value === value ? ' is-selected' : ''}`}
        role="option" aria-selected={option.value === value} tabIndex={focusedIndex === index ? 0 : -1}
        onClick={() => choose(option)}>
        <span>{option.label}</span>
        {option.value === value && <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12 4 4L19 6" />
        </svg>}
      </button>)}
    </div>}
  </div>;
}
