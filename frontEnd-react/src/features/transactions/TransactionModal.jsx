import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { DEFAULT_INCOME_CATEGORIES, getCategoryIcon } from '../../utils/categories';
import { formatCurrency, getLocalDateString, getLocalMonthString } from '../../utils/formatters';

const EMPTY_EXPENSE_CATS = [];

export function TransactionModal() {
  const { isAddTxnOpen, closeAddTxnModal, setActiveView, setPlanSubTab } = useSpendingStore();
  const {
    addTransaction,
    updateTransaction,
    undoAddTransaction,
    editingTransaction,
    closeEditTransaction,
    expenseCategories,
    incomeCategories,
    budgets,
    transactions
  } = useTransactionStore();
  const { wallets, fetchWallets } = useWalletStore();
  const { addToast } = useToastStore();

  const isOpen = Boolean(isAddTxnOpen || editingTransaction);
  const isEditing = Boolean(editingTransaction);

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(() => getLocalDateString());
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [amountError, setAmountError] = useState('');

  const modalRef = useRef(null);
  const amountInputRef = useRef(null);
  const prevOpenRef = useRef(false);
  const prevEditIdRef = useRef(null);

  useFocusTrap(modalRef, isOpen);

  // Fetch wallets if list is empty
  useEffect(() => {
    if (isOpen && wallets.length === 0) {
      fetchWallets();
    }
  }, [isOpen, wallets.length, fetchWallets]);

  // Categories list based on selected transaction type
  const activeExpenseCats = expenseCategories || EMPTY_EXPENSE_CATS;
  const activeIncomeCats = incomeCategories && incomeCategories.length > 0
    ? incomeCategories
    : DEFAULT_INCOME_CATEGORIES;

  const categories = type === 'expense' ? activeExpenseCats : activeIncomeCats;

  // Tính toán ngân sách thời gian thực cho từng danh mục chi tiêu trong tháng được chọn
  const categoryMetrics = useMemo(() => {
    if (type !== 'expense') return {};
    const curPrefix = date ? date.slice(0, 7) : getLocalMonthString();
    const spentMap = {};
    transactions.forEach((t) => {
      if (t.type === 'expense' && t.date && t.date.startsWith(curPrefix)) {
        spentMap[t.category] = (spentMap[t.category] || 0) + (Number(t.amount) || 0) + (Number(t.fee) || 0);
      }
    });

    const metrics = {};
    activeExpenseCats.forEach((cat) => {
      const rawLimit = budgets && budgets[cat.name] !== undefined ? Number(budgets[cat.name]) : null;
      const limit = rawLimit && rawLimit > 0 ? rawLimit : null;
      const spent = spentMap[cat.name] || 0;

      if (limit !== null) {
        const remaining = limit - spent;
        const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

        // Quy tắc dải màu theo tiêu chuẩn UX:
        // > 60% : Xanh lá an toàn
        // 15% - 60% : Vàng sang cam theo % giảm dần
        // < 15% hoặc hết hạn mức : Đỏ cảnh báo
        let color = '#10B981'; // Green
        if (remaining <= 0 || percent < 15) {
          color = '#EF4444'; // Red
        } else if (percent <= 60) {
          if (percent > 40) {
            color = '#F59E0B'; // Vàng tươi
          } else if (percent > 25) {
            color = '#F97316'; // Vàng cam
          } else {
            color = '#EA580C'; // Cam đậm
          }
        }

        let statusLabel = `Còn lại ${percent}%`;
        if (remaining <= 0) {
          statusLabel = 'Hết hạn mức';
        }

        metrics[cat.name] = {
          hasLimit: true,
          limit,
          spent,
          remaining: Math.max(0, remaining),
          rawRemaining: remaining,
          percent: Math.max(0, Math.min(100, percent)),
          color,
          statusLabel
        };
      } else {
        metrics[cat.name] = {
          hasLimit: false,
          limit: null,
          spent,
          remaining: 0,
          rawRemaining: 0,
          percent: 0,
          color: 'rgba(255, 255, 255, 0.15)',
          statusLabel: 'Chưa đặt hạn mức'
        };
      }
    });
    return metrics;
  }, [type, date, transactions, budgets, activeExpenseCats]);

  // Sắp xếp danh mục: Ưu tiên có hạn mức trước, sau đó là chưa đặt hạn mức (giữ nguyên trật tự cấu hình)
  const sortedCategories = useMemo(() => {
    if (type !== 'expense') return categories;
    return [...categories].sort((a, b) => {
      const mA = categoryMetrics[a.name];
      const mB = categoryMetrics[b.name];
      if (mA?.hasLimit && !mB?.hasLimit) return -1;
      if (!mA?.hasLimit && mB?.hasLimit) return 1;
      return 0;
    });
  }, [type, categories, categoryMetrics]);

  // Initialize or reset form values only when modal is opened or target editing transaction changes
  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      prevEditIdRef.current = null;
      return;
    }

    const isFirstOpen = !prevOpenRef.current && isOpen;
    const isEditTargetChanged = prevEditIdRef.current !== (editingTransaction?.id || null);

    if (isFirstOpen || isEditTargetChanged) {
      prevOpenRef.current = true;
      prevEditIdRef.current = editingTransaction?.id || null;

      if (editingTransaction) {
        setType(editingTransaction.type || 'expense');
        setAmount(
          editingTransaction.amount
            ? Number(editingTransaction.amount).toLocaleString('vi-VN')
            : ''
        );
        setCategory(editingTransaction.category || '');
        setWalletId(editingTransaction.walletId || '');
        setDate(
          editingTransaction.date
            ? typeof editingTransaction.date === 'string'
              ? editingTransaction.date.slice(0, 10)
              : getLocalDateString(editingTransaction.date)
            : getLocalDateString()
        );
        setDesc(editingTransaction.desc || '');
        setErrorMsg('');
        setAmountError('');
      } else {
        // New transaction default state
        setType('expense');
        setAmount('');
        const defaultCat = sortedCategories[0]?.name || categories[0]?.name || '';
        setCategory(defaultCat);
        setDate(getLocalDateString());
        setDesc('');
        setErrorMsg('');
        setAmountError('');

        // Preselect default wallet or first wallet
        const defWallet = wallets.find((w) => w.isDefault) || wallets[0];
        if (defWallet) {
          setWalletId(defWallet.id);
        }
      }
    }
  }, [isOpen, editingTransaction, categories, wallets, sortedCategories]);

  // Preselect category if empty when categories load
  useEffect(() => {
    if (isOpen && !isEditing && !category && sortedCategories.length > 0) {
      setCategory(sortedCategories[0]?.name || '');
    }
  }, [isOpen, isEditing, category, sortedCategories]);

  // Preselect wallet if walletId is empty when wallets load
  useEffect(() => {
    if (isOpen && !walletId && wallets.length > 0) {
      const defWallet = wallets.find((w) => w.isDefault) || wallets[0];
      if (defWallet) {
        setWalletId(defWallet.id);
      }
    }
  }, [isOpen, walletId, wallets]);

  // Auto focus amount input when opened
  useEffect(() => {
    if (isOpen && amountInputRef.current) {
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const close = useCallback(() => {
    closeAddTxnModal();
    closeEditTransaction();
    setErrorMsg('');
    setAmountError('');
  }, [closeAddTxnModal, closeEditTransaction]);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Switch type (expense <-> income) & preserve or reset category
  const handleTypeChange = (newType) => {
    if (type === newType) return;
    setType(newType);
    const newCategories = newType === 'expense' ? activeExpenseCats : activeIncomeCats;
    const exists = newCategories.some((c) => c.name.toLowerCase() === category.toLowerCase());
    if (!exists) {
      setCategory(newCategories[0]?.name || '');
    }
  };

  // Realtime thousand group formatting (e.g. 50000 -> 50.000)
  const handleAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setAmount('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setAmount(num ? num.toLocaleString('vi-VN') : '');
    if (num > 0) {
      setAmountError('');
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setAmountError('');

    const cleanAmountStr = String(amount).replace(/\D/g, '');
    const numAmount = parseInt(cleanAmountStr, 10);

    if (!numAmount || numAmount <= 0) {
      setAmountError('Số tiền phải lớn hơn 0');
      amountInputRef.current?.focus();
      return;
    }

    if (!category) {
      setErrorMsg('Vui lòng chọn danh mục.');
      return;
    }

    // Fallback wallet if none selected
    let targetWalletId = walletId;
    if (!targetWalletId && wallets.length > 0) {
      const defWallet = wallets.find((w) => w.isDefault) || wallets[0];
      targetWalletId = defWallet ? defWallet.id : null;
    }

    setIsSubmitting(true);
    try {
      const transactionData = {
        type,
        amount: numAmount,
        category,
        walletId: targetWalletId || null,
        date,
        desc: desc.trim()
      };

      if (isEditing) {
        const res = await updateTransaction(editingTransaction.id, transactionData);
        setIsSubmitting(false);
        if (res?.success) {
          close();
          addToast({
            type: 'success',
            message: `Đã cập nhật giao dịch ${category} (${formatCurrency(numAmount)}).`,
            duration: 4000
          });
        }
      } else {
        const res = await addTransaction(transactionData);
        setIsSubmitting(false);
        if (res?.success) {
          const createdTxn = res.data;
          close();
          addToast({
            type: 'success',
            message: `Đã ghi ${type === 'income' ? 'thu nhập' : 'chi tiêu'} ${formatCurrency(numAmount)} vào ${category}.`,
            action: createdTxn?.id
              ? {
                  label: 'Hoàn tác',
                  onClick: () => {
                    undoAddTransaction(createdTxn.id);
                  }
                }
              : null,
            duration: 5000
          });
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Lỗi xử lý giao dịch. Vui lòng thử lại.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="txn-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close();
        }
      }}
    >
      <div
        ref={modalRef}
        className="txn-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="txn-modal-title"
      >
        {/* Header */}
        <div className="txn-modal-header">
          <h2 id="txn-modal-title" className="txn-modal-title">
            {isEditing ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch mới'}
          </h2>
          <button
            type="button"
            className="txn-modal-close-btn"
            onClick={close}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="txn-modal-body">
            {/* 1. Type toggle */}
            <div className="txn-type-toggle" role="group" aria-label="Loại giao dịch">
              <button
                type="button"
                className={`txn-type-btn txn-type-btn--expense ${type === 'expense' ? 'active' : ''}`}
                onClick={() => handleTypeChange('expense')}
                aria-pressed={type === 'expense'}
              >
                <span>💸</span>
                <span>Chi tiêu</span>
              </button>
              <button
                type="button"
                className={`txn-type-btn txn-type-btn--income ${type === 'income' ? 'active' : ''}`}
                onClick={() => handleTypeChange('income')}
                aria-pressed={type === 'income'}
              >
                <span>💵</span>
                <span>Thu nhập</span>
              </button>
            </div>

            {/* 2. Amount field */}
            <div className="txn-field-group">
              <label htmlFor="txn-amount-input" className="txn-label">
                <span>Số tiền</span>
              </label>
              <div className={`txn-amount-box ${amountError ? 'has-error' : ''}`}>
                <input
                  id="txn-amount-input"
                  ref={amountInputRef}
                  type="text"
                  inputMode="numeric"
                  className="txn-amount-input"
                  placeholder="0"
                  value={amount}
                  onChange={handleAmountChange}
                  required
                  aria-required="true"
                />
                <span className="txn-amount-suffix" aria-hidden="true">
                  VNĐ
                </span>
              </div>
              {amountError && (
                <div className="txn-amount-error-inline" role="alert">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{amountError}</span>
                </div>
              )}
            </div>

            {/* 3. Smart Category Selection Grid */}
            <div className="txn-field-group">
              <label className="txn-label">
                <span>Danh mục</span>
              </label>

              {type === 'expense' && sortedCategories.length === 0 ? (
                <div className="txn-empty-categories" role="status">
                  <span className="txn-empty-icon" aria-hidden="true">📁</span>
                  <h4 className="txn-empty-title">Chưa có danh mục</h4>
                  <p className="txn-empty-desc">Hãy thiết lập danh mục trước khi thêm giao dịch.</p>
                  <button
                    type="button"
                    className="txn-empty-cta-btn"
                    onClick={() => {
                      close();
                      setActiveView('plan');
                      setPlanSubTab('budgets');
                    }}
                  >
                    Thiết lập danh mục
                  </button>
                </div>
              ) : (
                <div className="txn-category-grid" role="radiogroup" aria-label="Chọn danh mục">
                  {sortedCategories.map((cat) => {
                    const isSelected = category.toLowerCase() === cat.name.toLowerCase();
                    const metric = categoryMetrics[cat.name];
                    return (
                      <button
                        type="button"
                        key={cat.name}
                        role="radio"
                        aria-checked={isSelected}
                        className={`txn-category-card ${isSelected ? 'active' : ''} ${metric && !metric.hasLimit ? 'is-unset' : ''}`}
                        onClick={() => setCategory(cat.name)}
                      >
                        {isSelected && (
                          <span className="txn-card-check-badge" aria-hidden="true">
                            ✓
                          </span>
                        )}
                        <span className="txn-card-icon" aria-hidden="true">
                          {cat.icon || getCategoryIcon(cat.name, type)}
                        </span>
                        <span className="txn-card-name" title={cat.name}>
                          {cat.name}
                        </span>

                        {type === 'expense' && metric ? (
                          <>
                            <div className="txn-card-amount">
                              {metric.hasLimit
                                ? `${formatCurrency(metric.remaining)}`
                                : `${formatCurrency(0)}`}
                            </div>
                            <div
                              className="txn-card-subtitle"
                              style={{
                                color:
                                  metric.hasLimit && (metric.percent < 15 || metric.rawRemaining <= 0)
                                    ? '#EF4444'
                                    : undefined
                              }}
                            >
                              {metric.statusLabel}
                            </div>
                            <div className="txn-card-progress-track" aria-hidden="true">
                              <div
                                className="txn-card-progress-fill"
                                style={{
                                  width: metric.hasLimit ? `${metric.percent}%` : '0%',
                                  backgroundColor: metric.color
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="txn-card-income-tag">
                            Thu nhập
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Wallet Selection (Chi từ / Nhận vào) */}
            <div className="txn-field-group">
              <label htmlFor="txn-wallet-select" className="txn-label">
                <span>{type === 'expense' ? 'Chi từ ví / tài khoản' : 'Nhận vào ví / tài khoản'}</span>
              </label>
              <select
                id="txn-wallet-select"
                className="txn-select"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
              >
                {wallets.length === 0 ? (
                  <option value="">💵 Tiền mặt</option>
                ) : (
                  wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.icon || '💵'} {w.name} {w.isDefault ? '(Mặc định)' : ''} — Số dư:{' '}
                      {formatCurrency(w.currentBalance ?? w.initialBalance ?? 0)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* 5. Date Field */}
            <div className="txn-field-group">
              <label htmlFor="txn-date-input" className="txn-label">
                <span>Ngày giao dịch</span>
              </label>
              <input
                id="txn-date-input"
                type="date"
                className="txn-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* 6. Description Note */}
            <div className="txn-field-group">
              <label htmlFor="txn-desc-input" className="txn-label">
                <span>Ghi chú</span>
                <span className="txn-label-optional">Tùy chọn</span>
              </label>
              <input
                id="txn-desc-input"
                type="text"
                className="txn-input"
                placeholder="VD: Cà phê sáng, ăn trưa cùng đồng nghiệp..."
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

          {/* 7. Footer CTA Actions */}
          <div className="txn-modal-footer">
            <button
              type="button"
              className="txn-btn-cancel"
              onClick={close}
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
                'Cập nhật giao dịch'
              ) : (
                'Lưu giao dịch'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
