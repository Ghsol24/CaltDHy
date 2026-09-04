import React, { useState, useEffect, useRef } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency } from '../../utils/formatters';
import { WalletOutlineIcon } from './WalletsTab';

const PRESET_COLORS = [
  '#078A59', // Brand Mint Emerald
  '#2563EB', // Royal Blue
  '#7C3AED', // Vivid Purple
  '#EA580C', // Deep Orange
  '#DC2626', // Crimson Red
  '#0891B2', // Cyan Teal
  '#4F46E5', // Indigo
  '#D97706', // Amber Gold
  '#059669', // Medium Sea Green
  '#475569'  // Slate Gray
];

const getWalletIconByType = (walletType) => {
  return '';
};

export function WalletModal({ isOpen, onClose, walletToEdit = null }) {
  const { createWallet, updateWallet } = useWalletStore();
  const { addToast } = useToastStore();

  const isEditing = Boolean(walletToEdit);

  const [name, setName] = useState('');
  const [type, setType] = useState('cash');
  const [initialBalance, setInitialBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [color, setColor] = useState('#078A59');
  const [isDefault, setIsDefault] = useState(false);
  const [isExcludedFromTotal, setIsExcludedFromTotal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const modalRef = useRef(null);
  const nameInputRef = useRef(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    if (walletToEdit) {
      setName(walletToEdit.name || '');
      setType(walletToEdit.type || 'cash');
      setInitialBalance(
        walletToEdit.initialBalance !== undefined
          ? Number(walletToEdit.initialBalance).toLocaleString('vi-VN')
          : ''
      );
      setCreditLimit(
        walletToEdit.creditLimit !== undefined && walletToEdit.creditLimit > 0
          ? Number(walletToEdit.creditLimit).toLocaleString('vi-VN')
          : ''
      );
      setColor(walletToEdit.color || '#078A59');
      setIsDefault(Boolean(walletToEdit.isDefault));
      setIsExcludedFromTotal(Boolean(walletToEdit.isExcludedFromTotal));
      setErrorMsg('');
    } else {
      // New wallet defaults
      setName('');
      setType('cash');
      setInitialBalance('');
      setCreditLimit('');
      setColor('#078A59');
      setIsDefault(false);
      setIsExcludedFromTotal(false);
      setErrorMsg('');
    }

    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, walletToEdit]);

  if (!isOpen) return null;

  // Handle Type Change
  const handleTypeChange = (newType) => {
    setType(newType);
  };

  const handleBalanceChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setInitialBalance('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setInitialBalance(num ? num.toLocaleString('vi-VN') : '');
  };

  const handleLimitChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setCreditLimit('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setCreditLimit(num ? num.toLocaleString('vi-VN') : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên ví hoặc tài khoản.');
      nameInputRef.current?.focus();
      return;
    }

    const cleanBalance = initialBalance ? parseInt(String(initialBalance).replace(/\D/g, ''), 10) : 0;
    const cleanCreditLimit = creditLimit ? parseInt(String(creditLimit).replace(/\D/g, ''), 10) : 0;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        initialBalance: cleanBalance,
        creditLimit: type === 'credit' ? cleanCreditLimit : 0,
        icon: walletToEdit?.icon || getWalletIconByType(type),
        color: color || '#078A59',
        isDefault,
        isExcludedFromTotal
      };

      if (isEditing) {
        await updateWallet(walletToEdit.id, payload);
        setIsSubmitting(false);
        onClose();
        addToast({
          type: 'success',
          message: `Đã cập nhật ví "${payload.name}".`,
          duration: 4000
        });
      } else {
        await createWallet(payload);
        setIsSubmitting(false);
        onClose();
        addToast({
          type: 'success',
          message: `Đã thêm ví mới "${payload.name}" với số dư ban đầu ${formatCurrency(cleanBalance)}.`,
          duration: 4000
        });
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Lỗi khi lưu thông tin ví.');
    }
  };

  return (
    <div
      className="txn-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="txn-modal-card modal-pro-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
      >
        {/* Header */}
        <div className="txn-modal-header modal-pro-header">
          <div className="modal-pro-header-left">
            <div className="modal-header-icon-badge" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div className="modal-pro-header-titles">
              <h2 id="wallet-modal-title" className="txn-modal-title modal-pro-title">
                {isEditing ? 'Chỉnh sửa ví / tài khoản' : 'Thêm ví / tài khoản mới'}
              </h2>
              <p className="modal-pro-subtitle">
                {isEditing
                  ? 'Cập nhật thông tin ví hoặc tài khoản của bạn'
                  : 'Tạo mới một ví hoặc liên kết tài khoản ngân hàng'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="txn-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="txn-modal-body modal-pro-body">
            {/* 1. Loại ví / tài khoản */}
            <div className="txn-field-group">
              <label className="modal-section-label">
                <span>1. Loại ví / tài khoản</span>
              </label>
              <div className="wallet-type-grid-pro" role="radiogroup" aria-label="Loại ví">
                {[
                  { id: 'cash', label: 'Tiền mặt' },
                  { id: 'bank', label: 'Ngân hàng' },
                  { id: 'credit', label: 'Thẻ tín dụng' },
                  { id: 'e-wallet', label: 'Ví điện tử' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={type === item.id}
                    className={`wallet-type-card-pro ${type === item.id ? 'active' : ''}`}
                    onClick={() => handleTypeChange(item.id)}
                  >
                    <div className="wallet-type-icon-box">
                      <WalletOutlineIcon type={item.id} size={22} color="currentColor" />
                    </div>
                    <span className="wallet-type-card-title">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Tên ví / tài khoản */}
            <div className="txn-field-group">
              <label htmlFor="wallet-name" className="modal-section-label">
                <span>2. Tên ví / tài khoản</span>
              </label>
              <div className="modal-input-icon-wrap">
                <span className="modal-input-prefix-icon tag" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </span>
                <input
                  id="wallet-name"
                  ref={nameInputRef}
                  type="text"
                  className="modal-pro-input with-prefix with-clear"
                  placeholder="VD: Ví tiền mặt, MB Bank, MoMo, Techcom Visa..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  required
                />
                {name && (
                  <button
                    type="button"
                    className="modal-input-clear-btn"
                    onClick={() => {
                      setName('');
                      nameInputRef.current?.focus();
                    }}
                    aria-label="Xóa tên ví"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="10" opacity="0.18" />
                      <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 3. Số dư khởi tạo */}
            <div className="txn-field-group">
              <label htmlFor="wallet-balance" className="modal-section-label">
                <span>3. Số dư khởi tạo</span>
              </label>
              <div className="modal-pro-amount-box">
                <div className="amount-prefix-badge wallet" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                    <circle cx="17" cy="14" r="1.5" />
                  </svg>
                </div>
                <input
                  id="wallet-balance"
                  type="text"
                  inputMode="numeric"
                  className="modal-pro-amount-input"
                  placeholder="0"
                  value={initialBalance}
                  onChange={handleBalanceChange}
                />
                <div className="amount-currency-pill" title="Đơn vị tiền tệ">
                  <span>VNĐ</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
              <p className="modal-field-hint">Nhập số dư hiện có khi tạo ví</p>
            </div>

            {/* Hạn mức thẻ tín dụng (Chỉ hiển thị khi chọn loại thẻ tín dụng) */}
            {type === 'credit' && (
              <div className="txn-field-group">
                <label htmlFor="wallet-limit" className="modal-section-label">
                  <span>Hạn mức thẻ tín dụng</span>
                </label>
                <div className="modal-pro-amount-box">
                  <div className="amount-prefix-badge credit-card" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                  </div>
                  <input
                    id="wallet-limit"
                    type="text"
                    inputMode="numeric"
                    className="modal-pro-amount-input"
                    placeholder="0"
                    value={creditLimit}
                    onChange={handleLimitChange}
                  />
                  <div className="amount-currency-pill">
                    <span>VNĐ</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Màu nhận diện */}
            <div className="txn-field-group">
              <label className="modal-section-label">
                <span>4. Màu nhận diện</span>
              </label>
              <div className="wallet-color-presets-pro">
                {PRESET_COLORS.map((hex) => {
                  const isSelected = color.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      className={`wallet-color-dot-pro ${isSelected ? 'active' : ''}`}
                      style={{ backgroundColor: hex }}
                      onClick={() => setColor(hex)}
                      aria-label={`Màu ${hex}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* 5. Tùy chọn */}
            <div className="txn-field-group">
              <label className="modal-section-label">
                <span>5. Tùy chọn</span>
              </label>
              <div className="wallet-options-stack">
                {/* Option 1: Đặt làm ví mặc định */}
                <div
                  className={`wallet-option-card-pro ${isDefault ? 'active' : ''}`}
                  onClick={() => setIsDefault(!isDefault)}
                  role="checkbox"
                  aria-checked={isDefault}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setIsDefault(!isDefault);
                    }
                  }}
                >
                  <div className="option-check-wrap">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="option-native-checkbox"
                      aria-hidden="true"
                    />
                    <span className={`option-custom-checkbox ${isDefault ? 'checked' : ''}`}>
                      {isDefault && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </div>

                  <div className="option-icon-symbol sparkle" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                    </svg>
                  </div>

                  <div className="option-content">
                    <strong className="option-title">Đặt làm ví mặc định</strong>
                    <p className="option-desc">Tự động chọn ví này khi mở popup thêm giao dịch mới</p>
                  </div>
                </div>

                {/* Option 2: Không tính vào tổng tài sản chi tiêu */}
                <div
                  className={`wallet-option-card-pro ${isExcludedFromTotal ? 'active' : ''}`}
                  onClick={() => setIsExcludedFromTotal(!isExcludedFromTotal)}
                  role="checkbox"
                  aria-checked={isExcludedFromTotal}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setIsExcludedFromTotal(!isExcludedFromTotal);
                    }
                  }}
                >
                  <div className="option-check-wrap">
                    <input
                      type="checkbox"
                      checked={isExcludedFromTotal}
                      onChange={(e) => setIsExcludedFromTotal(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="option-native-checkbox"
                      aria-hidden="true"
                    />
                    <span className={`option-custom-checkbox ${isExcludedFromTotal ? 'checked' : ''}`}>
                      {isExcludedFromTotal && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </div>

                  <div className="option-icon-symbol lock" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>

                  <div className="option-content">
                    <strong className="option-title">Không tính vào tổng tài sản chi tiêu</strong>
                    <p className="option-desc">Phù hợp cho tài khoản tiết kiệm dài hạn hoặc tài khoản doanh nghiệp</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="txn-error-banner" role="alert">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="txn-modal-footer">
            <button
              type="button"
              className="txn-btn-cancel modal-btn-cancel-pro"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="txn-btn-submit modal-btn-submit-pro"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{isEditing ? 'Cập nhật ví' : 'Tạo ví mới'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
