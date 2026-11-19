import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { FormDialog, DialogBody, DialogFooter } from '../../components/ui/FormDialog';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
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
  // Lỗi nhập gắn vào từng ô (from / to / amount); errorMsg chỉ còn cho lỗi lưu.
  const [fieldErrors, setFieldErrors] = useState({});

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
    setFieldErrors({});

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
    setFieldErrors({});

    if (!fromWalletId) {
      setFieldErrors({ from: 'Vui lòng chọn ví nguồn (tài khoản chuyển).' });
      return;
    }

    if (!toWalletId) {
      setFieldErrors({ to: 'Vui lòng chọn ví đích (tài khoản nhận).' });
      return;
    }

    if (fromWalletId === toWalletId) {
      setFieldErrors({ to: 'Ví nguồn và ví đích không được trùng nhau.' });
      return;
    }

    const cleanAmount = parseInt(String(amount).replace(/\D/g, ''), 10);
    if (!cleanAmount || cleanAmount <= 0) {
      setFieldErrors({ amount: 'Vui lòng nhập số tiền chuyển hợp lệ (> 0).' });
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
    <FormDialog
      onClose={onClose}
      busy={isSubmitting}
      panelRef={modalRef}
      titleId="transfer-modal-title"
      title="Chuyển tiền giữa các ví"
    >
        <form onSubmit={handleSubmit} noValidate>
          <DialogBody>
            {/* Transfer Visual Direction Banner */}
            <div className="transfer-route-banner-pro">
              <div className="transfer-route-col">
                <span className="transfer-route-label">Từ ví</span>
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
                <span className="transfer-route-label">Đến ví</span>
                <div className="transfer-route-wallet">
                  <WalletOutlineIcon type={toWallet?.type} size={18} color="currentColor" />
                  <span className="transfer-route-name">{toWallet?.name || 'Chọn ví'}</span>
                </div>
                <span className="transfer-route-balance">
                  Số dư: {formatCurrency(toWallet?.currentBalance ?? 0)}
                </span>
              </div>
            </div>

            <div className="modal-two-cols-row">
              <FormField label="Từ ví nguồn" htmlFor="from-wallet-select" error={fieldErrors.from}>
                {({ describedBy, invalid }) => (
                  <CustomWalletDropdown
                    id="from-wallet-select"
                    wallets={sortedWallets}
                    value={fromWalletId}
                    onChange={(val) => {
                      setFromWalletId(val);
                      setFieldErrors((prev) => ({ ...prev, from: undefined, to: undefined }));
                      if (toWalletId === val) {
                        const nextTo = wallets.find((w) => w.id !== val);
                        if (nextTo) setToWalletId(nextTo.id);
                      }
                    }}
                    placeholder="Chọn ví nguồn..."
                    invalid={invalid}
                    describedBy={describedBy}
                  />
                )}
              </FormField>

              <FormField label="Đến ví nhận" htmlFor="to-wallet-select" error={fieldErrors.to}>
                {({ describedBy, invalid }) => (
                  <CustomWalletDropdown
                    id="to-wallet-select"
                    wallets={sortedWallets.filter((w) => w.id !== fromWalletId)}
                    value={toWalletId}
                    onChange={(val) => {
                      setToWalletId(val);
                      setFieldErrors((prev) => ({ ...prev, to: undefined }));
                    }}
                    placeholder="Chọn ví nhận..."
                    invalid={invalid}
                    describedBy={describedBy}
                  />
                )}
              </FormField>
            </div>

            <div className="modal-two-cols-row">
              <FormField label="Số tiền chuyển" htmlFor="transfer-amount" hint="Số tiền sẽ được trừ từ ví nguồn" error={fieldErrors.amount}>
                {({ describedBy, invalid }) => (
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
                      onChange={(e) => {
                        handleAmountChange(e);
                        if (fieldErrors.amount) setFieldErrors((prev) => ({ ...prev, amount: undefined }));
                      }}
                      required
                      aria-invalid={invalid || undefined}
                      aria-describedby={describedBy}
                    />
                    <span className="modal-pro-amount-suffix">₫</span>
                  </div>
                )}
              </FormField>

              <FormField
                label={(
                  <>
                    Phí giao dịch
                    <span className="modal-info-tooltip" title="Chi phí chuyển khoản hoặc phí dịch vụ phát sinh" aria-label="Thông tin thêm">
                      <Icon name="info" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </span>
                  </>
                )}
                htmlFor="transfer-fee"
                optional
                hint="Phí giao dịch sẽ được trừ thêm vào ví gửi"
              >
                {({ describedBy }) => (
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
                      aria-describedby={describedBy}
                    />
                    <span className="modal-pro-amount-suffix">₫</span>
                  </div>
                )}
              </FormField>
            </div>

            <FormField label="Ngày chuyển" htmlFor="transfer-date">
              <CustomDatePicker
                id="transfer-date"
                inputClassName="modal-pro-input"
                value={date}
                onChange={setDate}
                max={getLocalDateString()}
                required
              />
            </FormField>

            <FormField label="Ghi chú" htmlFor="transfer-desc" optional>
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
            </FormField>

            {/* Lỗi lưu từ máy chủ; lỗi nhập nằm dưới từng ô */}
            {errorMsg && (
              <div className="txn-error-banner" role="alert">
                <Icon name="alertCircle" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <span>{errorMsg}</span>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" size="lg" className="txn-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="lg" className="txn-btn-submit" loading={isSubmitting}>
              {isSubmitting ? 'Đang xử lý...' : 'Chuyển tiền'}
            </Button>
          </DialogFooter>
        </form>
    </FormDialog>
  );
}
