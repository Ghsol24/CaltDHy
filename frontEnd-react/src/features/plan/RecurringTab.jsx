import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { RecurringModal } from './RecurringModal';
import { formatCurrency, getDueStatus, formatDate, parseDate, getLocalMonthString } from '../../utils/formatters';
import { detectBrandInfo } from '../../utils/brandDetection';
import { BrandLogoIcon } from '../../utils/brandIcons';
import { EmptyState } from '../../components/ui/EmptyState';

const CYCLE_SUFFIXES = {
  monthly: '/ tháng',
  quarterly: '/ quý',
  yearly: '/ năm'
};

const CATEGORY_TAG_LABELS = {
  Entertainment: 'Giải trí',
  'Food & Dining': 'Ăn uống',
  'Housing & Bills': 'Nhà & Hóa đơn',
  Shopping: 'Mua sắm',
  Transportation: 'Đi lại',
  'Health & Beauty': 'Sức khỏe',
  Education: 'Học tập',
  Travel: 'Du lịch',
  'Other Expense': 'Chi phí khác'
};

const SORT_OPTIONS = [
  { value: 'due-asc', label: 'Sắp đến hạn gần nhất' },
  { value: 'amount-desc', label: 'Số tiền cao nhất' },
  { value: 'name-asc', label: 'Tên A → Z' }
];

