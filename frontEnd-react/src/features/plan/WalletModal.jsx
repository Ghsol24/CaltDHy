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
        className="txn-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
      >
        {/* Header */}
        <div className="txn-modal-header">
          <h2 id="wallet-modal-title" className="txn-modal-title">
            {isEditing ? 'Chỉnh sửa ví / tài khoản' : 'Thêm ví / tài khoản mới'}
          </h2>
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
          <div className="txn-modal-body">
            {/* Wallet Type Segment */}
            <div className="txn-field-group">
              <label className="txn-label">
                <span>Loại ví / tài khoản</span>
              </label>
              <div className="wallet-type-grid" role="radiogroup" aria-label="Loại ví">
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
                    className={`wallet-type-pill ${type === item.id ? 'active' : ''}`}
                    onClick={() => handleTypeChange(item.id)}
                  >
                    <WalletOutlineIcon type={item.id} size={18} color="currentColor" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Wallet Name */}
            <div className="txn-field-group">
              <label htmlFor="wallet-name" className="txn-label">
                <span>Tên ví / tài khoản</span>
              </label>
              <input
                id="wallet-name"
                ref={nameInputRef}
                type="text"
                className="txn-input"
                placeholder="VD: Ví tiền mặt, MB Bank, MoMo, Techcom Visa..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
              />
            </div>

            {/* Initial Balance */}
            <div className="txn-field-group">
              <label htmlFor="wallet-balance" className="txn-label">
                <span>{isEditing ? 'Số dư khởi tạo' : 'Số dư hiện tại ban đầu'}</span>
              </label>
              <div className="txn-amount-box">
                <input
                  id="wallet-balance"
                  type="text"
                  inputMode="numeric"
                  className="txn-amount-input"
                  placeholder="0"
                  value={initialBalance}
                  onChange={handleBalanceChange}
                />
                <span className="txn-amount-suffix">VNĐ</span>
              </div>
            </div>

            {/* Credit Limit (Only for Credit Card type) */}
            {type === 'credit' && (
              <div className="txn-field-group">
                <label htmlFor="wallet-limit" className="txn-label">
                  <span>Hạn mức thẻ tín dụng</span>
                </label>
                <div className="txn-amount-box">
                  <input
                    id="wallet-limit"
                    type="text"
                    inputMode="numeric"
                    className="txn-amount-input"
                    placeholder="0"
                    value={creditLimit}
                    onChange={handleLimitChange}
                  />
                  <span className="txn-amount-suffix">VNĐ</span>
                </div>
              </div>
            )}


            {/* Color Palette */}
            <div className="txn-field-group">
              <label className="txn-label">
                <span>Màu nhận diện</span>
              </label>
              <div className="wallet-color-presets">
                {PRESET_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`wallet-color-dot ${color === hex ? 'active' : ''}`}
                    style={{ backgroundColor: hex }}
                    onClick={() => setColor(hex)}
                    aria-label={`Màu ${hex}`}
                  />
                ))}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="wallet-checkbox-list">
              <label className="wallet-checkbox-label">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="wallet-checkbox-input"
                />
                <span className="wallet-checkbox-text">
                  <strong>Đặt làm ví mặc định</strong>
                  <small>Tự động chọn ví này khi mở popup thêm giao dịch mới</small>
                </span>
              </label>

              <label className="wallet-checkbox-label">
                <input
                  type="checkbox"
                  checked={isExcludedFromTotal}
                  onChange={(e) => setIsExcludedFromTotal(e.target.checked)}
                  className="wallet-checkbox-input"
                />
                <span className="wallet-checkbox-text">
                  <strong>Không tính vào tổng tài sản chi tiêu</strong>
                  <small>Phù hợp cho tài khoản tiết kiệm dài hạn hoặc tài khoản doanh nghiệp</small>
                </span>
              </label>
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
              className="txn-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="txn-btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Đang lưu...</span>
                </>
              ) : isEditing ? (
                'Cập nhật ví'
              ) : (
                'Tạo ví mới'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
