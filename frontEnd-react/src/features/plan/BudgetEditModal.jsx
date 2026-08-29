import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { DEFAULT_EXPENSE_CATEGORIES, getCategoryIcon } from '../../utils/categories';
import { formatCurrency, formatDate, getLocalMonthString } from '../../utils/formatters';

export function BudgetEditModal({ isOpen, onClose, initialCategory = null }) {
  const { budgets, expenseCategories, transactions, updateBudgetsAndCategories, setExpenseCategories } = useTransactionStore();
  const { selectedMonth } = useSpendingStore();
  const { addToast } = useToastStore();

  // Local draft state
  const [categoriesDraft, setCategoriesDraft] = useState([]);
  const [expandedCat, setExpandedCat] = useState(null);
  const [rowAmountInputs, setRowAmountInputs] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Delete popover confirmation state
  const [deletingCat, setDeletingCat] = useState(null);

  // New Category Panel state
  const [newCatName, setNewCatName] = useState('');
  const [newCatAmount, setNewCatAmount] = useState('');
  const [newCatError, setNewCatError] = useState('');

  const modalRef = useRef(null);
  const listContainerRef = useRef(null);
  const triggerRef = useRef(null);
  const prevIsOpenRef = useRef(false);

  useFocusTrap(modalRef, isOpen);

  // Active month display label
  const activeMonthStr = selectedMonth || getLocalMonthString();
  const monthDateObj = new Date(`${activeMonthStr}-01`);
  const monthDisplay = formatDate(monthDateObj, 'month');

  const handleRequestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Initialize draft data ONLY when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Save active element to restore focus on close
      triggerRef.current = document.activeElement;

      // Build unified list of categories:
      // 1. Current expenseCategories
      // 2. Any categories with expense transactions
      // 3. Any categories configured in budgets object
      // 4. Default expense categories (Housing & Bills, Food & Dining, etc.)
      const currentCats = expenseCategories && expenseCategories.length > 0 ? expenseCategories : [];
      const knownCategoryNames = new Set(currentCats.map((c) => c.name.toLowerCase()));

      const list = [...currentCats];

      // Add categories from transactions that aren't in expenseCategories yet
      (transactions || []).forEach((t) => {
        if (t.type === 'expense' && t.category) {
          const lower = t.category.toLowerCase();
          if (!knownCategoryNames.has(lower)) {
            knownCategoryNames.add(lower);
            list.push({
              name: t.category,
              icon: getCategoryIcon(t.category, 'expense')
            });
          }
        }
      });

      // Add categories from budgets that aren't in list yet
      Object.keys(budgets || {}).forEach((catName) => {
        const lower = catName.toLowerCase();
        if (!knownCategoryNames.has(lower)) {
          knownCategoryNames.add(lower);
          list.push({
            name: catName,
            icon: getCategoryIcon(catName, 'expense')
          });
        }
      });

      // Add default expense categories so user has the standard set
      DEFAULT_EXPENSE_CATEGORIES.forEach((defCat) => {
        const lower = defCat.name.toLowerCase();
        if (!knownCategoryNames.has(lower)) {
          knownCategoryNames.add(lower);
          list.push({
            name: defCat.name,
            icon: defCat.icon
          });
        }
      });

      const initialList = list.map((c, idx) => {
        const budgetVal = budgets && budgets[c.name] !== undefined ? Number(budgets[c.name]) : null;
        return {
          id: `cat_${idx}_${c.name}`,
          name: c.name,
          icon: c.icon || getCategoryIcon(c.name, 'expense'),
          isSystem: false,
          limit: budgetVal && budgetVal > 0 ? budgetVal : null,
          order: idx + 1
        };
      });

      setCategoriesDraft(initialList);

      // Populate row inputs
      const inputsMap = {};
      initialList.forEach((c) => {
        inputsMap[c.name] = c.limit ? c.limit.toLocaleString('vi-VN') : '';
      });
      setRowAmountInputs(inputsMap);

      setIsDirty(false);
      setErrorMsg('');
      setNewCatName('');
      setNewCatAmount('');
      setNewCatError('');
      setDeletingCat(null);

      // If initialCategory is specified, expand and focus it
      if (initialCategory) {
        setExpandedCat(initialCategory);
        setTimeout(() => {
          const el = document.getElementById(`input-amount-${initialCategory}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
          }
        }, 100);
      } else {
        setExpandedCat(null);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialCategory, budgets, expenseCategories, transactions]);

  // Handle ESC key with unsaved change check
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleRequestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleRequestClose]);

  // Compute live total summary from draft
  const { totalLimitDraft, limitedCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    categoriesDraft.forEach((c) => {
      if (typeof c.limit === 'number' && c.limit > 0) {
        sum += c.limit;
        count++;
      }
    });
    return { totalLimitDraft: sum, limitedCount: count };
  }, [categoriesDraft]);

  // Toggle row expand / state
  const handleToggleRow = (catName) => {
    if (expandedCat === catName) {
      setExpandedCat(null);
    } else {
      setExpandedCat(catName);
    }
  };

  // Switch row to "Chưa đặt hạn mức" (clears limit to null)
  const handleSetRowUnset = (catName) => {
    setCategoriesDraft((prev) =>
      prev.map((c) => (c.name === catName ? { ...c, limit: null } : c))
    );
    setRowAmountInputs((prev) => ({ ...prev, [catName]: '' }));
    setExpandedCat(null);
    setIsDirty(true);
  };

  // Commit in-row amount edit
  const handleSaveRowAmount = (catName) => {
    const rawVal = rowAmountInputs[catName] || '';
    const cleanNum = parseInt(rawVal.replace(/\D/g, ''), 10);

    if (!cleanNum || cleanNum <= 0) {
      // Treat as unset
      handleSetRowUnset(catName);
      return;
    }

    setCategoriesDraft((prev) =>
      prev.map((c) => (c.name === catName ? { ...c, limit: cleanNum } : c))
    );
    setExpandedCat(null);
    setIsDirty(true);
  };

  // Format currency on typing
  const handleRowInputChange = (catName, value) => {
    const rawDigits = value.replace(/\D/g, '');
    const formatted = rawDigits ? parseInt(rawDigits, 10).toLocaleString('vi-VN') : '';
    setRowAmountInputs((prev) => ({ ...prev, [catName]: formatted }));
    setIsDirty(true);
  };

  // Delete category popover confirm
  const handleConfirmDelete = (cat) => {
    const deletedItem = { ...cat };
    const updatedDraft = categoriesDraft.filter((c) => c.name !== cat.name);

    setCategoriesDraft(updatedDraft);
    setRowAmountInputs((prev) => {
      const copy = { ...prev };
      delete copy[cat.name];
      return copy;
    });
    setDeletingCat(null);
    setIsDirty(true);

    // Sync categories directly to store so BudgetsTab & TransactionModal update immediately
    const newCategories = updatedDraft.map((c) => ({ name: c.name, icon: c.icon }));
    setExpenseCategories(newCategories);

    addToast({
      type: 'info',
      message: `Đã xóa danh mục "${cat.name}".`,
      action: {
        label: 'Hoàn tác',
        onClick: () => {
          const restoredDraft = [...updatedDraft, deletedItem];
          setCategoriesDraft(restoredDraft);
          setRowAmountInputs((prev) => ({
            ...prev,
            [deletedItem.name]: deletedItem.limit ? deletedItem.limit.toLocaleString('vi-VN') : ''
          }));
          setIsDirty(true);
          setExpenseCategories(restoredDraft.map((c) => ({ name: c.name, icon: c.icon })));
          addToast({
            type: 'success',
            message: `Đã khôi phục danh mục "${deletedItem.name}".`
          });
        }
      },
      duration: 5000
    });
  };

  // Add new category
  const handleAddNewCategory = (e) => {
    if (e) e.preventDefault();
    setNewCatError('');

    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      setNewCatError('Vui lòng nhập tên danh mục mới.');
      return;
    }

    const exists = categoriesDraft.some(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setNewCatError(`Danh mục "${trimmedName}" đã tồn tại.`);
      return;
    }

    let parsedLimit = null;
    if (newCatAmount && newCatAmount.trim() !== '') {
      const cleanNum = parseInt(newCatAmount.replace(/\D/g, ''), 10);
      if (cleanNum && cleanNum > 0) {
        parsedLimit = cleanNum;
      }
    }

    const newCategory = {
      id: `cat_custom_${Date.now()}`,
      name: trimmedName,
      icon: getCategoryIcon(trimmedName, 'expense'),
      isSystem: false,
      limit: parsedLimit,
      order: categoriesDraft.length + 1
    };

    const updatedDraft = [...categoriesDraft, newCategory];
    setCategoriesDraft(updatedDraft);
    setRowAmountInputs((prev) => ({
      ...prev,
      [trimmedName]: parsedLimit ? parsedLimit.toLocaleString('vi-VN') : ''
    }));

    setNewCatName('');
    setNewCatAmount('');
    setNewCatError('');
    setIsDirty(true);

    // Sync categories directly to store
    setExpenseCategories(updatedDraft.map((c) => ({ name: c.name, icon: c.icon })));

    setTimeout(() => {
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
      }
    }, 60);
  };

  // Global Save to store
  const handleGlobalSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const payload = {};
    categoriesDraft.forEach((c) => {
      if (typeof c.limit === 'number' && c.limit > 0) {
        payload[c.name] = c.limit;
      }
    });

    const finalCategories = categoriesDraft.map((c) => ({ name: c.name, icon: c.icon }));

    setIsSubmitting(true);
    try {
      await updateBudgetsAndCategories(payload, finalCategories);
      setIsSubmitting(false);
      onClose();
      addToast({
        type: 'success',
        message: `Đã cập nhật hạn mức ${monthDisplay}!`,
        duration: 4000
      });
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Không thể lưu hạn mức ngân sách.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleRequestClose();
      }}
    >
      <dialog
        ref={modalRef}
        className="budget-setup-dialog"
        open
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-dialog-title"
        aria-describedby="budget-dialog-desc"
      >
        {/* ── Dialog Header (Fixed) ── */}
        <div className="budget-dialog-header">
          <div className="budget-dialog-header-lead">
            <div className="budget-dialog-icon-tile" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="20" y2="10" />
                <line x1="18" x2="18" y1="20" y2="4" />
                <line x1="6" x2="6" y1="20" y2="16" />
              </svg>
            </div>
            <div className="budget-dialog-titles">
              <h2 id="budget-dialog-title" className="budget-dialog-title">
                Thiết lập hạn mức ngân sách tháng
              </h2>
              <p id="budget-dialog-desc" className="budget-dialog-desc">
                Đặt hạn mức tối đa hoặc tạo thêm danh mục tùy ý để kiểm soát chi tiêu.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="budget-dialog-close-btn"
            onClick={handleRequestClose}
            aria-label="Đóng hộp thoại"
            title="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Dialog Body ── */}
        <form onSubmit={handleGlobalSubmit} className="budget-dialog-form" noValidate>
          <div className="budget-dialog-content">
            {/* 1. Monthly Total Summary Card */}
            <div className="budget-dialog-summary-card">
              <div className="summary-card-left">
                <div className="summary-wallet-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" x2="22" y1="10" y2="10" />
                  </svg>
                </div>
                <div className="summary-texts">
                  <span className="summary-title">Tổng hạn mức cả tháng</span>
                  <span className="summary-subtext">({limitedCount} danh mục đang đặt hạn mức)</span>
                </div>
              </div>

              <div className="summary-card-right">
                <strong className={`summary-total-num ${limitedCount === 0 ? 'is-unset' : ''}`}>
                  {limitedCount === 0 ? 'Chưa thiết lập' : formatCurrency(totalLimitDraft)}
                </strong>
              </div>
            </div>

            {/* 2. Scrollable Category List */}
            <div className="budget-category-list-scrollable" ref={listContainerRef}>
              {categoriesDraft.map((cat) => {
                const isExpanded = expandedCat === cat.name;
                const hasLimit = typeof cat.limit === 'number' && cat.limit > 0;
                const isDeleting = deletingCat?.name === cat.name;

                return (
                  <div
                    key={cat.name}
                    className={`budget-editor-row ${isExpanded ? 'is-expanded' : ''}`}
                  >
                    {/* Top Row: Icon, Name, State Control, Delete */}
                    <div className="editor-row-main">
                      <div className="editor-row-cat-info">
                        <div className="editor-row-emoji-tile" aria-hidden="true">
                          {cat.icon}
                        </div>
                        <span className="editor-row-name">{cat.name}</span>
                      </div>

                      <div className="editor-row-actions">
                        {/* State control button */}
                        <button
                          type="button"
                          className={`editor-row-state-btn ${hasLimit ? 'state-limited' : 'state-unset'}`}
                          onClick={() => handleToggleRow(cat.name)}
                          aria-expanded={isExpanded}
                        >
                          <span>{hasLimit ? `Hạn mức: ${formatCurrency(cat.limit)}` : 'Chưa đặt hạn mức'}</span>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`editor-chevron ${isExpanded ? 'is-up' : ''}`}
                            aria-hidden="true"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {/* Delete Category Button */}
                        <div className="editor-delete-wrapper">
                          <button
                            type="button"
                            className="editor-row-delete-btn"
                            onClick={() => setDeletingCat(cat)}
                            title={`Xóa danh mục ${cat.name}`}
                            aria-label={`Xóa danh mục ${cat.name}`}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>

                          {/* Delete Confirmation Popover */}
                          {isDeleting && (
                            <div className="delete-confirm-popover" role="alertdialog" aria-labelledby={`delete-title-${cat.name}`}>
                              <p id={`delete-title-${cat.name}`} className="delete-popover-msg">
                                Xóa <strong>"{cat.name}"</strong>? Danh mục và hạn mức nháp của nó sẽ bị xóa.
                              </p>
                              <div className="delete-popover-actions">
                                <button
                                  type="button"
                                  className="btn-popover-cancel"
                                  onClick={() => setDeletingCat(null)}
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  className="btn-popover-danger"
                                  onClick={() => handleConfirmDelete(cat)}
                                >
                                  Xóa danh mục
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Edit Form */}
                    {isExpanded && (
                      <div className="editor-row-expanded-form">
                        <div className="expanded-input-group">
                          <label className="expanded-input-label" htmlFor={`input-amount-${cat.name}`}>
                            Số tiền hạn mức tháng:
                          </label>
                          <div className="expanded-input-wrap">
                            <input
                              id={`input-amount-${cat.name}`}
                              type="text"
                              inputMode="numeric"
                              className="expanded-amount-input"
                              placeholder="Nhập số tiền"
                              value={rowAmountInputs[cat.name] || ''}
                              onChange={(e) => handleRowInputChange(cat.name, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveRowAmount(cat.name);
                                }
                              }}
                              autoFocus
                            />
                            <span className="expanded-input-suffix">VNĐ</span>
                          </div>
                          <span className="expanded-helper-text">Ví dụ: 2.000.000</span>
                        </div>

                        <div className="expanded-row-buttons">
                          <button
                            type="button"
                            className="btn-expanded-unset"
                            onClick={() => handleSetRowUnset(cat.name)}
                          >
                            Xóa hạn mức
                          </button>
                          <button
                            type="button"
                            className="btn-expanded-save"
                            onClick={() => handleSaveRowAmount(cat.name)}
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 3. Add Custom Category Panel */}
              <div className="budget-add-category-panel">
                <div className="add-cat-header">
                  <span className="add-cat-icon">✨</span>
                  <strong className="add-cat-title">+ Thêm danh mục mới</strong>
                </div>

                <div className="add-cat-form-row">
                  <input
                    type="text"
                    className="add-cat-name-input"
                    placeholder="Tên danh mục mới"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    maxLength={40}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewCategory();
                      }
                    }}
                  />

                  <div className="add-cat-amount-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="add-cat-amount-input"
                      placeholder="Số tiền (VNĐ)"
                      value={newCatAmount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setNewCatAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewCategory();
                        }
                      }}
                    />
                    <span className="expanded-input-suffix">VNĐ</span>
                  </div>

                  <button
                    type="button"
                    className="btn-add-cat-submit"
                    onClick={handleAddNewCategory}
                  >
                    + Thêm
                  </button>
                </div>

                {newCatError && (
                  <div className="add-cat-error-msg" role="alert">
                    ⚠️ {newCatError}
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="budget-dialog-error" role="alert">
                ⚠️ {errorMsg}
              </div>
            )}
          </div>

          {/* ── Dialog Sticky Footer ── */}
          <div className="budget-dialog-footer">
            <button
              type="button"
              className="btn-dialog-cancel"
              onClick={handleRequestClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-dialog-save"
              disabled={isSubmitting || !isDirty}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                'Lưu hạn mức ngân sách'
              )}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
