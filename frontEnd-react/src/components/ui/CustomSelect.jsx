import React, { useState, useRef, useEffect, useId } from 'react';

/**
 * CustomSelect - Premium SaaS Accessible Dropdown Component
 * Conforms to WAI-ARIA 1.2 Listbox pattern.
 * Fully compatible with CaltDHy's 4 themes (Dark, Cream, Green, Light).
 */
export function CustomSelect({
  id: explicitId,
  name,
  options = [],
  value = '',
  onChange,
  placeholder = 'Chọn một tùy chọn...',
  prefixIcon = null,
  prefixLabel = null,
  size = 'md', // 'sm' | 'md' | 'lg'
  variant = 'default', // 'default' | 'subtle' | 'pill' | 'ghost'
  disabled = false,
  className = '',
  align = 'left', // 'left' | 'right'
  menuWidth = null,
  ariaLabel,
}) {
  const generatedId = useId();
  const triggerId = explicitId || generatedId;
  const listboxId = `${triggerId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);

  // Normalize options array into objects: { value, label, icon, badge, disabled }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value : opt.id,
        label: opt.label !== undefined ? opt.label : opt.name || String(opt.value),
        icon: opt.icon || null,
        badge: opt.badge || null,
        disabled: Boolean(opt.disabled),
      };
    }
    return {
      value: opt,
      label: String(opt),
      icon: null,
      badge: null,
      disabled: false,
    };
  });

  const selectedIndex = normalizedOptions.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  const openDropdown = () => {
    if (disabled) return;
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleSelect = (val, isOptionDisabled) => {
    if (isOptionDisabled) return;
    onChange?.(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        let next = (prev + 1) % normalizedOptions.length;
        while (normalizedOptions[next]?.disabled && next !== prev) {
          next = (next + 1) % normalizedOptions.length;
        }
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        let next = (prev - 1 + normalizedOptions.length) % normalizedOptions.length;
        while (normalizedOptions[next]?.disabled && next !== prev) {
          next = (next - 1 + normalizedOptions.length) % normalizedOptions.length;
        }
        return next;
      });
    } else if (e.key === 'Home') {
      e.preventDefault();
      const firstEnabled = normalizedOptions.findIndex((o) => !o.disabled);
      setHighlightedIndex(firstEnabled >= 0 ? firstEnabled : 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      const lastIndex = normalizedOptions.length - 1;
      setHighlightedIndex(lastIndex);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
        const target = normalizedOptions[highlightedIndex];
        if (!target.disabled) {
          handleSelect(target.value, false);
        }
      }
    } else if (e.key.length === 1 && e.key !== ' ') {
      // Typeahead character matching
      const char = e.key.toLowerCase();
      const start = (highlightedIndex + 1) % normalizedOptions.length;
      const matchIndex = [...normalizedOptions.slice(start), ...normalizedOptions.slice(0, start)]
        .findIndex((opt) => !opt.disabled && opt.label.toLowerCase().startsWith(char));
      if (matchIndex >= 0) {
        setHighlightedIndex((start + matchIndex) % normalizedOptions.length);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`calt-custom-select calt-custom-select--${size} calt-custom-select--${variant} ${
        isOpen ? 'is-open' : ''
      } ${disabled ? 'is-disabled' : ''} ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        name={name}
        type="button"
        className="calt-custom-select-trigger"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel || (selectedOption ? selectedOption.label : placeholder)}
      >
        <span className="calt-custom-select-trigger-content">
          {prefixIcon && (
            <span className="calt-custom-select-prefix-icon" aria-hidden="true">
              {prefixIcon}
            </span>
          )}
          {prefixLabel && (
            <span className="calt-custom-select-prefix-label">{prefixLabel}</span>
          )}
          <span className="calt-custom-select-value">
            {selectedOption ? selectedOption.label : <span className="calt-custom-select-placeholder">{placeholder}</span>}
          </span>
          {selectedOption?.badge && (
            <span className="calt-custom-select-item-badge">{selectedOption.badge}</span>
          )}
        </span>

        {/* Outline Chevron */}
        <svg
          className={`calt-custom-select-chevron ${isOpen ? 'rotate-180' : ''}`}
          width={size === 'sm' ? 13 : 15}
          height={size === 'sm' ? 13 : 15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          id={listboxId}
          className={`calt-custom-select-menu calt-custom-select-menu--align-${align}`}
          role="listbox"
          tabIndex={-1}
          style={menuWidth ? { width: menuWidth, minWidth: menuWidth } : undefined}
          aria-activedescendant={highlightedIndex >= 0 ? `${triggerId}-opt-${highlightedIndex}` : undefined}
        >
          {normalizedOptions.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIndex;

            return (
              <div
                key={String(opt.value)}
                id={`${triggerId}-opt-${idx}`}
                ref={(el) => (optionRefs.current[idx] = el)}
                className={`calt-custom-select-item ${isSelected ? 'is-selected' : ''} ${
                  isHighlighted ? 'is-highlighted' : ''
                } ${opt.disabled ? 'is-disabled' : ''}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onClick={() => handleSelect(opt.value, opt.disabled)}
                onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
              >
                <div className="calt-custom-select-item-content">
                  {opt.icon && (
                    <span className="calt-custom-select-item-icon" aria-hidden="true">
                      {opt.icon}
                    </span>
                  )}
                  <span className="calt-custom-select-item-label">{opt.label}</span>
                  {opt.badge && (
                    <span className="calt-custom-select-item-badge">{opt.badge}</span>
                  )}
                </div>

                {isSelected && (
                  <svg
                    className="calt-custom-select-check"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
