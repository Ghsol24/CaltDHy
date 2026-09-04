import React, { useState, useEffect, useRef } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency, getLocalDateString } from '../../utils/formatters';
import { WalletOutlineIcon } from './WalletsTab';

export function TransferModal({ isOpen, onClose, initialFromWalletId = null }) {
  const { wallets, transferMoney, fetchWallets } = useWalletStore();
  const { addToast } = useToastStore();

  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(() => getLocalDateString());
  const [desc, setDesc] = useState('Chuyển tiền ví');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const modalRef = useRef(null);
  const amountInputRef = useRef(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (isOpen && wallets.length === 0) {
      fetchWallets();
    }
  }, [isOpen, wallets.length, fetchWallets]);

  useEffect(() => {
    if (!isOpen) return;

    // Set initial fromWalletId
    let initialFrom = initialFromWalletId;
    if (!initialFrom && wallets.length > 0) {
      initialFrom = wallets[0].id;
    }
    setFromWalletId(initialFrom || '');

    // Set initial toWalletId to a different wallet
    if (wallets.length > 1) {
      const otherWallet = wallets.find((w) => w.id !== initialFrom);
      setToWalletId(otherWallet ? otherWallet.id : '');
    } else {
      setToWalletId('');
    }

    setAmount('');
    setFee('');
    setDate(getLocalDateString());
    setDesc('Chuyển tiền ví');
    setErrorMsg('');

    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, initialFromWalletId, wallets]);

  if (!isOpen) return null;

  const handleAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setAmount('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setAmount(num ? num.toLocaleString('vi-VN') : '');
  };

  const handleFeeChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setFee('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setFee(num ? num.toLocaleString('vi-VN') : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fromWalletId) {
      setErrorMsg('Vui lòng chọn ví nguồn (tài khoản chuyển).');
      return;
    }

    if (!toWalletId) {
      setErrorMsg('Vui lòng chọn ví đích (tài khoản nhận).');
      return;
    }

    if (fromWalletId === toWalletId) {
      setErrorMsg('Ví nguồn và ví đích không được trùng nhau.');
      return;
    }

    const cleanAmount = parseInt(String(amount).replace(/\D/g, ''), 10);
    if (!cleanAmount || cleanAmount <= 0) {
      setErrorMsg('Vui lòng nhập số tiền chuyển hợp lệ (> 0).');
      amountInputRef.current?.focus();
      return;
    }

    const cleanFee = fee ? parseInt(String(fee).replace(/\D/g, ''), 10) : 0;

    setIsSubmitting(true);
    try {
      const fromWallet = wallets.find((w) => w.id === fromWalletId);
      const toWallet = wallets.find((w) => w.id === toWalletId);

      await transferMoney({
        fromWalletId,
        toWalletId,
        amount: cleanAmount,
        fee: cleanFee,
        date,
        desc: desc.trim() || 'Chuyển tiền ví'
      });

      setIsSubmitting(false);
      onClose();
      addToast({
        type: 'success',
        message: `Đã chuyển ${formatCurrency(cleanAmount)} từ ${fromWallet?.name || 'ví'} sang ${toWallet?.name || 'ví'}.`,
        duration: 4500
      });
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Lỗi khi thực hiện chuyển tiền ví.');
    }
  };

  const fromWallet = wallets.find((w) => w.id === fromWalletId);
  const toWallet = wallets.find((w) => w.id === toWalletId);

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
        aria-labelledby="transfer-modal-title"
      >
        {/* Header */}
        <div className="txn-modal-header modal-pro-header">
          <div className="modal-pro-header-left">
            <div className="modal-header-icon-badge transfer" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 4l4 4-4 4" />
                <path d="M3 8h18" />
                <path d="M7 20l-4-4 4-4" />
                <path d="M21 16H3" />
              </svg>
            </div>
            <div className="modal-pro-header-titles">
              <h2 id="transfer-modal-title" className="txn-modal-title modal-pro-title">
                Chuyển tiền giữa các ví
              </h2>
              <p className="modal-pro-subtitle">
                Chuyển tiền nhanh chóng và an toàn giữa các ví của bạn
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
            {/* Transfer Visual Direction Banner */}
            <div className="transfer-route-banner-pro">
              <div className="transfer-route-col">
                <span className="transfer-route-label">TỪ VÍ</span>
                <div className="transfer-route-wallet">
                  <WalletOutlineIcon type={fromWallet?.type} size={18} color="currentColor" />
                  <span className="transfer-route-name">{fromWallet?.name || 'Chọn ví'}</span>
                </div>
                <span className="transfer-route-balance">
                  Số dư: {formatCurrency(fromWallet?.currentBalance ?? 0)}
                </span>
              </div>

              <div className="transfer-route-divider-pro" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>

              <div className="transfer-route-col">
                <span className="transfer-route-label">ĐẾN VÍ</span>
                <div className="transfer-route-wallet">
                  <WalletOutlineIcon type={toWallet?.type} size={18} color="currentColor" />
                  <span className="transfer-route-name">{toWallet?.name || 'Chọn ví'}</span>
                </div>
                <span className="transfer-route-balance">
                  Số dư: {formatCurrency(toWallet?.currentBalance ?? 0)}
                </span>
              </div>
            </div>

            {/* Select From Wallet & To Wallet */}
            <div className="modal-two-cols-row">
              <div className="txn-field-group">
                <label htmlFor="from-wallet-select" className="modal-section-label">
                  <span>Từ ví nguồn</span>
                </label>
                <div className="modal-select-wrapper">
                  <span className="modal-select-prefix-icon" aria-hidden="true">
                    <WalletOutlineIcon type={fromWallet?.type} size={18} color="currentColor" />
                  </span>
                  <select
                    id="from-wallet-select"
                    className="modal-pro-select with-prefix"
                    value={fromWalletId}
                    onChange={(e) => setFromWalletId(e.target.value)}
                    required
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatCurrency(w.currentBalance ?? 0)})
                      </option>
                    ))}
                  </select>
                  <span className="modal-select-chevron" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="txn-field-group">
                <label htmlFor="to-wallet-select" className="modal-section-label">
                  <span>Đến ví nhận</span>
                </label>
                <div className="modal-select-wrapper">
                  <span className="modal-select-prefix-icon" aria-hidden="true">
                    <WalletOutlineIcon type={toWallet?.type} size={18} color="currentColor" />
                  </span>
                  <select
                    id="to-wallet-select"
                    className="modal-pro-select with-prefix"
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    required
                  >
                    {wallets
                      .filter((w) => w.id !== fromWalletId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({formatCurrency(w.currentBalance ?? 0)})
                        </option>
                      ))}
                  </select>
                  <span className="modal-select-chevron" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>

            {/* Amount & Fee */}
            <div className="modal-two-cols-row">
              <div className="txn-field-group">
                <label htmlFor="transfer-amount" className="modal-section-label">
                  <span>Số tiền chuyển</span>
                </label>
                <div className="modal-pro-amount-box">
                  <div className="amount-prefix-badge banknote" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <circle cx="12" cy="12" r="2.5" />
                      <path d="M6 12h.01M18 12h.01" />
                    </svg>
                  </div>
                  <input
                    id="transfer-amount"
                    ref={amountInputRef}
                    type="text"
                    inputMode="numeric"
                    className="modal-pro-amount-input"
                    placeholder="0"
                    value={amount}
                    onChange={handleAmountChange}
                    required
                  />
                  <span className="modal-pro-amount-suffix">VNĐ</span>
                </div>
                <p className="modal-field-hint">Số tiền sẽ được trừ từ ví nguồn</p>
              </div>

              <div className="txn-field-group">
                <div className="modal-label-row">
                  <label htmlFor="transfer-fee" className="modal-section-label">
                    <span>Phí giao dịch</span>
                    <span className="modal-info-tooltip" title="Chi phí chuyển khoản hoặc phí dịch vụ phát sinh" aria-label="Thông tin thêm">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </span>
                  </label>
                  <span className="modal-label-optional">Tùy chọn</span>
                </div>
                <div className="modal-pro-amount-box">
                  <div className="amount-prefix-badge tag" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                  </div>
                  <input
                    id="transfer-fee"
                    type="text"
                    inputMode="numeric"
                    className="modal-pro-amount-input"
                    placeholder="0"
                    value={fee}
                    onChange={handleFeeChange}
                  />
                  <span className="modal-pro-amount-suffix">VNĐ</span>
                </div>
                <p className="modal-field-hint">Phí sẽ được cộng vào ví nhận</p>
              </div>
            </div>

            {/* Date */}
            <div className="txn-field-group">
              <label htmlFor="transfer-date" className="modal-section-label">
                <span>Ngày chuyển</span>
              </label>
              <div className="modal-input-icon-wrap">
                <span className="modal-input-prefix-icon calendar" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <input
                  id="transfer-date"
                  type="date"
                  className="modal-pro-input with-prefix"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Note with Character Count */}
            <div className="txn-field-group">
              <div className="modal-label-row">
                <label htmlFor="transfer-desc" className="modal-section-label">
                  <span>Ghi chú</span>
                </label>
                <span className="modal-label-optional">Tùy chọn</span>
              </div>
              <div className="modal-input-icon-wrap">
                <span className="modal-input-prefix-icon note" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </span>
                <input
                  id="transfer-desc"
                  type="text"
                  className="modal-pro-input with-prefix with-counter"
                  placeholder="VD: Chuyển tiền tiết kiệm, nạp tiền ví MoMo..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  maxLength={100}
                />
                <span className="modal-input-char-counter">
                  {desc.length}/100
                </span>
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
          <div className="txn-modal-footer modal-pro-footer">
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
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Xác nhận chuyển tiền</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
