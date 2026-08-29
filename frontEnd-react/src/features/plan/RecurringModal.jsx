import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency, getLocalDateString } from '../../utils/formatters';
import { DEFAULT_EXPENSE_CATEGORIES, getCategoryIcon } from '../../utils/categories';
import { detectBrandInfo } from '../../utils/brandDetection';
import { CategoryOutlineIcon } from '../../utils/categoryIcons';

const CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Hàng tháng' },
  { value: 'quarterly', label: 'Hàng quý (3 tháng)' },
  { value: 'yearly', label: 'Hàng năm' }
];

const STANDARD_CATEGORY_NAMES_VN = {
  Entertainment: 'Giải trí',
  'Food & Dining': 'Ăn uống',
  'Housing & Bills': 'Nhà & Hóa đơn',
  Shopping: 'Mua sắm',
  Transportation: 'Đi lại',
  'Health & Beauty': 'Sức khỏe & Làm đẹp',
  Education: 'Học tập & Giáo dục',
  Travel: 'Du lịch',
  'Other Expense': 'Chi phí khác'
};

export function RecurringModal({ isOpen, onClose, installmentToEdit = null }) {
  const { createInstallment, updateInstallment } = useJarStore();
  const { wallets } = useWalletStore();
  const { expenseCategories, budgets, transactions, setExpenseCategories } = useTransactionStore();
  const { addToast } = useToastStore();

  // 1. Đồng bộ hoàn chỉnh danh mục từ thiết lập của người dùng
  const syncedExpenseCategories = useMemo(() => {
    const map = new Map();

    // Lấy từ expenseCategories được user cấu hình trong store & localStorage
    if (Array.isArray(expenseCategories) && expenseCategories.length > 0) {
      expenseCategories.forEach((c) => {
        if (c && c.name && !map.has(c.name.toLowerCase())) {
          map.set(c.name.toLowerCase(), { name: c.name, icon: c.icon || getCategoryIcon(c.name, 'expense') });
        }
      });
    }

    // Lấy thêm từ budgets nếu user có tạo hạn mức ngân sách tùy chỉnh
    if (budgets && typeof budgets === 'object') {
      Object.keys(budgets).forEach((bName) => {
        if (bName && !map.has(bName.toLowerCase())) {
          map.set(bName.toLowerCase(), { name: bName, icon: getCategoryIcon(bName, 'expense') });
        }
      });
    }

    // Lấy thêm từ transactions nếu có danh mục tùy biến từ giao dịch chi tiêu
    if (Array.isArray(transactions)) {
      transactions.forEach((t) => {
        if (t.type === 'expense' && t.category && !map.has(t.category.toLowerCase())) {
          map.set(t.category.toLowerCase(), { name: t.category, icon: getCategoryIcon(t.category, 'expense') });
        }
      });
    }

    // Fallback danh mục mặc định nếu rỗng
    if (map.size === 0) {
      DEFAULT_EXPENSE_CATEGORIES.forEach((d) => {
        map.set(d.name.toLowerCase(), { name: d.name, icon: d.icon });
      });
    }

    return Array.from(map.values());
  }, [expenseCategories, budgets, transactions]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [nextDueDate, setNextDueDate] = useState(() => getLocalDateString());
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Dropdowns open state
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);

  // Quick Inline Category Creation
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCatInputName, setNewCatInputName] = useState('');

  const modalRef = useRef(null);
  const nameInputRef = useRef(null);
  const catRef = useRef(null);
  const walRef = useRef(null);
  const cycRef = useRef(null);
  const newCatInputRef = useRef(null);

  useFocusTrap(modalRef, isOpen);

  // Close custom dropdowns on click outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (catRef.current && !catRef.current.contains(e.target)) {
        setIsCategoryDropdownOpen(false);
        setIsAddingNewCategory(false);
      }
      if (walRef.current && !walRef.current.contains(e.target)) {
        setIsWalletDropdownOpen(false);
      }
      if (cycRef.current && !cycRef.current.contains(e.target)) {
        setIsCycleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const defaultCatName = syncedExpenseCategories.some((c) => c.name === 'Housing & Bills')
      ? 'Housing & Bills'
      : (syncedExpenseCategories[0]?.name || 'Housing & Bills');

    if (installmentToEdit) {
      setName(installmentToEdit.name || '');
      setCategory(installmentToEdit.category || defaultCatName);
      setWalletId(installmentToEdit.walletId || wallets[0]?.id || '');
      setAmount(installmentToEdit.amount ? Number(installmentToEdit.amount).toLocaleString('vi-VN') : '');
      setCycle(installmentToEdit.cycle || 'monthly');
      setNextDueDate(installmentToEdit.nextDueDate ? String(installmentToEdit.nextDueDate).slice(0, 10) : getLocalDateString());
      setNote(installmentToEdit.note || installmentToEdit.desc || '');
    } else {
      setName('');
      setCategory(defaultCatName);
      setWalletId(wallets[0]?.id || '');
      setAmount('');
      setCycle('monthly');
      setNextDueDate(getLocalDateString());
      setNote('');
    }

    setIsCategoryDropdownOpen(false);
    setIsWalletDropdownOpen(false);
    setIsCycleDropdownOpen(false);
    setIsAddingNewCategory(false);
    setNewCatInputName('');
    setErrorMsg('');

    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, installmentToEdit, wallets, syncedExpenseCategories]);

  // Khi người dùng gõ tên khoản chi, tự động gợi ý danh mục và ghi chú thông minh
  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);

    if (!installmentToEdit) {
      const brand = detectBrandInfo(val);
      if (brand.brandKey !== 'default') {
        // Tìm xem danh mục gợi ý có khớp với danh mục của user không
        const matchedUserCat = syncedExpenseCategories.find(
          (c) => c.name.toLowerCase() === brand.categoryDefault.toLowerCase()
        );
        if (matchedUserCat) {
          setCategory(matchedUserCat.name);
        } else {
          setCategory(brand.categoryDefault);
        }
        if (!note && brand.noteDefault) {
          setNote(brand.noteDefault);
        }
      }
    }
  };

  // Tạo nhanh danh mục mới trực tiếp trong dropdown
  const handleCreateNewCategory = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const trimmed = newCatInputName.trim();
    if (!trimmed) return;

    const existing = syncedExpenseCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      setCategory(existing.name);
    } else {
      const newCategoryObj = {
        name: trimmed,
        icon: getCategoryIcon(trimmed, 'expense')
      };
      const updatedList = [...syncedExpenseCategories, newCategoryObj];
      setExpenseCategories(updatedList);
      setCategory(trimmed);
      addToast({
        type: 'success',
        message: `Đã thêm danh mục mới "${trimmed}" vào hệ thống.`,
        duration: 3000
      });
    }

    setIsAddingNewCategory(false);
    setNewCatInputName('');
    setIsCategoryDropdownOpen(false);
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên khoản định kỳ hoặc trả góp.');
      nameInputRef.current?.focus();
      return;
    }

    const cleanAmount = parseInt(String(amount).replace(/\D/g, ''), 10);
    if (!cleanAmount || cleanAmount <= 0) {
      setErrorMsg('Vui lòng nhập số tiền hợp lệ (> 0).');
      return;
    }

    if (!nextDueDate) {
      setErrorMsg('Vui lòng chọn ngày đến hạn thanh toán.');
      return;
    }

    const brand = detectBrandInfo(name.trim());
    const finalCategory = category || brand.categoryDefault || syncedExpenseCategories[0]?.name || 'Housing & Bills';

    const payload = {
      name: name.trim(),
      category: finalCategory,
      walletId: walletId || wallets[0]?.id || null,
      amount: cleanAmount,
      cycle,
      nextDueDate,
      note: note.trim(),
      brandKey: brand.brandKey
    };

    setIsSubmitting(true);
    try {
      if (installmentToEdit) {
        await updateInstallment(installmentToEdit.id, payload);
        addToast({
          type: 'success',
          message: `Đã cập nhật khoản định kỳ "${name.trim()}".`,
          duration: 4000
        });
      } else {
        await createInstallment(payload);
        addToast({
          type: 'success',
          message: `Đã tạo khoản định kỳ "${name.trim()}" (${formatCurrency(cleanAmount)}/${cycle === 'yearly' ? 'năm' : cycle === 'quarterly' ? 'quý' : 'tháng'}).`,
          duration: 4000
        });
      }

      setIsSubmitting(false);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Không thể lưu khoản định kỳ.');
    }
  };

  const selectedWallet = wallets.find((w) => w.id === walletId) || wallets[0];
  const selectedCycleLabel = CYCLE_OPTIONS.find((c) => c.value === cycle)?.label || 'Hàng tháng';
  const categoryDisplayName = STANDARD_CATEGORY_NAMES_VN[category] || category || 'Chọn danh mục';

  return (
    <div
      className="txn-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="txn-modal-card recurring-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-modal-title"
      >
        {/* Header (Pure Outline SVG, No Emojis) */}
        <div className="txn-modal-header">
          <div className="recurring-modal-header-lead">
            <div className="modal-header-icon-box" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {installmentToEdit ? (
                  <>
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </>
                ) : (
                  <>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </>
                )}
              </svg>
            </div>
            <h2 id="recurring-modal-title" className="txn-modal-title">
              {installmentToEdit ? 'Chỉnh sửa khoản định kỳ' : 'Thêm khoản định kỳ'}
            </h2>
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
            {/* 1. Name */}
            <div className="txn-field-group">
              <label htmlFor="rec-name" className="txn-label">
                <span>Tên khoản chi / dịch vụ</span>
              </label>
              <input
                id="rec-name"
                ref={nameInputRef}
                type="text"
                className="txn-input modal-themed-input"
                placeholder="VD: Netflix Premium, Spotify, Internet FPT, Tiền nhà..."
                value={name}
                onChange={handleNameChange}
                maxLength={60}
                required
              />
            </div>

            {/* 2. Category & Wallet with Synchronized User Categories */}
            <div className="transfer-wallet-row">
              {/* Category Custom Dropdown synced with User's Categories */}
              <div className="txn-field-group" ref={catRef}>
                <label className="txn-label">
                  <span>Danh mục chi tiêu</span>
                </label>
                <div className="modal-custom-dropdown-wrap">
                  <button
                    type="button"
                    className={`modal-custom-dropdown-btn ${isCategoryDropdownOpen ? 'is-open' : ''}`}
                    onClick={() => {
                      setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                      setIsWalletDropdownOpen(false);
                      setIsCycleDropdownOpen(false);
                      setIsAddingNewCategory(false);
                    }}
                    aria-expanded={isCategoryDropdownOpen}
                  >
                    <div className="dropdown-btn-content">
                      <CategoryOutlineIcon name={category} size={16} className="dropdown-outline-icon text-brand" />
                      <span className="dropdown-btn-text">{categoryDisplayName}</span>
                    </div>
                    <svg className="dropdown-chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isCategoryDropdownOpen && (
                    <div className="modal-custom-dropdown-menu" role="listbox">
                      <div className="modal-dropdown-scroll-list">
                        {syncedExpenseCategories.map((c) => {
                          const isSelected = c.name.toLowerCase() === category.toLowerCase();
                          const labelDisplay = STANDARD_CATEGORY_NAMES_VN[c.name] || c.name;
                          return (
                            <button
                              key={c.name}
                              type="button"
                              className={`modal-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => {
                                setCategory(c.name);
                                setIsCategoryDropdownOpen(false);
                              }}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <div className="dropdown-item-left">
                                <CategoryOutlineIcon name={c.name} size={16} className="dropdown-outline-icon" />
                                <span className="dropdown-item-label">{labelDisplay}</span>
                              </div>
                              {isSelected && (
                                <svg className="dropdown-item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Nút hoặc Form tạo nhanh danh mục mới */}
                      <div className="modal-dropdown-footer-action">
                        {!isAddingNewCategory ? (
                          <button
                            type="button"
                            className="dropdown-add-cat-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsAddingNewCategory(true);
                              setTimeout(() => newCatInputRef.current?.focus(), 50);
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>Thêm danh mục mới</span>
                          </button>
                        ) : (
                          <div className="dropdown-add-cat-form" onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={newCatInputRef}
                              type="text"
                              className="dropdown-add-cat-input"
                              placeholder="Tên danh mục mới..."
                              value={newCatInputName}
                              onChange={(e) => setNewCatInputName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateNewCategory();
                                } else if (e.key === 'Escape') {
                                  setIsAddingNewCategory(false);
                                }
                              }}
                              maxLength={40}
                            />
                            <div className="dropdown-add-cat-btns">
                              <button
                                type="button"
                                className="dropdown-cat-confirm-btn"
                                onClick={handleCreateNewCategory}
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                className="dropdown-cat-cancel-btn"
                                onClick={() => setIsAddingNewCategory(false)}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Wallet Custom Dropdown */}
              <div className="txn-field-group" ref={walRef}>
                <label className="txn-label">
                  <span>Ví trừ tiền</span>
                </label>
                <div className="modal-custom-dropdown-wrap">
                  <button
                    type="button"
                    className={`modal-custom-dropdown-btn ${isWalletDropdownOpen ? 'is-open' : ''}`}
                    onClick={() => {
                      setIsWalletDropdownOpen(!isWalletDropdownOpen);
                      setIsCategoryDropdownOpen(false);
                      setIsCycleDropdownOpen(false);
                    }}
                    aria-expanded={isWalletDropdownOpen}
                  >
                    <div className="dropdown-btn-content">
                      <svg className="dropdown-outline-icon text-brand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect width="20" height="14" x="2" y="5" rx="2" />
                        <line x1="2" x2="22" y1="10" y2="10" />
                      </svg>
                      <span className="dropdown-btn-text">{selectedWallet?.name || 'Chọn ví'}</span>
                    </div>
                    <svg className="dropdown-chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isWalletDropdownOpen && (
                    <div className="modal-custom-dropdown-menu" role="listbox">
                      {wallets.map((w) => {
                        const isSelected = w.id === (selectedWallet?.id || '');
                        return (
                          <button
                            key={w.id}
                            type="button"
                            className={`modal-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => {
                              setWalletId(w.id);
                              setIsWalletDropdownOpen(false);
                            }}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="dropdown-item-left">
                              <svg className="dropdown-outline-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect width="20" height="14" x="2" y="5" rx="2" />
                                <line x1="2" x2="22" y1="10" y2="10" />
                              </svg>
                              <div className="wallet-dropdown-text-group">
                                <span className="dropdown-item-label">{w.name}</span>
                                <span className="dropdown-item-sub">{formatCurrency(w.currentBalance ?? 0)}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <svg className="dropdown-item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Amount */}
            <div className="txn-field-group">
              <label htmlFor="rec-amount" className="txn-label">
                <span>Số tiền mỗi kỳ thanh toán</span>
              </label>
              <div className="txn-amount-box modal-themed-amount-box">
                <input
                  id="rec-amount"
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

            {/* 4. Cycle & Next Due Date */}
            <div className="transfer-wallet-row">
              {/* Cycle Custom Dropdown */}
              <div className="txn-field-group" ref={cycRef}>
                <label className="txn-label">
                  <span>Chu kỳ lặp</span>
                </label>
                <div className="modal-custom-dropdown-wrap">
                  <button
                    type="button"
                    className={`modal-custom-dropdown-btn ${isCycleDropdownOpen ? 'is-open' : ''}`}
                    onClick={() => {
                      setIsCycleDropdownOpen(!isCycleDropdownOpen);
                      setIsCategoryDropdownOpen(false);
                      setIsWalletDropdownOpen(false);
                    }}
                    aria-expanded={isCycleDropdownOpen}
                  >
                    <div className="dropdown-btn-content">
                      <svg className="dropdown-outline-icon text-brand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                      <span className="dropdown-btn-text">{selectedCycleLabel}</span>
                    </div>
                    <svg className="dropdown-chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isCycleDropdownOpen && (
                    <div className="modal-custom-dropdown-menu" role="listbox">
                      {CYCLE_OPTIONS.map((opt) => {
                        const isSelected = opt.value === cycle;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`modal-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => {
                              setCycle(opt.value);
                              setIsCycleDropdownOpen(false);
                            }}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="dropdown-item-left">
                              <span className="dropdown-item-label">{opt.label}</span>
                            </div>
                            {isSelected && (
                              <svg className="dropdown-item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Next Due Date with Calendar Outline Icon */}
              <div className="txn-field-group">
                <label htmlFor="rec-date" className="txn-label">
                  <span>Ngày đến hạn tiếp theo</span>
                </label>
                <div className="modal-date-input-wrap">
                  <svg className="date-input-prefix-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <input
                    id="rec-date"
                    type="date"
                    className="txn-input modal-themed-date-input"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* 5. Note / Description */}
            <div className="txn-field-group">
              <label htmlFor="rec-note" className="txn-label">
                <span>Ghi chú gói cước / Hợp đồng (Tùy chọn)</span>
              </label>
              <input
                id="rec-note"
                type="text"
                className="txn-input modal-themed-input"
                placeholder="VD: Gói Premium 4K, Gói Super 100 Mbps, Trả góp kỳ 3/12..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
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
              className="txn-btn-cancel modal-btn-cancel-themed"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="txn-btn-submit modal-btn-submit-themed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Đang lưu...</span>
                </>
              ) : installmentToEdit ? (
                'Lưu thay đổi'
              ) : (
                'Tạo khoản định kỳ'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
