import React, { useState, useRef, useEffect, useId } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { WalletOutlineIcon } from './WalletOutlineIcon';

export function CustomWalletDropdown({
  wallets = [],
  value = '',
  onChange,
  allowNone = false,
  noneLabel = '-- Không đồng bộ ví (chỉ ghi nhận hũ độc lập) --',
  placeholder = 'Chọn ví / tài khoản...',
  disabled = false,
  id: explicitId,
  name,
  ariaLabel,
  className = '',
}) {
  const generatedId = useId();
  const triggerId = explicitId || generatedId;
  const listboxId = `${triggerId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  // Compute all available items (including none option if allowed)
  const items = [];
  if (allowNone) {
    items.push({ id: '', isNone: true, name: noneLabel });
  }
  wallets.forEach((w) => items.push(w));

  const selectedIndex = items.findIndex((item) => (item.id === '' ? value === '' : item.id === value));
  const selectedWallet = wallets.find((w) => w.id === value);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
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

  const handleSelect = (walletId) => {
    onChange?.(walletId);
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
      setHighlightedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIndex(items.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < items.length) {
        handleSelect(items[highlightedIndex].id);
      }
    }
  };

  return (
    <div
      className={`custom-wallet-dropdown ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={triggerId}
        name={name}
        type="button"
        className="custom-wallet-trigger"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel || (selectedWallet ? selectedWallet.name : placeholder)}
      >
        <div className="custom-wallet-selected-info">
          {selectedWallet ? (
            <>
              <span className="custom-wallet-icon" aria-hidden="true">
                <WalletOutlineIcon type={selectedWallet.type} size={18} color="currentColor" />
              </span>
              <div className="custom-wallet-text-group">
                <span className="custom-wallet-name">
                  {selectedWallet.name}
                  {selectedWallet.isDefault && <span className="custom-wallet-badge">Mặc định</span>}
                </span>
                <span className="custom-wallet-balance">
                  Số dư: {formatCurrency(selectedWallet.currentBalance ?? selectedWallet.initialBalance ?? 0)}
                </span>
              </div>
            </>
          ) : allowNone && value === '' ? (
            <span className="custom-wallet-none-text">{noneLabel}</span>
          ) : (
            <span className="custom-wallet-placeholder">{placeholder}</span>
          )}
        </div>

        {/* Animated Chevron */}
        <svg
          className={`custom-wallet-chevron ${isOpen ? 'rotate-180' : ''}`}
          width="16"
          height="16"
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

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          ref={menuRef}
          id={listboxId}
          className="custom-wallet-menu"
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={highlightedIndex >= 0 ? `${triggerId}-opt-${highlightedIndex}` : undefined}
        >
          {items.map((item, idx) => {
            const isSelected = item.id === '' ? value === '' : item.id === value;
            const isHighlighted = idx === highlightedIndex;

            if (item.isNone) {
              return (
                <div
                  key="__none__"
                  id={`${triggerId}-opt-${idx}`}
                  ref={(el) => (itemRefs.current[idx] = el)}
                  className={`custom-wallet-item custom-wallet-item--none ${isSelected ? 'is-active' : ''} ${
                    isHighlighted ? 'is-highlighted' : ''
                  }`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect('')}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="custom-wallet-item-content">
                    <span className="custom-wallet-item-none-title">{noneLabel}</span>
                  </div>
                  {isSelected && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="custom-wallet-check"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              );
            }

            const balance = item.currentBalance ?? item.initialBalance ?? 0;
            return (
              <div
                key={item.id}
                id={`${triggerId}-opt-${idx}`}
                ref={(el) => (itemRefs.current[idx] = el)}
                className={`custom-wallet-item ${isSelected ? 'is-active' : ''} ${
                  isHighlighted ? 'is-highlighted' : ''
                }`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(item.id)}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                <div className="custom-wallet-item-left">
                  <span className="custom-wallet-item-icon" aria-hidden="true">
                    <WalletOutlineIcon type={item.type} size={18} color="currentColor" />
                  </span>
                  <div className="custom-wallet-item-details">
                    <div className="custom-wallet-item-name-row">
                      <strong className="custom-wallet-item-name">{item.name}</strong>
                      {item.isDefault && <span className="custom-wallet-badge">Mặc định</span>}
                    </div>
                    <span className="custom-wallet-item-balance">
                      Số dư: <strong>{formatCurrency(balance)}</strong>
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="custom-wallet-check"
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
