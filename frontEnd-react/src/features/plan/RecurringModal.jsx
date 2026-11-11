import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useToastStore } from '../../stores/useToastStore';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatInputNumber, getLocalDateString } from '../../utils/formatters';
import { DEFAULT_EXPENSE_CATEGORIES, getCategoryIcon } from '../../utils/categories';
import { detectBrandInfo } from '../../utils/brandDetection';
import { useTranslation } from '../../i18n/useTranslation';
import { translateLegacyText } from '../../i18n/legacyTranslations';
import { isInstallmentEnded, isValidInstallmentEndDate } from '../../utils/installmentTerm';

import { Icon } from '../../components/ui/AppIcons';
import { CYCLE_OPTIONS } from './recurring/cycleOptions';
import { RecurringNotesSection } from './recurring/RecurringNotesSection';
import { RecurringScheduleSection } from './recurring/RecurringScheduleSection';
import { RecurringIdentitySection } from './recurring/RecurringIdentitySection';
export function RecurringModal({ isOpen, onClose, installmentToEdit = null }) {
  const { label, lang } = useTranslation();
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
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
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

  const nameInputRef = useRef(null);
  const catRef = useRef(null);
  const walRef = useRef(null);
  const cycRef = useRef(null);
  const newCatInputRef = useRef(null);


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
      const savedWalletId = installmentToEdit.walletId ? String(installmentToEdit.walletId) : '';
      setWalletId(wallets.some((wallet) => String(wallet.id) === savedWalletId)
        ? savedWalletId : '');
      setAmount(installmentToEdit.amount ? formatInputNumber(installmentToEdit.amount) : '');
      setCycle(installmentToEdit.cycle || 'monthly');
      setNextDueDate(installmentToEdit.nextDueDate ? String(installmentToEdit.nextDueDate).slice(0, 10) : getLocalDateString());
      setHasEndDate(Boolean(installmentToEdit.endDate));
      setEndDate(installmentToEdit.endDate ? String(installmentToEdit.endDate).slice(0, 10) : '');
      setNote(installmentToEdit.note || installmentToEdit.desc || '');
    } else {
      setName('');
      setCategory(defaultCatName);
      setWalletId(wallets[0]?.id || '');
      setAmount('');
      setCycle('monthly');
      setNextDueDate(getLocalDateString());
      setHasEndDate(false);
      setEndDate('');
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
          setNote(translateLegacyText(lang, brand.noteDefault));
        }
      }
    }
  };

  // Tạo nhanh danh mục mới trực tiếp trong dropdown
  const handleCreateNewCategory = async (e) => {
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
      try { await setExpenseCategories(updatedList); }
      catch (error) {
        addToast({ type: 'error', message: getUserErrorMessage(error, 'error.save') });
        return;
      }
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
    setAmount(num ? formatInputNumber(num) : '');
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

    if (hasEndDate && !isValidInstallmentEndDate(endDate)) {
      setErrorMsg('Vui lòng chọn ngày kết thúc hợp lệ.');
      return;
    }

    if (!installmentToEdit && hasEndDate && endDate < nextDueDate) {
      setErrorMsg('Ngày kết thúc không được trước ngày đến hạn đầu tiên.');
      return;
    }

    const savedWalletUnavailable = Boolean(installmentToEdit?.walletId)
      && !wallets.some((wallet) => String(wallet.id) === String(installmentToEdit.walletId));
    const willBeEnded = isInstallmentEnded({ nextDueDate, endDate: hasEndDate ? endDate : null });
    if (savedWalletUnavailable && !walletId && !willBeEnded) {
      setErrorMsg('Vui lòng chọn ví đang hoạt động trước khi tiếp tục khoản định kỳ.');
      return;
    }

    const brand = detectBrandInfo(name.trim());
    const finalCategory = category || brand.categoryDefault || syncedExpenseCategories[0]?.name || 'Housing & Bills';

    const payload = {
      name: name.trim(),
      category: finalCategory,
      ...((savedWalletUnavailable && !walletId) ? {} : { walletId: walletId || wallets[0]?.id || null }),
      amount: cleanAmount,
      cycle,
      nextDueDate,
      endDate: hasEndDate ? endDate : null,
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
      setErrorMsg(getUserErrorMessage(err, 'error.save'));
    }
  };

  const selectedWallet = wallets.find((w) => String(w.id) === String(walletId))
    || (installmentToEdit ? null : wallets[0]);
  const hasArchivedWallet = Boolean(installmentToEdit?.walletId)
    && !wallets.some((wallet) => String(wallet.id) === String(installmentToEdit.walletId))
    && !walletId;
  const selectedCycleLabel = CYCLE_OPTIONS.find((c) => c.value === cycle)?.label || 'Hàng tháng';
  const categoryDisplayName = category ? label(category) : translateLegacyText(lang, 'Chọn danh mục');

  return (
    <Dialog
      isOpen
      onClose={onClose}
      busy={isSubmitting}
      overlayClassName="txn-modal-backdrop"
      className="txn-modal-card recurring-modal-dialog"
      labelledBy="recurring-modal-title"
    >
        {/* Header (Pure Outline SVG, No Emojis) */}
        <div className="txn-modal-header">
          <div className="recurring-modal-header-lead">
            <div className="modal-header-icon-box" aria-hidden="true">
              <Icon name={installmentToEdit ? 'pencil' : 'plus'} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </div>
            <h2 id="recurring-modal-title" className="txn-modal-title">
              {installmentToEdit ? 'Chỉnh sửa khoản định kỳ' : 'Thêm khoản định kỳ'}
            </h2>
          </div>

          <button
            type="button"
            className="txn-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng cửa sổ"
          >
            <Icon name="close" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="txn-modal-body recurring-modal-body-grouped">
            {/* ── Section 1: Định danh & Phân loại ── */}
            <RecurringIdentitySection catRef={catRef} category={category} categoryDisplayName={categoryDisplayName} handleCreateNewCategory={handleCreateNewCategory} handleNameChange={handleNameChange} isAddingNewCategory={isAddingNewCategory} isCategoryDropdownOpen={isCategoryDropdownOpen} name={name} nameInputRef={nameInputRef} newCatInputName={newCatInputName} newCatInputRef={newCatInputRef} setCategory={setCategory} setIsAddingNewCategory={setIsAddingNewCategory} setIsCategoryDropdownOpen={setIsCategoryDropdownOpen} setIsCycleDropdownOpen={setIsCycleDropdownOpen} setIsWalletDropdownOpen={setIsWalletDropdownOpen} setNewCatInputName={setNewCatInputName} syncedExpenseCategories={syncedExpenseCategories} />

            {/* ── Section 2: Thiết lập dòng tiền & Chu kỳ ── */}
            <RecurringScheduleSection amount={amount} cycRef={cycRef} cycle={cycle} endDate={endDate} handleAmountChange={handleAmountChange} hasArchivedWallet={hasArchivedWallet} hasEndDate={hasEndDate} installmentToEdit={installmentToEdit} isCycleDropdownOpen={isCycleDropdownOpen} isWalletDropdownOpen={isWalletDropdownOpen} nextDueDate={nextDueDate} selectedCycleLabel={selectedCycleLabel} selectedWallet={selectedWallet} setCycle={setCycle} setEndDate={setEndDate} setHasEndDate={setHasEndDate} setIsCategoryDropdownOpen={setIsCategoryDropdownOpen} setIsCycleDropdownOpen={setIsCycleDropdownOpen} setIsWalletDropdownOpen={setIsWalletDropdownOpen} setNextDueDate={setNextDueDate} setWalletId={setWalletId} walRef={walRef} wallets={wallets} />

            {/* ── Section 3: Ghi chú & Thông tin bổ sung ── */}
            <RecurringNotesSection note={note} setNote={setNote} />

            {/* Error Message */}
            {errorMsg && (
              <div className="txn-error-banner" role="alert">
                <Icon name="alertCircle" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="txn-modal-footer">
            <Button variant="secondary" size="lg" className="txn-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="lg" className="txn-btn-submit" loading={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : installmentToEdit ? 'Lưu thay đổi' : 'Tạo khoản định kỳ'}
            </Button>
          </div>
        </form>
    </Dialog>
  );
}