export function RecurringTab() {
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

  // Wallet inline selector popover state
  const [openWalletSelectorId, setOpenWalletSelectorId] = useState(null);
  const walletRef = useRef(null);

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
    return (installments || []).filter((item) => item.active !== false);
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
      const due = getDueStatus(item.nextDueDate);
      if (due.diffDays !== null) {
        if (due.isOverdue) overdue++;
        else if (due.isToday) today++;
        else if (due.diffDays >= 1 && due.diffDays <= 7) soon++;
      }
    });

    return {
      all: installments.length,
      soon,
      today,
      overdue
    };
  }, [installments, activeItems]);

  // Filtered and Sorted list
  const displayItems = useMemo(() => {
    let list = [...installments];

    // Filter
    if (filterTab === 'soon') {
      list = list.filter((item) => {
        const due = getDueStatus(item.nextDueDate);
        return due.diffDays !== null && due.diffDays >= 1 && due.diffDays <= 7;
      });
    } else if (filterTab === 'today') {
      list = list.filter((item) => {
        const due = getDueStatus(item.nextDueDate);
        return due.isToday;
      });
    } else if (filterTab === 'overdue') {
      list = list.filter((item) => {
        const due = getDueStatus(item.nextDueDate);
        return due.isOverdue;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'due-asc') {
        const dueA = getDueStatus(a.nextDueDate).diffDays ?? 9999;
        const dueB = getDueStatus(b.nextDueDate).diffDays ?? 9999;
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
  }, [installments, filterTab, sortBy]);

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

      // Nếu khoản này đến hạn hôm nay, sắp đến hạn trong 7 ngày hoặc đã quá hạn -> tính vào Sắp thanh toán
      if (due.isOverdue || due.isToday || (due.diffDays !== null && due.diffDays >= 1 && due.diffDays <= 7)) {
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
        message: err.message || 'Không thể ghi nhận thanh toán.',
        duration: 4000
      });
    }
  };

  const handleToggle = async (item) => {
    setOpenActionMenuId(null);
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
        message: err.message || 'Không thể đổi trạng thái.',
        duration: 4000
      });
    }
  };

  const handleDelete = async (item) => {
    setOpenActionMenuId(null);
    const confirmed = await confirm({
      title: 'Xóa khoản định kỳ',
      message: `Bạn có chắc chắn muốn xóa khoản định kỳ "${item.name}" (${formatCurrency(item.amount)}) khỏi hệ thống?`,
      confirmText: 'Xóa khoản',
      cancelText: 'Hủy',
      confirmVariant: 'danger'
    });

    if (confirmed) {
      try {
        await deleteInstallment(item.id);
        addToast({
          type: 'success',
          message: `Đã xóa khoản định kỳ "${item.name}".`,
          duration: 4000
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: err.message || 'Không thể xóa khoản định kỳ.',
          duration: 4000
        });
      }
    }
  };

  // Switch wallet directly from custom inline selector
  const handleAssignWallet = async (item, newWalletId) => {
    setOpenWalletSelectorId(null);
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
        message: err.message || 'Không thể cập nhật ví.',
        duration: 3000
      });
    }
  };

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Sắp đến hạn gần nhất';

  return (
    <div className="recurring-view-v2-container" role="region" aria-label="Khoản chi định kỳ và trả góp">
      {/* ── 1. Top Header Full-Width Card (Chuẩn 100% Ảnh 1) ── */}
      <div className="recurring-top-bar-card">
        <div className="recurring-bar-stats-group">
          <div className="banner-stat-block">
            <span className="banner-stat-label">Chi phí ước tính / tháng</span>
            <strong className="banner-stat-val text-brand">
              ~{formatCurrency(Math.round(monthlyEstimatedCost))}
            </strong>
          </div>

          <div className="banner-stat-divider" aria-hidden="true" />

          <div className="banner-stat-block">
            <span className="banner-stat-label">Khoản đang theo dõi</span>
            <strong className="banner-stat-val">
              {activeItems.length} / {installments.length} khoản
            </strong>
          </div>

          <div className="banner-stat-divider" aria-hidden="true" />

          <div className="banner-stat-block">
            <span className="banner-stat-label">Sắp đến hạn (7 ngày)</span>
            <strong className="banner-stat-val" style={{ color: '#EF4444' }}>
              {counts.soon} khoản
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="recurring-btn-create-primary"
          onClick={handleOpenCreate}
          aria-label="Thêm khoản định kỳ mới"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Thêm khoản định kỳ</span>
        </button>
      </div>

      {/* ── 2. Filter Pills & Custom Themed Sort Dropdown ── */}
      <div className="recurring-controls-bar">
        <div className="recurring-filter-pills" role="tablist" aria-label="Lọc khoản định kỳ">
          <button
            type="button"
            className={`filter-pill-btn ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
            role="tab"
            aria-selected={filterTab === 'all'}
          >
            <span>Tất cả</span>
            <span className="pill-count-tag">{counts.all}</span>
          </button>

          <button
            type="button"
            className={`filter-pill-btn ${filterTab === 'soon' ? 'active' : ''}`}
            onClick={() => setFilterTab('soon')}
            role="tab"
            aria-selected={filterTab === 'soon'}
          >
            <span>Sắp đến hạn</span>
            <span className="pill-count-tag">{counts.soon}</span>
          </button>

          <button
            type="button"
            className={`filter-pill-btn ${filterTab === 'today' ? 'active' : ''}`}
            onClick={() => setFilterTab('today')}
            role="tab"
            aria-selected={filterTab === 'today'}
          >
            <span>Hôm nay</span>
            <span className="pill-count-tag">{counts.today}</span>
          </button>

          <button
            type="button"
            className={`filter-pill-btn ${filterTab === 'overdue' ? 'active' : ''}`}
            onClick={() => setFilterTab('overdue')}
            role="tab"
            aria-selected={filterTab === 'overdue'}
          >
            <span>Quá hạn</span>
            <span className="pill-count-tag">{counts.overdue}</span>
          </button>
        </div>

        {/* Custom Themed Sort Dropdown */}
        <div className="recurring-sort-custom-wrap" ref={sortRef}>
          <button
            type="button"
            className={`recurring-sort-custom-btn ${isSortDropdownOpen ? 'is-active' : ''}`}
            onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
            aria-expanded={isSortDropdownOpen}
            aria-haspopup="listbox"
          >
            <span>{currentSortLabel}</span>
            <svg
              className={`sort-chevron-icon ${isSortDropdownOpen ? 'is-open' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isSortDropdownOpen && (
            <div className="recurring-sort-custom-menu" role="listbox">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`sort-custom-item ${sortBy === opt.value ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSortBy(opt.value);
                    setIsSortDropdownOpen(false);
                  }}
                  role="option"
                  aria-selected={sortBy === opt.value}
                >
                  {sortBy === opt.value && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Loading State ── */}
      {isLoading && installments.length === 0 && (
        <div className="wallets-loading">
          <span className="spinner" style={{ width: 24, height: 24, marginBottom: 8 }} />
          <p>Đang tải danh sách khoản định kỳ...</p>
        </div>
      )}

      {/* ── 4. Empty State ── */}
      {!isLoading && installments.length === 0 && (
        <EmptyState
          icon={
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <polyline points="9 16 12 19 15 16" />
            </svg>
          }
          title="Chưa có khoản định kỳ nào"
          description="Thiết lập các khoản thanh toán cố định (Netflix, Spotify, tiền nhà, Internet, trả góp...) để hệ thống tự động nhắc nhở và quản lý dòng tiền."
          actionLabel="Thêm khoản đầu tiên"
          onAction={handleOpenCreate}
        />
      )}

      {/* ── 5. List of Recurring Cards ── */}
      {!isLoading && displayItems.length > 0 && (
        <div className="recurring-rows-list">
          {displayItems.map((item) => {
            const isActive = item.active !== false;
            const dueStatus = getDueStatus(item.nextDueDate);
            const cycleSuffix = CYCLE_SUFFIXES[item.cycle] || '/ tháng';
            const brandInfo = detectBrandInfo(item.name);
            const brandKey = item.brandKey || brandInfo.brandKey;

            // Formatted due date
            const parsedDueDate = item.nextDueDate ? parseDate(item.nextDueDate) : null;
            const formattedDueDate = parsedDueDate ? formatDate(parsedDueDate, 'day-date') : item.nextDueDate || 'Chưa định ngày';
            const dayOfMonth = parsedDueDate ? String(parsedDueDate.getDate()).padStart(2, '0') : '01';

            // Assigned wallet
            const assignedWallet = wallets.find((w) => w.id === item.walletId) || wallets[0];
            const categoryLabel = CATEGORY_TAG_LABELS[item.category] || item.category || brandInfo.categoryDefault;

            const isPaidThisMonth = Array.isArray(item.history) && item.history.some(
              (h) => h && typeof h.paidDate === 'string' && h.paidDate.startsWith(currentMonthStr)
            );

            const isMenuOpen = openActionMenuId === item.id;
            const isWalletMenuOpen = openWalletSelectorId === item.id;

            return (
              <div
                key={item.id}
                className={`recurring-row-card ${!isActive ? 'is-paused' : ''}`}
              >
                {/* 1. Brand Logo Tile */}
                <div className="recurring-row-logo-col">
                  <BrandLogoIcon brandKey={brandKey} size={48} />
                </div>

                {/* 2. Title & Meta Info */}
                <div className="recurring-row-main-col">
                  <div className="recurring-title-row">
                    <h4 className="recurring-main-name" title={item.name}>
                      {item.name}
                    </h4>
                    <span className="recurring-category-badge">
                      {categoryLabel}
                    </span>
                  </div>

                  <div className="recurring-meta-row">
                    <span className="recurring-meta-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect width="18" height="18" x="3" y="4" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>Ngày thanh toán: <strong>{dayOfMonth} hàng tháng</strong></span>
                    </span>

                    {(item.note || item.desc || brandInfo.noteDefault) && (
                      <span className="recurring-meta-item recurring-meta-note">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                          <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        <span>{item.note || item.desc || brandInfo.noteDefault}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Ví trừ tiền (Custom Themed Dropdown Popover) */}
                <div className="recurring-row-wallet-col">
                  <span className="row-col-label">Ví trừ tiền</span>
                  <div className="recurring-wallet-custom-wrapper" ref={isWalletMenuOpen ? walletRef : null}>
                    <button
                      type="button"
                      className="recurring-wallet-chip-btn"
                      onClick={() => setOpenWalletSelectorId(isWalletMenuOpen ? null : item.id)}
                      aria-expanded={isWalletMenuOpen}
                    >
                      <span className="wallet-chip-icon" aria-hidden="true">{assignedWallet?.icon || '💳'}</span>
                      <span className="wallet-chip-name">{assignedWallet?.name || 'Chọn ví'}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isWalletMenuOpen && (
                      <div className="recurring-wallet-popover-menu" role="menu">
                        <div className="wallet-popover-header">Chọn ví trừ tiền</div>
                        {wallets.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            className={`wallet-popover-item ${w.id === assignedWallet?.id ? 'is-active' : ''}`}
                            onClick={() => handleAssignWallet(item, w.id)}
                          >
                            <span className="wallet-popover-icon">{w.icon || '💳'}</span>
                            <div className="wallet-popover-info">
                              <span className="wallet-popover-name">{w.name}</span>
                              <span className="wallet-popover-bal">{formatCurrency(w.currentBalance ?? 0)}</span>
                            </div>
                            {w.id === assignedWallet?.id && (
                              <svg className="wallet-check-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Due Status Countdown Pill */}
                <div className="recurring-row-due-col">
                  <div className={`recurring-due-pill-box ${
                    isPaidThisMonth
                      ? 'due-paid'
                      : dueStatus.isOverdue
                      ? 'due-danger'
                      : dueStatus.isToday
                      ? 'due-warning'
                      : dueStatus.isSoon
                      ? 'due-soon'
                      : 'due-normal'
                  }`}>
                    {isPaidThisMonth ? (
                      <>
                        <div className="due-pill-top">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <strong>Đã trả tháng này</strong>
                        </div>
                        <span className="due-pill-sub">
                          Kỳ tới: {formattedDueDate}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="due-pill-top">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <strong>{dueStatus.text}</strong>
                        </div>
                        <span className="due-pill-sub">
                          Đến hạn vào {formattedDueDate}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 5. Amount */}
                <div className="recurring-row-amount-col">
                  <span className="row-col-label">Số tiền</span>
                  <strong className="recurring-row-price">
                    {formatCurrency(item.amount)} <span className="price-cycle">{cycleSuffix}</span>
                  </strong>
                </div>

                {/* 6. Actions: 3-dots Menu ONLY with Pure Outline SVG Icons */}
                <div className="recurring-row-actions-col">
                  <div className="recurring-menu-wrapper" ref={isMenuOpen ? menuRef : null}>
                    <button
                      type="button"
                      className="recurring-dots-action-btn"
                      onClick={() => setOpenActionMenuId(isMenuOpen ? null : item.id)}
                      aria-expanded={isMenuOpen}
                      aria-haspopup="true"
                      aria-label={`Tùy chọn cho khoản ${item.name}`}
                      title="Tùy chọn"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    {isMenuOpen && (
                      <div className="recurring-actions-dropdown" role="menu">
                        <button
                          type="button"
                          className="actions-dropdown-item"
                          role="menuitem"
                          onClick={() => handlePay(item)}
                        >
                          <svg className="menu-action-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{isPaidThisMonth ? 'Đánh dấu đã trả kỳ tới' : 'Đánh dấu đã trả kỳ này'}</span>
                        </button>
                        <button
                          type="button"
                          className="actions-dropdown-item"
                          role="menuitem"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <svg className="menu-action-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                          <span>Chỉnh sửa khoản định kỳ</span>
                        </button>
                        <button
                          type="button"
                          className="actions-dropdown-item"
                          role="menuitem"
                          onClick={() => handleToggle(item)}
                        >
                          <svg className="menu-action-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {isActive ? (
                              <>
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                              </>
                            ) : (
                              <polygon points="5 3 19 12 5 21 5 3" />
                            )}
                          </svg>
                          <span>{isActive ? 'Tạm dừng theo dõi' : 'Tiếp tục theo dõi'}</span>
                        </button>
                        <div className="dropdown-menu-divider" aria-hidden="true" />
                        <button
                          type="button"
                          className="actions-dropdown-item text-danger"
                          role="menuitem"
                          onClick={() => handleDelete(item)}
                        >
                          <svg className="menu-action-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          <span>Xóa khoản định kỳ</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 6. Bottom Summary Box: Tổng quan khoản định kỳ (Không có nút Lịch) ── */}
      <div className="recurring-summary-bottom-card">
        <div className="summary-bottom-header-row">
          <div className="summary-bottom-title-lead">
            <div className="summary-bottom-icon-box" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="summary-bottom-titles">
              <h3 className="summary-bottom-title">Tổng quan khoản định kỳ</h3>
              <span className="summary-bottom-subtitle">
                Thống kê chi tiết trong {monthDisplayLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="summary-bottom-grid">
          {/* Cell 1: Đã thanh toán */}
          <div className="summary-grid-cell">
            <span className="grid-cell-label">Đã thanh toán</span>
            <strong className="grid-cell-num text-brand">
              {formatCurrency(monthlyBreakdown.paidAmount)}
            </strong>
            <span className="grid-cell-sub">{monthlyBreakdown.paidCount} khoản</span>
          </div>

          <div className="summary-grid-divider" aria-hidden="true" />

          {/* Cell 2: Sắp thanh toán */}
          <div className="summary-grid-cell">
            <span className="grid-cell-label">Sắp thanh toán</span>
            <strong className="grid-cell-num text-warning">
              {formatCurrency(monthlyBreakdown.upcomingSoonAmount)}
            </strong>
            <span className="grid-cell-sub">{monthlyBreakdown.upcomingSoonCount} khoản</span>
          </div>

          <div className="summary-grid-divider" aria-hidden="true" />

          {/* Cell 3: Còn lại trong tháng */}
          <div className="summary-grid-cell">
            <span className="grid-cell-label">Còn lại trong tháng</span>
            <strong className="grid-cell-num text-blue">
              {formatCurrency(monthlyBreakdown.remainingAmount)}
            </strong>
            <span className="grid-cell-sub">{monthlyBreakdown.remainingCount} khoản</span>
          </div>

          <div className="summary-grid-divider" aria-hidden="true" />

          {/* Cell 4: Trung bình / tháng */}
          <div className="summary-grid-cell">
            <span className="grid-cell-label">Trung bình / tháng</span>
            <strong className="grid-cell-num text-purple">
              {formatCurrency(Math.round(monthlyEstimatedCost))}
            </strong>
            <span className="grid-cell-sub">~ chi phí định kỳ</span>
          </div>
        </div>
      </div>

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
