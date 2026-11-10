import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useToastStore } from '../../stores/useToastStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useJarStore } from '../../stores/useJarStore';
import { Dialog } from '../../components/ui/Dialog';
import { useBudgetCopy } from './budgetCopy';
import { DEFAULT_EXPENSE_CATEGORIES, getCategoryIcon } from '../../utils/categories';
import { CategoryOutlineIcon, AlertTriangleOutlineIcon } from '../../utils/categoryIcons';
import { calculateAvailableToSpend, calculateMonthlyStats } from '../../utils/financeMath';
import { formatCurrency, formatDate, formatInputNumber, formatPercent, getLocalMonthString } from '../../utils/formatters';
import { BREAKPOINTS } from '../../hooks/useMediaQuery';

import { Icon } from '../../components/ui/AppIcons';
// Limits are typed straight into each row; the draft only becomes real on "Save".
const MAX_AMOUNT_DIGITS = 15;
const SHEET_DISMISS_DISTANCE = 96;
const SHEET_MEDIA_QUERY = `(max-width: ${BREAKPOINTS.phone}px)`;

function toAmountInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_AMOUNT_DIGITS);
  return digits ? formatInputNumber(digits) : '';
}

function parseAmount(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const amount = digits ? Number(digits) : 0;
  return amount > 0 ? amount : null;
}

function serializeDraft(rows) {
  return rows.map((row) => `${row.name}\u0000${parseAmount(row.input) ?? ''}`).join('\u0001');
}

