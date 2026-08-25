import React, { useState, useEffect, useRef } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency } from '../../utils/formatters';

export function TransferModal({ isOpen, onClose, initialFromWalletId = null }) {
  const { wallets, transferMoney, fetchWallets } = useWalletStore();
  const { addToast } = useToastStore();

  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
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
    setDate(new Date().toISOString().split('T')[0]);
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
        <div className="txn-modal-header">
          <h2 id="transfer-modal-title" className="txn-modal-title">
            ⇄ Chuyển tiền giữa các ví
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
            {/* Transfer Visual Direction */}
            <div className="transfer-route-preview">
              <div className="transfer-route-item">
                <span className="transfer-route-role">Từ ví</span>
                <span className="transfer-route-name">
                  {fromWallet?.icon || '💳'} {fromWallet?.name || 'Chọn ví'}
                </span>
                <span className="transfer-route-balance">
                  Số dư: {formatCurrency(fromWallet?.currentBalance ?? 0)}
                </span>
              </div>
              <div className="transfer-route-arrow" aria-hidden="true">
                ➔
              </div>
              <div className="transfer-route-item">
                <span className="transfer-route-role">Đến ví</span>
                <span className="transfer-route-name">
                  {toWallet?.icon || '💳'} {toWallet?.name || 'Chọn ví'}
                </span>
                <span className="transfer-route-balance">
                  Số dư: {formatCurrency(toWallet?.currentBalance ?? 0)}
                </span>
              </div>
            </div>

            {/* Select From Wallet & To Wallet */}
            <div className="transfer-wallet-row">
              <div className="txn-field-group">
                <label htmlFor="from-wallet-select" className="txn-label">
                  <span>Từ ví nguồn</span>
                </label>
                <select
                  id="from-wallet-select"
                  className="txn-select"
                  value={fromWalletId}
                  onChange={(e) => setFromWalletId(e.target.value)}
                  required
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.icon || '💳'} {w.name} ({formatCurrency(w.currentBalance ?? 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="txn-field-group">
                <label htmlFor="to-wallet-select" className="txn-label">
                  <span>Đến ví nhận</span>
                </label>
                <select
                  id="to-wallet-select"
                  className="txn-select"
                  value={toWalletId}
                  onChange={(e) => setToWalletId(e.target.value)}
                  required
                >
                  {wallets
                    .filter((w) => w.id !== fromWalletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.icon || '💳'} {w.name} ({formatCurrency(w.currentBalance ?? 0)})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Amount & Fee */}
            <div className="transfer-amount-row">
              <div className="txn-field-group" style={{ flex: 1.5 }}>
                <label htmlFor="transfer-amount" className="txn-label">
                  <span>Số tiền chuyển</span>
                </label>
                <div className="txn-amount-box">
                  <input
                    id="transfer-amount"
                    ref={amountInputRef}
                    type="text"
                    inputMode="numeric"
                    className="txn-amount-input"
                    placeholder="0"
                    value={amount}
                    onChange={handleAmountChange}
                    required
                  />
                  <span className="txn-amount-suffix">VNĐ</span>
                </div>
              </div>

              <div className="txn-field-group" style={{ flex: 1 }}>
                <label htmlFor="transfer-fee" className="txn-label">
                  <span>Phí giao dịch</span>
                  <span className="txn-label-optional">Tùy chọn</span>
                </label>
                <div className="txn-amount-box" style={{ background: 'var(--surface2)' }}>
                  <input
                    id="transfer-fee"
                    type="text"
                    inputMode="numeric"
                    className="txn-amount-input"
                    placeholder="0"
                    value={fee}
                    onChange={handleFeeChange}
                  />
                  <span className="txn-amount-suffix">VNĐ</span>
                </div>
              </div>
            </div>

            {/* Date & Note */}
            <div className="txn-field-group">
              <label htmlFor="transfer-date" className="txn-label">
                <span>Ngày chuyển</span>
              </label>
              <input
                id="transfer-date"
                type="date"
                className="txn-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="txn-field-group">
              <label htmlFor="transfer-desc" className="txn-label">
                <span>Ghi chú</span>
                <span className="txn-label-optional">Tùy chọn</span>
              </label>
              <input
                id="transfer-desc"
                type="text"
                className="txn-input"
                placeholder="VD: Chuyển tiền tiết kiệm, nạp tiền ví MoMo..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={100}
              />
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
                  <span>Đang xử lý...</span>
                </>
              ) : (
                'Xác nhận chuyển tiền'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
