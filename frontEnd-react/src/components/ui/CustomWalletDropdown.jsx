import React, { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';

export function CustomWalletDropdown({
  wallets = [],
  value = '',
  onChange,
  allowNone = false,
  noneLabel = '-- Không đồng bộ ví (chỉ ghi nhận hũ độc lập) --',
  placeholder = 'Chọn ví / tài khoản...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const selectedWallet = wallets.find((w) => w.id === value);

  const handleSelect = (walletId) => {
    onChange(walletId);
    setIsOpen(false);
  };

  return (
    <div className={`custom-wallet-dropdown ${isOpen ? 'is-open' : ''}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className="custom-wallet-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="custom-wallet-selected-info">
          {selectedWallet ? (
            <>
              <span className="custom-wallet-icon" aria-hidden="true">
                {selectedWallet.icon || '💳'}
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
          ) : allowNone ? (
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
        <div className="custom-wallet-menu" role="listbox">
          {allowNone && (
            <div
              className={`custom-wallet-item custom-wallet-item--none ${value === '' ? 'is-active' : ''}`}
              role="option"
              aria-selected={value === ''}
              onClick={() => handleSelect('')}
            >
              <div className="custom-wallet-item-content">
                <span className="custom-wallet-item-none-title">
                  {noneLabel}
                </span>
              </div>
              {value === '' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="custom-wallet-check">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          )}

          {wallets.map((wallet) => {
            const isSelected = wallet.id === value;
            const balance = wallet.currentBalance ?? wallet.initialBalance ?? 0;
            return (
              <div
                key={wallet.id}
                className={`custom-wallet-item ${isSelected ? 'is-active' : ''}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(wallet.id)}
              >
                <div className="custom-wallet-item-left">
                  <span className="custom-wallet-item-icon" aria-hidden="true">
                    {wallet.icon || '💳'}
                  </span>
                  <div className="custom-wallet-item-details">
                    <div className="custom-wallet-item-name-row">
                      <strong className="custom-wallet-item-name">{wallet.name}</strong>
                      {wallet.isDefault && <span className="custom-wallet-badge">Mặc định</span>}
                    </div>
                    <span className="custom-wallet-item-balance">
                      Số dư: <strong>{formatCurrency(balance)}</strong>
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="custom-wallet-check">
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
