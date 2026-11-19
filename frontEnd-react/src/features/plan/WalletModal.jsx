import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useEffect, useRef, useId } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { FormDialog, DialogBody, DialogFooter } from '../../components/ui/FormDialog';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatInputNumber } from '../../utils/formatters';
import { WalletOutlineIcon } from './WalletsTab';

import { Icon } from '../../components/ui/AppIcons';
const PRESET_COLORS = [
  '#078A59', // Brand Mint Emerald
  '#2563EB', // Royal Blue
  '#7C3AED', // Vivid Purple
  '#C026D3', // Fuchsia (replaces orange: warning colours are not wallet colours)
  '#4D7C0F', // Moss green (replaces red)
  '#0891B2', // Cyan Teal
  '#4F46E5', // Indigo
  '#D97706', // Amber Gold
  '#059669', // Medium Sea Green
  '#475569'  // Slate Gray
];

const getWalletIconByType = (_walletType) => {
  return '';
};

export function WalletModal({ isOpen, onClose, walletToEdit = null, returnFocusRef }) {
  const optionId = useId();
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
  const [nameError, setNameError] = useState('');

  const modalRef = useRef(null);
  const nameInputRef = useRef(null);


  useEffect(() => {
    if (!isOpen) return;

    if (walletToEdit) {
      setName(walletToEdit.name || '');
      setType(walletToEdit.type || 'cash');
      setInitialBalance(
        walletToEdit.initialBalance !== undefined
          ? formatInputNumber(walletToEdit.initialBalance)
          : ''
      );
      setCreditLimit(
        walletToEdit.creditLimit !== undefined && walletToEdit.creditLimit > 0
          ? formatInputNumber(walletToEdit.creditLimit)
          : ''
      );
      setColor(walletToEdit.color || '#078A59');
      setIsDefault(Boolean(walletToEdit.isDefault));
      setIsExcludedFromTotal(Boolean(walletToEdit.isExcludedFromTotal));
      setErrorMsg('');
      setNameError('');
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
      setNameError('');
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
    setInitialBalance(num ? formatInputNumber(num) : '');
  };

  const handleLimitChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setCreditLimit('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setCreditLimit(num ? formatInputNumber(num) : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setNameError('Vui lòng nhập tên ví hoặc tài khoản.');
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
      setErrorMsg(getUserErrorMessage(err, 'error.save'));
    }
  };

  return (
    <FormDialog
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      busy={isSubmitting}
      panelRef={modalRef}
      titleId="wallet-modal-title"
      title={isEditing ? 'Chỉnh sửa ví / tài khoản' : 'Thêm ví / tài khoản mới'}
    >
        <form onSubmit={handleSubmit} noValidate>
          <DialogBody>
            <FormField label="Loại ví / tài khoản" labelId={`${optionId}-type-label`}>
              <div className="wallet-type-grid-pro" role="radiogroup" aria-labelledby={`${optionId}-type-label`}>
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
            </FormField>

            <FormField label="Tên ví / tài khoản" htmlFor="wallet-name" error={nameError}>
              {({ describedBy, invalid }) => (
                <div className="modal-input-icon-wrap">
                  <span className="modal-input-prefix-icon tag" aria-hidden="true">
                    <Icon name="tag" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </span>
                  <input
                    id="wallet-name"
                    ref={nameInputRef}
                    type="text"
                    className="modal-pro-input with-prefix with-clear"
                    placeholder="VD: Ví tiền mặt, MB Bank, MoMo, Techcom Visa..."
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    maxLength={40}
                    required
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
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
                      <Icon name="xCircleSoft" width="15" height="15" fill="currentColor" />
                    </button>
                  )}
                </div>
              )}
            </FormField>

            <FormField label="Số dư khởi tạo" htmlFor="wallet-balance" hint="Nhập số dư hiện có khi tạo ví">
              {({ describedBy }) => (
                <div className="modal-pro-amount-box input-shell">
                  <div className="amount-prefix-badge wallet" aria-hidden="true">
                    <Icon name="wallet" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </div>
                  <input
                    id="wallet-balance"
                    type="text"
                    inputMode="numeric"
                    className="modal-pro-amount-input"
                    placeholder="0"
                    value={initialBalance}
                    onChange={handleBalanceChange}
                    aria-describedby={describedBy}
                  />
                  <div className="amount-currency-pill" title="Đơn vị tiền tệ">
                    <span>₫</span>
                    <Icon name="chevronDown" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </div>
                </div>
              )}
            </FormField>

            {/* Hạn mức thẻ tín dụng (chỉ khi chọn loại thẻ tín dụng) */}
            {type === 'credit' && (
              <FormField label="Hạn mức thẻ tín dụng" htmlFor="wallet-limit">
                <div className="modal-pro-amount-box input-shell">
                  <div className="amount-prefix-badge credit-card" aria-hidden="true">
                    <Icon name="creditCardAlt" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                    <span>₫</span>
                  </div>
                </div>
              </FormField>
            )}

            <FormField label="Màu nhận diện" labelId={`${optionId}-color-label`}>
              <div className="wallet-color-presets-pro" role="group" aria-labelledby={`${optionId}-color-label`}>
                {PRESET_COLORS.map((hex) => {
                  const isSelected = color.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      className={`wallet-color-dot-pro ${isSelected ? 'active' : ''} wallet-color-dot-pro--tone`}
                      style={{ '--wallet-color-dot-pro-background-color': hex }}
                      onClick={() => setColor(hex)}
                      aria-label={`Màu ${hex}`}
                    />
                  );
                })}
              </div>
            </FormField>

            {/* Hai ô đánh dấu tự có tên và mô tả: không cần nhãn nhóm */}
            <div className="wallet-options-stack">
              {/* Option 1: Đặt làm ví mặc định */}
              <div
                className={`wallet-option-card-pro ${isDefault ? 'active' : ''}`}
                onClick={() => setIsDefault(!isDefault)}
                role="checkbox"
                aria-checked={isDefault}
                aria-labelledby={`${optionId}-default-title`}
                aria-describedby={`${optionId}-default-desc`}
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
                    tabIndex={-1}
                  />
                  <span className={`option-custom-checkbox ${isDefault ? 'checked' : ''}`}>
                    {isDefault && (
                      <Icon name="check" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </span>
                </div>

                <div className="option-icon-symbol sparkle" aria-hidden="true">
                  <Icon name="sparkle" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </div>

                <div className="option-content">
                  <strong className="option-title" id={`${optionId}-default-title`}>Đặt làm ví mặc định</strong>
                  <p className="option-desc" id={`${optionId}-default-desc`}>Tự động chọn ví này khi mở popup thêm giao dịch mới</p>
                </div>
              </div>

              {/* Option 2: Không tính vào tổng tài sản chi tiêu */}
              <div
                className={`wallet-option-card-pro ${isExcludedFromTotal ? 'active' : ''}`}
                onClick={() => setIsExcludedFromTotal(!isExcludedFromTotal)}
                role="checkbox"
                aria-checked={isExcludedFromTotal}
                aria-labelledby={`${optionId}-excluded-title`}
                aria-describedby={`${optionId}-excluded-desc`}
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
                    tabIndex={-1}
                  />
                  <span className={`option-custom-checkbox ${isExcludedFromTotal ? 'checked' : ''}`}>
                    {isExcludedFromTotal && (
                      <Icon name="check" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </span>
                </div>

                <div className="option-icon-symbol lock" aria-hidden="true">
                  <Icon name="lock" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </div>

                <div className="option-content">
                  <strong className="option-title" id={`${optionId}-excluded-title`}>Không tính vào tổng tài sản chi tiêu</strong>
                  <p className="option-desc" id={`${optionId}-excluded-desc`}>Phù hợp cho tài khoản tiết kiệm dài hạn hoặc tài khoản doanh nghiệp</p>
                </div>
              </div>
            </div>

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
              {isSubmitting ? 'Đang lưu...' : isEditing ? 'Cập nhật ví' : 'Tạo ví mới'}
            </Button>
          </DialogFooter>
        </form>
    </FormDialog>
  );
}
