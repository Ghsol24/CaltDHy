import React, { useState, useEffect, useRef } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency } from '../../utils/formatters';

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

export function JarTransactionModal({ isOpen, onClose, jar, initialAction = 'deposit' }) {
  const { updateJarBalance } = useJarStore();
  const { wallets } = useWalletStore();
  const { addTransaction } = useTransactionStore();
  const { addToast } = useToastStore();

  const [action, setAction] = useState(initialAction); // 'deposit' | 'withdraw'
  const [amount, setAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const modalRef = useRef(null);
  const amountInputRef = useRef(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setAction(initialAction || 'deposit');
    setAmount('');
    setReason('');
    setErrorMsg('');

    // Default wallet selection: pick default wallet if exists
    const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];
    setSelectedWalletId(defaultWallet ? defaultWallet.id : '');

    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, initialAction, wallets]);

  if (!isOpen || !jar) return null;

  const currentBal = Number(jar.current || 0);
  const targetBal = Number(jar.target || 0);
  const remaining = Math.max(0, targetBal - currentBal);

  const handleAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setAmount('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setAmount(num ? num.toLocaleString('vi-VN') : '');
  };

  const handleQuickAdd = (val) => {
    const currentNum = amount ? parseInt(String(amount).replace(/\D/g, ''), 10) : 0;
    const nextVal = currentNum + val;
    setAmount(nextVal.toLocaleString('vi-VN'));
  };

  const handleQuickFillRemaining = () => {
    if (remaining > 0) {
      setAmount(remaining.toLocaleString('vi-VN'));
    }
  };

  const handleQuickFillAllBalance = () => {
    if (currentBal > 0) {
      setAmount(currentBal.toLocaleString('vi-VN'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanAmount = amount ? parseInt(String(amount).replace(/\D/g, ''), 10) : 0;

    if (!cleanAmount || cleanAmount <= 0) {
      setErrorMsg('Vui lòng nhập số tiền hợp lệ lớn hơn 0.');
      amountInputRef.current?.focus();
      return;
    }

    if (action === 'withdraw' && cleanAmount > currentBal) {
      setErrorMsg(`Số tiền rút không được vượt quá số dư trong hũ (${formatCurrency(currentBal)}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update jar balance
      await updateJarBalance(jar.id, action, cleanAmount, reason.trim());

      // 2. Optionally sync with wallet
      if (selectedWalletId) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (action === 'deposit') {
          // Tiền từ ví -> nạp vào hũ => Ghi nhận khoản chi/tiết kiệm từ ví đó
          await addTransaction({
            type: 'expense',
            amount: cleanAmount,
            category: 'Tiết kiệm',
            desc: reason.trim() ? `${reason.trim()} (Nạp hũ ${jar.name})` : `Nạp vào hũ ${jar.name}`,
            date: todayStr,
            walletId: selectedWalletId,
            jarId: jar.id
          });
        } else {
          // Rút từ hũ -> đổ vào ví => Ghi nhận khoản thu nhập vào ví đó
          await addTransaction({
            type: 'income',
            amount: cleanAmount,
            category: 'Thu nhập khác',
            desc: reason.trim() ? `${reason.trim()} (Rút từ hũ ${jar.name})` : `Rút từ hũ ${jar.name}`,
            date: todayStr,
            walletId: selectedWalletId,
            jarId: jar.id
          });
        }
      }

      setIsSubmitting(false);
      onClose();
      addToast({
        type: 'success',
        message: action === 'deposit'
          ? `Đã nạp ${formatCurrency(cleanAmount)} vào hũ "${jar.name}".`
          : `Đã rút ${formatCurrency(cleanAmount)} từ hũ "${jar.name}".`,
        duration: 4000
      });
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Lỗi khi thực hiện giao dịch hũ.');
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
        aria-labelledby="jar-tx-modal-title"
      >
        {/* Header */}
        <div className="txn-modal-header">
          <div className="jar-tx-header-title-box">
            <h2 id="jar-tx-modal-title" className="txn-modal-title">
              {action === 'deposit' ? 'Nạp tiền vào hũ' : 'Rút tiền từ hũ'}
            </h2>
            <span className="jar-tx-subtitle">
              {jar.icon} {jar.name} · Hiện có {formatCurrency(currentBal)}
            </span>
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
          <div className="txn-modal-body">
            {/* Action Switcher: Nạp vs Rút */}
            <div className="txn-type-segment" role="tablist" aria-label="Loại giao dịch hũ">
              <button
                type="button"
                role="tab"
                aria-selected={action === 'deposit'}
                className={`txn-type-btn ${action === 'deposit' ? 'active-income' : ''}`}
                onClick={() => setAction('deposit')}
              >
                <span>+ Nạp vào hũ</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={action === 'withdraw'}
                className={`txn-type-btn ${action === 'withdraw' ? 'active-expense' : ''}`}
                onClick={() => setAction('withdraw')}
              >
                <span>− Rút từ hũ</span>
              </button>
            </div>

            {/* Jar Status Mini Card */}
            <div className="jar-tx-summary-card">
              <div className="jar-tx-summary-col">
                <span className="jar-tx-summary-label">Số dư hiện tại</span>
                <strong className="jar-tx-summary-val text-primary">{formatCurrency(currentBal)}</strong>
              </div>
              <div className="jar-tx-summary-divider" />
              <div className="jar-tx-summary-col">
                <span className="jar-tx-summary-label">Mục tiêu</span>
                <strong className="jar-tx-summary-val">{formatCurrency(targetBal)}</strong>
              </div>
              <div className="jar-tx-summary-divider" />
              <div className="jar-tx-summary-col">
                <span className="jar-tx-summary-label">Còn thiếu</span>
                <strong className="jar-tx-summary-val text-secondary">
                  {remaining > 0 ? formatCurrency(remaining) : '🎉 Đã đạt'}
                </strong>
              </div>
            </div>

            {/* Amount Input */}
            <div className="txn-field-group">
              <label htmlFor="jar-tx-amount" className="txn-label">
                <span>{action === 'deposit' ? 'Số tiền nạp' : 'Số tiền rút'}</span>
              </label>
              <div className="txn-amount-box">
                <input
                  id="jar-tx-amount"
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

            {/* Quick Amount Chips */}
            <div className="jar-tx-chips-wrap">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  className="jar-tx-chip-btn"
                  onClick={() => handleQuickAdd(val)}
                >
                  +{val >= 1000000 ? `${val / 1000000}tr` : `${val / 1000}k`}
                </button>
              ))}

              {action === 'deposit' && remaining > 0 && (
                <button
                  type="button"
                  className="jar-tx-chip-btn jar-tx-chip-btn--accent"
                  onClick={handleQuickFillRemaining}
                >
                  🎯 Nạp đủ mục tiêu
                </button>
              )}

              {action === 'withdraw' && currentBal > 0 && (
                <button
                  type="button"
                  className="jar-tx-chip-btn jar-tx-chip-btn--accent"
                  onClick={handleQuickFillAllBalance}
                >
                  💸 Rút toàn bộ số dư
                </button>
              )}
            </div>

            {/* Wallet Selection for Auto-Sync */}
            <div className="txn-field-group">
              <label htmlFor="jar-tx-wallet" className="txn-label">
                <span>
                  {action === 'deposit' ? 'Trừ tiền từ ví (tùy chọn)' : 'Cộng tiền vào ví (tùy chọn)'}
                </span>
              </label>
              <select
                id="jar-tx-wallet"
                className="txn-input"
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
              >
                <option value="">-- Không đồng bộ ví (chỉ ghi nhận hũ độc lập) --</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon || '💳'} {w.name} ({formatCurrency(w.currentBalance ?? w.initialBalance ?? 0)})
                  </option>
                ))}
              </select>
              <span className="txn-field-hint">
                {selectedWalletId
                  ? action === 'deposit'
                    ? '💡 Hệ thống sẽ tự động tạo 1 giao dịch Chi tiêu từ ví này để số dư ví luôn chính xác.'
                    : '💡 Hệ thống sẽ tự động tạo 1 giao dịch Thu nhập vào ví này để cập nhật số dư ví.'
                  : '💡 Tiền trong hũ sẽ được cập nhật độc lập, không làm thay đổi số dư ví nào.'}
              </span>
            </div>

            {/* Reason / Note */}
            <div className="txn-field-group">
              <label htmlFor="jar-tx-reason" className="txn-label">
                <span>Lý do / Ghi chú</span>
              </label>
              <input
                id="jar-tx-reason"
                type="text"
                className="txn-input"
                placeholder={
                  action === 'deposit'
                    ? 'VD: Trích lương tháng 8, Tiết kiệm hàng tuần...'
                    : 'VD: Rút tiền đặt cọc, Mua sắm mục tiêu...'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
              className={`txn-btn-submit ${action === 'withdraw' ? 'txn-btn-submit--withdraw' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Đang xử lý...</span>
                </>
              ) : action === 'deposit' ? (
                'Xác nhận nạp tiền'
              ) : (
                'Xác nhận rút tiền'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
