import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { RecurringModal } from './RecurringModal';
import { formatCurrency, getDueStatus, getRecurringTier, formatDate, getLocalMonthString } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTranslation } from '../../i18n/useTranslation';
import { isInstallmentEnded } from '../../utils/installmentTerm';
import { PageTitleIcon } from '../../components/ui/NavIcons';

import { Icon } from '../../components/ui/AppIcons';
import { SORT_OPTIONS } from './recurring/recurringOptions';
import { RecurringSummaryBox } from './recurring/RecurringSummaryBox';
import { RecurringList } from './recurring/RecurringList';
import { RecurringFilterBar } from './recurring/RecurringFilterBar';
import { RecurringHeaderCard } from './recurring/RecurringHeaderCard';
export function RecurringTab() {
  const { t } = useTranslation();
  const { installments, payInstallment, toggleInstallment, deleteInstallment, updateInstallment, isLoading } = useJarStore();
  const { wallets } = useWalletStore();
  const { confirm } = useConfirmStore();
  const { addToast } = useToastStore();
  const selectedMonth = useSpendingStore((s) => s.selectedMonth);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);

  // Active filter tab: 'all' | 'soon' | 'today' | 'overdue'
  const [filterTab, setFilterTab] = useState('all');

  // Sort: 'due-asc' | 'amount-desc' | 'name-asc'
  const [sortBy, setSortBy] = useState('due-asc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortRef = useRef(null);

  // 3-dots action menu state
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const menuRef = useRef(null);
  // Nút ⋮ đã mở menu: nhận lại focus khi đóng hộp thoại xác nhận (mục menu đã biến mất).
  const menuTriggerRef = useRef(null);

  // Wallet inline selector popover state
  const [openWalletSelectorId, setOpenWalletSelectorId] = useState(null);
  const walletRef = useRef(null);
  const [pendingActions, setPendingActions] = useState({});
  const pendingIdsRef = useRef(new Set());

  const beginAction = (id, action) => {
    if (pendingIdsRef.current.has(id)) return false;
    pendingIdsRef.current.add(id);
    setPendingActions((current) => ({ ...current, [id]: action }));
    return true;
  };

  const finishAction = (id) => {
    pendingIdsRef.current.delete(id);
    setPendingActions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  // Close menus on click outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenActionMenuId(null);
      }
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortDropdownOpen(false);
      }
      if (walletRef.current && !walletRef.current.contains(e.target)) {
        setOpenWalletSelectorId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Current month string
  const currentMonthStr = selectedMonth || getLocalMonthString();
  const monthDisplayLabel = currentMonthStr ? formatDate(new Date(`${currentMonthStr}-01`), 'month') : 'Tháng này';

  // Active items
  const activeItems = useMemo(() => {
    return (installments || []).filter((item) => item.active !== false && !isInstallmentEnded(item));
  }, [installments]);

  // Total monthly estimated cost
  const monthlyEstimatedCost = useMemo(() => {
    return activeItems.reduce((sum, item) => {
      const amt = Number(item.amount) || 0;
      if (item.cycle === 'yearly') return sum + amt / 12;
      if (item.cycle === 'quarterly') return sum + amt / 3;
      return sum + amt;
    }, 0);
  }, [activeItems]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let soon = 0;

    activeItems.forEach((item) => {
      const tierInfo = getRecurringTier(item, currentMonthStr);
      // Nếu đã thanh toán trong tháng này thì không tính vào nhắc nhở
      if (tierInfo.isPaidThisMonth) return;

      if (tierInfo.isOverdue) overdue++;
      else if (tierInfo.isToday) today++;
      else if (tierInfo.tier === 'danger' || tierInfo.tier === 'warning') soon++;
    });

    return {
      all: installments.length,
      soon,
      today,
      overdue
    };
  }, [installments, activeItems, currentMonthStr]);

  // Filtered and Sorted list
  const displayItems = useMemo(() => {
    let list = [...installments];

    // Filter
    if (filterTab === 'soon') {
      list = list.filter((item) => {
        if (isInstallmentEnded(item)) return false;
        const tierInfo = getRecurringTier(item, currentMonthStr);
        if (tierInfo.isPaidThisMonth) return false;
        return tierInfo.tier === 'danger' || tierInfo.tier === 'warning';
      });
    } else if (filterTab === 'today') {
      list = list.filter((item) => {
        if (isInstallmentEnded(item)) return false;
        const tierInfo = getRecurringTier(item, currentMonthStr);
        if (tierInfo.isPaidThisMonth) return false;
        return tierInfo.isToday;
      });
    } else if (filterTab === 'overdue') {
      list = list.filter((item) => {
        if (isInstallmentEnded(item)) return false;
        const tierInfo = getRecurringTier(item, currentMonthStr);
        if (tierInfo.isPaidThisMonth) return false;
        return tierInfo.isOverdue;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'due-asc' && isInstallmentEnded(a) !== isInstallmentEnded(b)) {
        return isInstallmentEnded(a) ? 1 : -1;
      }
      if (sortBy === 'due-asc') {
        const tierA = getRecurringTier(a, currentMonthStr);
        const tierB = getRecurringTier(b, currentMonthStr);
        // Ưu tiên hiển thị khoản chưa thanh toán lên trước, khoản đã trả xếp sau
        if (tierA.isPaidThisMonth !== tierB.isPaidThisMonth) {
          return tierA.isPaidThisMonth ? 1 : -1;
        }
        const dueA = tierA.diffDays ?? 9999;
        const dueB = tierB.diffDays ?? 9999;
        return dueA - dueB;
      }
      if (sortBy === 'amount-desc') {
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      }
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return list;
  }, [installments, filterTab, sortBy, currentMonthStr]);

  // Monthly breakdown statistics for the summary card
  const monthlyBreakdown = useMemo(() => {
    let paidAmount = 0;
    let paidCount = 0;
    let upcomingSoonAmount = 0;
    let upcomingSoonCount = 0;
    let remainingAmount = 0;
    let remainingCount = 0;

    const targetMonth = currentMonthStr || getLocalMonthString();

    // 1. Tính các khoản đã thanh toán trong tháng mục tiêu từ lịch sử
    installments.forEach((item) => {
      if (Array.isArray(item.history)) {
        item.history.forEach((h) => {
          if (h && typeof h.paidDate === 'string' && h.paidDate.startsWith(targetMonth)) {
            paidAmount += Number(h.amount) || 0;
            paidCount++;
          }
        });
      }
    });

    // 2. Phân loại các khoản chưa thanh toán trong tháng mục tiêu
    activeItems.forEach((item) => {
      const isPaidInMonth = Array.isArray(item.history) && item.history.some(
        (h) => h && typeof h.paidDate === 'string' && h.paidDate.startsWith(targetMonth)
      );

      // Nếu đã thanh toán trong tháng này thì không còn là khoản cần trả trong tháng
      if (isPaidInMonth) return;

      const dueMonth = item.nextDueDate ? item.nextDueDate.slice(0, 7) : '';
      // Khoản định kỳ đến hạn trong tháng này hoặc đã quá hạn từ trước
      const isDueThisMonth = dueMonth ? dueMonth <= targetMonth : true;
      if (!isDueThisMonth) return;

      const amt = Number(item.amount) || 0;
      const due = getDueStatus(item.nextDueDate);

      // Cộng dồn vào các khoản còn lại trong tháng
      remainingAmount += amt;
      remainingCount++;

      // Nếu khoản này đến hạn hôm nay, sắp đến hạn trong 10 ngày hoặc đã quá hạn -> tính vào Sắp thanh toán
      if (due.isOverdue || due.isToday || (due.diffDays !== null && due.diffDays >= 1 && due.diffDays <= 10)) {
        upcomingSoonAmount += amt;
        upcomingSoonCount++;
      }
    });

    return {
      paidAmount,
      paidCount,
      upcomingSoonAmount,
      upcomingSoonCount,
      remainingAmount,
      remainingCount
    };
  }, [installments, activeItems, currentMonthStr]);

  // Actions
  const handleOpenCreate = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setOpenActionMenuId(null);
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  const handlePay = async (item) => {
    setOpenActionMenuId(null);
    if (isInstallmentEnded(item)) return;
    if (!beginAction(item.id, 'pay')) return;
    try {
      await payInstallment(item.id);
      addToast({
        type: 'success',
        message: `Đã đánh dấu đã trả khoản "${item.name}" (${formatCurrency(item.amount)}).`,
        duration: 4000
      });
    } catch (err) {
      addToast({
        type: 'error',
        message: getUserErrorMessage(err, 'error.save'),
        duration: 4000
      });
    } finally {
      finishAction(item.id);
    }
  };

  const handleToggle = async (item) => {
    setOpenActionMenuId(null);
    if (isInstallmentEnded(item)) return;
    if (!beginAction(item.id, 'toggle')) return;
    try {
      await toggleInstallment(item.id);
      const isNowActive = item.active === false;
      addToast({
        type: 'info',
        message: isNowActive
          ? `Đã kích hoạt lại khoản "${item.name}".`
          : `Đã tạm dừng theo dõi khoản "${item.name}".`,
        duration: 3500
      });
    } catch (err) {
      addToast({
        type: 'error',
        message: getUserErrorMessage(err, 'error.save'),
        duration: 4000
      });
    } finally {
      finishAction(item.id);
    }
  };

  const handleDelete = (item) => {
    setOpenActionMenuId(null);
    confirm({
      returnFocusRef: menuTriggerRef,
      title: 'Xóa khoản định kỳ',
      message: `Bạn có chắc chắn muốn xóa khoản định kỳ "${item.name}" (${formatCurrency(item.amount)}) khỏi hệ thống?`,
      confirmText: 'Xóa khoản',
      cancelText: 'Hủy',
      confirmVariant: 'danger',
      onConfirm: async () => {
        if (!beginAction(item.id, 'delete')) return;
        try {
          await deleteInstallment(item.id);
          addToast({ type: 'success', message: `Đã xóa khoản định kỳ "${item.name}".`, duration: 4000 });
        } finally {
          finishAction(item.id);
        }
      },
    });
  };

  // Switch wallet directly from custom inline selector
  const handleAssignWallet = async (item, newWalletId) => {
    setOpenWalletSelectorId(null);
    if (String(item.walletId) === String(newWalletId) || !beginAction(item.id, 'wallet')) return;
    try {
      await updateInstallment(item.id, { walletId: newWalletId });
      addToast({
        type: 'success',
        message: `Đã cập nhật ví trừ tiền cho "${item.name}".`,
        duration: 3000
      });
    } catch (err) {
      addToast({
        type: 'error',
        message: getUserErrorMessage(err, 'error.save'),
        duration: 3000
      });
    } finally {
      finishAction(item.id);
    }
  };

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Sắp đến hạn gần nhất';

  return (
    <div className="recurring-view-v2-container" role="region" aria-label="Khoản chi định kỳ và trả góp">
      <div className="recurring-page-header">
        <PageTitleIcon name="recurring" />
        <h1 className="recurring-route-heading">{t('nav.recurring')}</h1>
      </div>
      {/* ── 1. Top Header Full-Width Card (Chuẩn 100% Ảnh 1) ── */}
      <RecurringHeaderCard activeItems={activeItems} counts={counts} handleOpenCreate={handleOpenCreate} installments={installments} monthlyEstimatedCost={monthlyEstimatedCost} />

      {/* ── 2. Filter Pills & Custom Themed Sort Dropdown ── */}
      <RecurringFilterBar counts={counts} currentSortLabel={currentSortLabel} filterTab={filterTab} isSortDropdownOpen={isSortDropdownOpen} setFilterTab={setFilterTab} setIsSortDropdownOpen={setIsSortDropdownOpen} setSortBy={setSortBy} sortBy={sortBy} sortRef={sortRef} />

      {/* ── 3. Loading State ── */}
      {isLoading && installments.length === 0 && (
        <div className="wallets-loading">
          <span className="spinner spinner--box" />
          <p>Đang tải danh sách khoản định kỳ...</p>
        </div>
      )}

      {/* ── 4. Empty State ── */}
      {!isLoading && installments.length === 0 && (
        <EmptyState
          icon={
            <Icon name="calendarDown" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          }
          title="Chưa có khoản định kỳ nào"
          description="Thêm khoản chi đều đặn như tiền nhà hoặc dịch vụ thuê bao để theo dõi hạn thanh toán."
          actionLabel="Thêm khoản đầu tiên"
          onAction={handleOpenCreate}
        />
      )}

      {/* ── 5. List of Recurring Cards ── */}
      {<RecurringList currentMonthStr={currentMonthStr} displayItems={displayItems} handleAssignWallet={handleAssignWallet} handleDelete={handleDelete} handleOpenEdit={handleOpenEdit} handlePay={handlePay} handleToggle={handleToggle} isLoading={isLoading} menuRef={menuRef} menuTriggerRef={menuTriggerRef} openActionMenuId={openActionMenuId} openWalletSelectorId={openWalletSelectorId} pendingActions={pendingActions} setOpenActionMenuId={setOpenActionMenuId} setOpenWalletSelectorId={setOpenWalletSelectorId} walletRef={walletRef} wallets={wallets} />}

      {/* ── 6. Bottom Summary Box: Tổng quan khoản định kỳ (Không có nút Lịch) ── */}
      <RecurringSummaryBox monthDisplayLabel={monthDisplayLabel} monthlyBreakdown={monthlyBreakdown} monthlyEstimatedCost={monthlyEstimatedCost} />

      {/* ── Modal Add / Edit Recurring Item ── */}
      {isModalOpen && (
        <RecurringModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setItemToEdit(null);
          }}
          installmentToEdit={itemToEdit}
        />
      )}
    </div>
  );
}