function monthStartDate(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

// Category names contain spaces and symbols ("Food & Dining"), which break
// space-separated ARIA id references, so derive a token-safe id instead.
function safeDomId(prefix, name) {
  const token = Array.from(name)
    .map((ch) => (/[A-Za-z0-9_-]/.test(ch) ? ch : `_${ch.codePointAt(0).toString(16)}`))
    .join('');
  return `${prefix}-${token}`;
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CloseIcon({ size = 20 }) {
  return (
    <Icon name="closeAlt" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BudgetEditModal({ isOpen, onClose, initialCategory = null }) {
  const t = useBudgetCopy();
  const { budgets, expenseCategories, transactions, updateBudgetsAndCategories } = useTransactionStore();
  const selectedMonth = useSpendingStore((s) => s.selectedMonth);
  const { addToast } = useToastStore();
  const { wallets } = useWalletStore();
  const { jars } = useJarStore();

  // Draft rows: { name, icon, input } — `input` is the formatted amount string.
  const [rows, setRows] = useState([]);
  const [baseline, setBaseline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingName, setDeletingName] = useState(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatAmount, setNewCatAmount] = useState('');
  const [newCatError, setNewCatError] = useState('');

  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef(null);

  const modalRef = useRef(null);
  const addTriggerRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const prevIsOpenRef = useRef(false);


  const activeMonthStr = selectedMonth || getLocalMonthString();
  const monthDisplay = formatDate(monthStartDate(activeMonthStr), 'month');

  const handleRequestClose = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);

  // Build the draft only when the dialog goes from closed to open.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const currentCats = expenseCategories && expenseCategories.length > 0 ? expenseCategories : [];
      const knownNames = new Set(currentCats.map((c) => c.name.toLowerCase()));
      const list = [...currentCats];

      (transactions || []).forEach((tx) => {
        if (tx.type !== 'expense' || !tx.category) return;
        const lower = tx.category.toLowerCase();
        if (knownNames.has(lower)) return;
        knownNames.add(lower);
        list.push({ name: tx.category, icon: getCategoryIcon(tx.category, 'expense') });
      });

      Object.keys(budgets || {}).forEach((catName) => {
        const lower = catName.toLowerCase();
        if (knownNames.has(lower)) return;
        knownNames.add(lower);
        list.push({ name: catName, icon: getCategoryIcon(catName, 'expense') });
      });

      // Seed defaults only for a brand-new user with no categories at all.
      if (list.length === 0) {
        DEFAULT_EXPENSE_CATEGORIES.forEach((defCat) => list.push({ name: defCat.name, icon: defCat.icon }));
      }

      const initialRows = list.map((c) => {
        const limit = budgets && budgets[c.name] !== undefined ? Number(budgets[c.name]) : 0;
        return {
          name: c.name,
          icon: c.icon || getCategoryIcon(c.name, 'expense'),
          input: limit > 0 ? toAmountInput(limit) : ''
        };
      });

      setRows(initialRows);
      setBaseline(serializeDraft(initialRows));
      setErrorMsg('');
      setDeletingName(null);
      setIsAdding(false);
      setNewCatName('');
      setNewCatAmount('');
      setNewCatError('');
      setDragOffset(0);

      if (initialCategory) {
        setTimeout(() => {
          const el = document.getElementById(`input-amount-${initialCategory}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
          }
        }, 100);
      } else {
        // Start on the dialog itself: no keyboard pops up on phones and screen
        // readers announce the title first.
        modalRef.current?.focus();
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialCategory, budgets, expenseCategories, transactions]);

  const cancelAdd = useCallback(() => {
    setIsAdding(false);
    setNewCatName('');
    setNewCatAmount('');
    setNewCatError('');
    requestAnimationFrame(() => addTriggerRef.current?.focus());
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeletingName(null);
    requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  }, []);

  // Escape peels back one layer at a time: confirm popover → add form → dialog.
  const handleEscape = () => {
    if (deletingName) closeDeleteConfirm();
    else if (isAdding) cancelAdd();
    else handleRequestClose();
  };

  // Keep the delete confirmation fully visible and start on its safe choice.
  useEffect(() => {
    if (!deletingName) return;
    const popover = modalRef.current?.querySelector('.blimit-confirm');
    popover?.scrollIntoView({ block: 'nearest' });
    popover?.querySelector('.blimit-confirm__btn.is-ghost')?.focus();
  }, [deletingName]);

  const spentByCategory = useMemo(
    () => calculateMonthlyStats(transactions || [], activeMonthStr).byCategory,
    [transactions, activeMonthStr]
  );

  const { totalLimit, limitedCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    rows.forEach((row) => {
      const limit = parseAmount(row.input);
      if (limit) {
        sum += limit;
        count += 1;
      }
    });
    return { totalLimit: sum, limitedCount: count };
  }, [rows]);

  // Compare the drafted total with the money that is actually available, so an
  // unrealistic plan shows up while it is being set rather than after overspending.
  const { availableToSpend } = useMemo(
    () => calculateAvailableToSpend({ wallets, transactions, jars, currentMonthPrefix: activeMonthStr }),
    [wallets, transactions, jars, activeMonthStr]
  );
  const unallocated = availableToSpend - totalLimit;
  const isOverAvailable = unallocated < 0;

  const meter = useMemo(() => {
    const available = Math.max(availableToSpend, 0);
    if (!isOverAvailable) {
      return { fill: available > 0 ? (totalLimit / available) * 100 : 0, over: 0, mark: null };
    }
    const scale = Math.max(totalLimit, 1);
    const within = (available / scale) * 100;
    return { fill: within, over: 100 - within, mark: within };
  }, [availableToSpend, totalLimit, isOverAvailable]);

  const isDirty = useMemo(() => serializeDraft(rows) !== baseline, [rows, baseline]);

  const handleRowInputChange = (name, value) => {
    const input = toAmountInput(value);
    setRows((prev) => prev.map((row) => (row.name === name ? { ...row, input } : row)));
  };

  const handleConfirmDelete = (name) => {
    const index = rows.findIndex((row) => row.name === name);
    if (index < 0) return;
    const removed = rows[index];
    const neighbour = rows[index + 1] || rows[index - 1];

    setRows((prev) => prev.filter((row) => row.name !== name));
    setDeletingName(null);
    requestAnimationFrame(() => {
      const next = neighbour ? document.getElementById(`input-amount-${neighbour.name}`) : null;
      (next || addTriggerRef.current || modalRef.current)?.focus();
    });

    addToast({
      type: 'info',
      message: `Đã bỏ "${name}" khỏi bản nháp. Nhấn Lưu để xác nhận.`,
      action: {
        label: 'Hoàn tác',
        onClick: () => {
          setRows((prev) => {
            if (prev.some((row) => row.name === removed.name)) return prev;
            const at = Math.min(index, prev.length);
            return [...prev.slice(0, at), removed, ...prev.slice(at)];
          });
          addToast({ type: 'success', message: `Đã khôi phục danh mục "${removed.name}".` });
        }
      },
      duration: 5000
    });
  };

  const handleAddNewCategory = () => {
    setNewCatError('');
    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      setNewCatError('Vui lòng nhập tên danh mục mới.');
      return;
    }
    if (rows.some((row) => row.name.toLowerCase() === trimmedName.toLowerCase())) {
      setNewCatError(`Danh mục "${trimmedName}" đã tồn tại.`);
      return;
    }

    const input = toAmountInput(newCatAmount);
    setRows((prev) => [...prev, { name: trimmedName, icon: getCategoryIcon(trimmedName, 'expense'), input }]);
    setIsAdding(false);
    setNewCatName('');
    setNewCatAmount('');

    // Without an amount the next step is typing one; otherwise offer another add.
    setTimeout(() => {
      const newInput = document.getElementById(`input-amount-${trimmedName}`);
      newInput?.scrollIntoView({ block: 'nearest' });
      if (!input && newInput) newInput.focus();
      else addTriggerRef.current?.focus();
    }, 30);
  };

  const handleGlobalSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (activeMonthStr < getLocalMonthString()) {
      setErrorMsg('Kỳ ngân sách của tháng trước đã kết thúc. Không thể chỉnh sửa ngân sách quá khứ.');
      return;
    }

    const payload = Object.create(null);
    rows.forEach((row) => {
      const limit = parseAmount(row.input);
      if (limit) payload[row.name] = limit;
    });
    const finalCategories = rows.map((row) => ({ name: row.name, icon: row.icon }));

    setIsSubmitting(true);
    try {
      await updateBudgetsAndCategories(payload, finalCategories, activeMonthStr);
      setIsSubmitting(false);
      onClose();
      addToast({ type: 'success', message: `Đã cập nhật hạn mức ${monthDisplay}!`, duration: 4000 });
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(getUserErrorMessage(err, 'error.save'));
    }
  };

  // Phones: drag the sheet header down to dismiss (the grabber promises it).
  const handleSheetPointerDown = (e) => {
    if (!window.matchMedia(SHEET_MEDIA_QUERY).matches || e.button > 0) return;
    if (e.target.closest('button')) return;
    dragRef.current = { startY: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleSheetPointerMove = (e) => {
    if (!dragRef.current) return;
    setDragOffset(Math.max(0, e.clientY - dragRef.current.startY));
  };

  const handleSheetPointerEnd = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const shouldClose = dragOffset > SHEET_DISMISS_DISTANCE;
    setDragOffset(0);
    if (shouldClose) handleRequestClose();
  };

  const handleDialogMouseDown = (e) => {
    if (deletingName && !e.target.closest('.blimit-row__delete-wrap')) setDeletingName(null);
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen
      onClose={handleRequestClose}
      onEscape={handleEscape}
      panelRef={modalRef}
      overlayClassName="modal-backdrop-overlay blimit-overlay"
      className={`blimit-dialog${dragOffset ? ' is-dragging' : ''}`}
      labelledBy="blimit-title"
      describedBy="blimit-desc"
      panelProps={{
        style: dragOffset ? { '--sheet-drag-offset': `${dragOffset}px` } : undefined,
        onMouseDown: handleDialogMouseDown,
      }}
    >
        <div
          className="blimit-handle-zone"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerEnd}
          onPointerCancel={handleSheetPointerEnd}
        >
          <span className="blimit-grabber" aria-hidden="true" />
          <header className="blimit-head">
            <div className="blimit-head__text">
              <h2 id="blimit-title" className="blimit-title">{t('budgetEditor.title')}</h2>
              <p id="blimit-desc" className="blimit-subtitle">{t('budgetEditor.subtitle', { month: monthDisplay })}</p>
            </div>
            <button
              type="button"
              className="blimit-close"
              onClick={handleRequestClose}
              disabled={isSubmitting}
              aria-label="Đóng hộp thoại"
              title={t('common.close')}
            >
              <CloseIcon />
            </button>
          </header>
        </div>

        <form onSubmit={handleGlobalSubmit} className="blimit-form" noValidate>
          <div className="blimit-body">
            {/* One summary block: total vs. money actually available. */}
            <section className="blimit-summary" aria-label={t('budgetEditor.summaryLabel')}>
              <div className="blimit-summary__grid">
                <span className="blimit-summary__label">
                  {t('budgetEditor.totalLabel')} · <b>{t('budgetEditor.categoriesCount', { count: limitedCount, total: rows.length })}</b>
                </span>
                <span className="blimit-summary__label is-end">{t('budgetEditor.availableLabel')}</span>
                <strong className={`blimit-summary__total${limitedCount === 0 ? ' is-unset' : ''}`}>
                  {limitedCount === 0 ? t('budgetEditor.notSet') : formatCurrency(totalLimit)}
                </strong>
                <strong className="blimit-summary__available">{formatCurrency(availableToSpend)}</strong>
              </div>

              <div className="blimit-meter" aria-hidden="true">
                <span
                  className={`blimit-meter__fill${meter.over > 0 ? ' is-partial' : ''}`}
                  style={{ width: `${Math.min(100, meter.fill)}%` }}
                />
                {meter.over > 0 && <span className="blimit-meter__over" style={{ width: `${meter.over}%` }} />}
                {meter.mark !== null && <span className="blimit-meter__mark" style={{ left: `${meter.mark}%` }} />}
              </div>

              <p className={`blimit-status ${isOverAvailable ? 'is-over' : 'is-ok'}`} role="status">
                {isOverAvailable ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                <span>
                  {isOverAvailable ? (
                    <>
                      <strong>{t('budgetEditor.overAvailable', { amount: formatCurrency(Math.abs(unallocated)) })}</strong>{' '}
                      {t('budgetEditor.overAvailableHint')}
                    </>
                  ) : (
                    <>
                      <strong>{t('budgetEditor.unallocated', { amount: formatCurrency(unallocated) })}</strong>{' '}
                      {t('budgetEditor.unallocatedHint')}
                    </>
                  )}
                </span>
              </p>
            </section>

            <ul className="blimit-list">
              {rows.map((row) => {
                const limit = parseAmount(row.input);
                const spent = spentByCategory[row.name] || 0;
                const percent = limit ? Math.round((spent * 100) / limit) : 0;
                const tone = limit && spent > limit ? 'over' : limit && percent >= 80 ? 'warn' : 'normal';
                const isDeleting = deletingName === row.name;
                const spentId = safeDomId('blimit-spent', row.name);
                const confirmId = safeDomId('blimit-confirm', row.name);

                return (
                  <li key={row.name} className={`blimit-row${isDeleting ? ' is-confirming' : ''}`}>
                    <span className="blimit-row__icon" aria-hidden="true">
                      <CategoryOutlineIcon name={row.name} size={18} />
                    </span>

                    <div className="blimit-row__text">
                      <span className="blimit-row__name" title={row.name}>{row.name}</span>
                      <span id={spentId} className={`blimit-row__spent is-${tone}`}>
                        {spent > 0 ? t('budgetEditor.spent', { amount: formatCurrency(spent) }) : t('budgetEditor.noSpending')}
                        {tone === 'over' && <span className="blimit-row__spent-extra"> · {t('budgetEditor.overLimit')}</span>}
                        {tone === 'warn' && <span className="blimit-row__spent-extra"> · {formatPercent(percent)}</span>}
                      </span>
                    </div>

                    <div className="blimit-amount">
                      <input
                        id={`input-amount-${row.name}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        className="blimit-amount__input"
                        placeholder={t('budgetEditor.unlimited')}
                        value={row.input}
                        onChange={(e) => handleRowInputChange(row.name, e.target.value)}
                        aria-label={t('budgetEditor.limitFor', { name: row.name })}
                        aria-describedby={spentId}
                      />
                      {row.input && <span className="blimit-amount__suffix" aria-hidden="true">₫</span>}
                    </div>

                    <div className="blimit-row__delete-wrap">
                      <button
                        type="button"
                        className="blimit-row__delete"
                        onClick={(e) => {
                          deleteTriggerRef.current = e.currentTarget;
                          setDeletingName(isDeleting ? null : row.name);
                        }}
                        aria-label={`Xóa danh mục ${row.name}`}
                        title={`Xóa danh mục ${row.name}`}
                        aria-haspopup="dialog"
                        aria-expanded={isDeleting}
                      >
                        <TrashIcon />
                      </button>

                      {isDeleting && (
                        <div className="blimit-confirm" role="alertdialog" aria-labelledby={confirmId}>
                          <p id={confirmId}>{t('budgetEditor.deleteConfirm', { name: row.name })}</p>
                          <div className="blimit-confirm__actions">
                            <button type="button" className="blimit-confirm__btn is-ghost" onClick={closeDeleteConfirm}>
                              {t('common.cancel')}
                            </button>
                            <button type="button" className="blimit-confirm__btn is-danger" onClick={() => handleConfirmDelete(row.name)}>
                              {t('budgetEditor.deleteAction')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {isAdding ? (
              <div className="blimit-add-form" role="group" aria-label={t('budgetEditor.addCategory')}>
                <span className="blimit-row__icon blimit-add-form__icon" aria-hidden="true"><PlusIcon /></span>
                <input
                  type="text"
                  className="blimit-add-form__name"
                  placeholder={t('budgetEditor.newCategoryName')}
                  aria-label={t('budgetEditor.newCategoryName')}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  maxLength={40}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewCategory();
                    }
                  }}
                />
                <div className="blimit-amount">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="blimit-amount__input"
                    placeholder={t('budgetEditor.newCategoryAmount')}
                    aria-label={t('budgetEditor.newCategoryAmount')}
                    value={newCatAmount}
                    onChange={(e) => setNewCatAmount(toAmountInput(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewCategory();
                      }
                    }}
                  />
                  {newCatAmount && <span className="blimit-amount__suffix" aria-hidden="true">₫</span>}
                </div>
                <button type="button" className="blimit-add-form__submit" onClick={handleAddNewCategory}>
                  {t('budgetEditor.addAction')}
                </button>
                <button type="button" className="blimit-add-form__cancel" onClick={cancelAdd} aria-label={t('budgetEditor.cancelAdd')} title={t('budgetEditor.cancelAdd')}>
                  <CloseIcon size={18} />
                </button>
                {newCatError && (
                  <p className="blimit-add-form__error" role="alert">
                    <AlertTriangleOutlineIcon size={14} color="currentColor" />
                    <span>{newCatError}</span>
                  </p>
                )}
              </div>
            ) : (
              <button
                ref={addTriggerRef}
                type="button"
                className="blimit-add-trigger"
                onClick={() => setIsAdding(true)}
              >
                <span className="blimit-add-trigger__icon" aria-hidden="true"><PlusIcon /></span>
                {t('budgetEditor.addCategory')}
              </button>
            )}

            {errorMsg && (
              <div className="blimit-error" role="alert">
                <AlertTriangleOutlineIcon size={14} color="currentColor" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <footer className="blimit-foot">
            <span className="blimit-dirty" aria-live="polite">{isDirty ? t('budgetEditor.unsaved') : ''}</span>
            <div className="blimit-foot__actions">
              <button type="button" className="blimit-btn blimit-btn--ghost" onClick={handleRequestClose} disabled={isSubmitting}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="blimit-btn blimit-btn--primary" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  t('budgetEditor.save')
                )}
              </button>
            </div>
          </footer>
        </form>
    </Dialog>
  );
}
