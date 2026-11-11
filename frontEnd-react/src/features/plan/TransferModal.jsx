import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { Dialog } from '../../components/ui/Dialog';
import { formatCurrency, formatInputNumber, getLocalDateString } from '../../utils/formatters';
import { WalletOutlineIcon } from './WalletsTab';
import { CustomWalletDropdown } from '../../components/ui/CustomWalletDropdown';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { sortWalletsByBalance } from '../../utils/walletSort';

import { Icon } from '../../components/ui/AppIcons';
export function TransferModal({ isOpen, onClose, initialFromWalletId = null }) {
  const { wallets, transferMoney, fetchWallets } = useWalletStore();
  const { addToast } = useToastStore();
  const sortedWallets = useMemo(() => sortWalletsByBalance(wallets), [wallets]);

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
    setAmount(num ? formatInputNumber(num) : '');
  };

  const handleFeeChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setFee('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setFee(num ? formatInputNumber(num) : '');
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
      setErrorMsg(getUserErrorMessage(err, 'error.save'));
    }
  };

  const fromWallet = wallets.find((w) => w.id === fromWalletId);
  const toWallet = wallets.find((w) => w.id === toWalletId);

  return (
    <Dialog
      isOpen
      onClose={onClose}
      busy={isSubmitting}
      portal={false}
      panelRef={modalRef}
      overlayClassName="txn-modal-backdrop"
      className="txn-modal-card"
      labelledBy="transfer-modal-title"
    >
        {/* Header */}
        <div className="txn-modal-header modal-pro-header">
          <div className="modal-pro-header-left">
            <div className="modal-header-icon-badge transfer" aria-hidden="true">
              <Icon name="swapHorizontal" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </div>
            <div className="modal-pro-header-titles">
              <h2 id="transfer-modal-title" className="txn-modal-title modal-pro-title">
                Chuyển tiền giữa các ví
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="txn-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <Icon name="close" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
                <Icon name="arrowRightLine" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
                <CustomWalletDropdown
                  id="from-wallet-select"
                  wallets={sortedWallets}
                  value={fromWalletId}
                  onChange={(val) => {
                    setFromWalletId(val);
                    if (toWalletId === val) {
                      const nextTo = wallets.find((w) => w.id !== val);
                      if (nextTo) setToWalletId(nextTo.id);
                    }
                  }}
                  placeholder="Chọn ví nguồn..."
                />
              </div>

              <div className="txn-field-group">
                <label htmlFor="to-wallet-select" className="modal-section-label">
                  <span>Đến ví nhận</span>
                </label>
                <CustomWalletDropdown
                  id="to-wallet-select"
                  wallets={sortedWallets.filter((w) => w.id !== fromWalletId)}
                  value={toWalletId}
                  onChange={setToWalletId}
                  placeholder="Chọn ví nhận..."
                />
              </div>
            </div>

            {/* Amount & Fee */}
            <div className="modal-two-cols-row">
              <div className="txn-field-group">
                <label htmlFor="transfer-amount" className="modal-section-label">
                  <span>Số tiền chuyển</span>
                </label>
                <div className="modal-pro-amount-box input-shell">
                  <div className="amount-prefix-badge banknote" aria-hidden="true">
                    <Icon name="banknote" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                      <Icon name="info" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </span>
                  </label>
                  <span className="modal-label-optional">Tùy chọn</span>
                </div>
                <div className="modal-pro-amount-box input-shell">
                  <div className="amount-prefix-badge tag" aria-hidden="true">
                    <Icon name="tag" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                <p className="modal-field-hint">Phí giao dịch sẽ được trừ thêm vào ví gửi</p>
              </div>
            </div>

            {/* Date */}
            <div className="txn-field-group">
              <label htmlFor="transfer-date" className="modal-section-label">
                <span>Ngày chuyển</span>
              </label>
              <CustomDatePicker
                id="transfer-date"
                inputClassName="modal-pro-input"
                value={date}
                onChange={setDate}
                max={getLocalDateString()}
                required
              />
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
                  <Icon name="pencilAlt" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                <Icon name="alertCircle" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
                  <span className="spinner spinner--box" aria-hidden="true" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Icon name="check" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <span>Xác nhận chuyển tiền</span>
                </>
              )}
            </button>
          </div>
        </form>
    </Dialog>
  );
}
