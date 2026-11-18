import { getUserErrorMessage } from '../../utils/userErrors.js';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { JarModal } from './JarModal';
import { JarTransactionModal } from './JarTransactionModal';
import { JarDetailModal } from './JarDetailModal';
import { JarHistoryPage } from './JarHistoryPage';
import { formatCurrency, formatMonthYear, getLocalDateString } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';
import { EmptyState } from '../../components/ui/EmptyState';
import { JarActivityCalendar } from './JarActivityCalendar';
import { JarRecentActivity } from './JarRecentActivity';
import { JarNextStepStrip } from './JarNextStepStrip';
import { monthOf } from './jarActivity';
import { Icon, AlertTriangleOutlineIcon, JarOutlineIcon } from '../../components/ui/AppIcons';
import './jars.css';

import { Button } from '../../components/ui/Button';
import { JarsListView } from './jars/JarsListView';
import { JarsGridView } from './jars/JarsGridView';
import { JarsListToolbar } from './jars/JarsListToolbar';
import { JarsProgressSection } from './jars/JarsProgressSection';
import { JarsOverviewSection } from './jars/JarsOverviewSection';
import { JarsPageHeader } from './jars/JarsPageHeader';
import { useJarsOverview } from './jars/useJarsOverview';
import { JARS_PER_PAGE } from './jars/useJarsOverview';
const PROGRESS_OVERVIEW_MIN_JARS = 4;

// Display preference only. The hyphenated name keeps it out of the sign-in
// cleanup that clears private `caltdhy_*` data, without growing the first-load bundle.
const CALENDAR_VIEW_KEY = 'caltdhy-jar-calendar-view';
const readCalendarView = () => {
  try { return localStorage.getItem(CALENDAR_VIEW_KEY) === 'year' ? 'year' : 'month'; } catch { return 'month'; }
};

export function JarsView() {
  const { lang, intlLocale, t } = useTranslation();
  const jars = useJarStore((s) => s.jars);
  const isLoading = useJarStore((s) => s.isLoading);
  const hasLoaded = useJarStore((s) => s.hasLoaded);
  const error = useJarStore((s) => s.error);
  const fetchData = useJarStore((s) => s.fetchData);
  const deleteJar = useJarStore((s) => s.deleteJar);
  const confirm = useConfirmStore((s) => s.confirm);
  const addToast = useToastStore((s) => s.addToast);
  const jarsSubTab = useSpendingStore((s) => s.jarsSubTab);
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const isMobile = useIsMobile();

  // Modals state
  const [isJarModalOpen, setIsJarModalOpen] = useState(false);
  const [editingJar, setEditingJar] = useState(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [activeJar, setActiveJar] = useState(null);
  const [txAction, setTxAction] = useState('deposit'); // 'deposit' | 'withdraw'
  const [txInitialAmount, setTxInitialAmount] = useState(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailJar, setSelectedDetailJar] = useState(null);

  // Toolbar & view settings
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'progress_desc' | 'deadline_asc' | 'name_asc'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuJarId, setActiveMenuJarId] = useState(null);
  // Nút ⋮ đã mở menu thẻ hũ: nhận lại focus khi đóng hộp thoại xác nhận xoá.
  const menuTriggerRef = useRef(null);
  const [deletingJarId, setDeletingJarId] = useState(null);
  const [recomIndex, setRecomIndex] = useState(0);

  // Savings calendar (replaces the old line chart): month/year view and the day
  // picked on it, which also filters the recent-activity list.
  const today = getLocalDateString();
  const [calendarMonth, setCalendarMonth] = useState(() => monthOf(getLocalDateString()));
  const [calendarView, setCalendarView] = useState(readCalendarView);
  const [selectedDay, setSelectedDay] = useState(null);
  const changeCalendarView = (view) => {
    setCalendarView(view);
    try { localStorage.setItem(CALENDAR_VIEW_KEY, view); } catch { /* preference only */ }
  };
  const changeCalendarMonth = (month) => {
    setCalendarMonth(month);
    setSelectedDay((day) => (day && monthOf(day) === month ? day : null));
  };

  const availableMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ value: val, label: formatMonthYear(d, { intlLocale }) });
    }
    return months;
  }, [intlLocale]);

  // Close card menu on outside click
  useEffect(() => {
    const handleWindowClick = () => setActiveMenuJarId(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  // ── 1. Aggregate Financial Metrics ──
  const { currentSuggestion, datedJarsCount, jarDays, jarEvents, jarStatuses, pageCount, progressOverview, smartSuggestions, splitSuggestion, suggestionCopy, suggestionPercent, thisMonthNet, totalCurrent, totalPercent, totalRemaining, totalTarget, visibleJars } = useJarsOverview({ currentPage, jars, lang, recomIndex, sortBy, today });

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const changePage = (page) => {
    setCurrentPage(Math.min(pageCount, Math.max(1, page)));
    requestAnimationFrame(() => document.getElementById('jars-section-list')?.scrollIntoView({ behavior: 'auto', block: 'start' }));
  };


  // Handlers
  const handleCreateNew = () => {
    setEditingJar(null);
    setIsJarModalOpen(true);
  };

  const handleEdit = (jar) => {
    setEditingJar(jar);
    setIsJarModalOpen(true);
  };

  const handleDeposit = (jar, initialAmount = null) => {
    setActiveJar(jar);
    setTxAction('deposit');
    setTxInitialAmount(typeof initialAmount === 'number' && Number.isFinite(initialAmount) && initialAmount > 0 ? initialAmount : null);
    setIsTxModalOpen(true);
  };

  const handleWithdraw = (jar) => {
    setActiveJar(jar);
    setTxAction('withdraw');
    setTxInitialAmount(null);
    setIsTxModalOpen(true);
  };

  const handleOpenDetail = (jar) => {
    setSelectedDetailJar(jar);
    setIsDetailModalOpen(true);
  };

  const handleDelete = async (jar) => {
    const jarBalance = Number(jar.current || 0);
    const message =
      jarBalance > 0
        ? `Hũ "${jar.name}" hiện đang có ${formatCurrency(jarBalance)}. Nếu xóa hũ, khoản tiền này sẽ không còn được theo dõi trong danh sách hũ tiết kiệm. Bạn có chắc chắn muốn xóa không?`
        : `Bạn có chắc chắn muốn xóa hũ tiết kiệm "${jar.name}" không?`;

    confirm({
      returnFocusRef: menuTriggerRef,
      title: 'Xóa hũ tiết kiệm',
      message,
      confirmText: 'Xóa hũ',
      cancelText: 'Hủy',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setDeletingJarId(jar.id);
        try {
          await deleteJar(jar.id);
          addToast({ type: 'success', message: `Đã xóa hũ "${jar.name}".`, duration: 4000 });
        } finally {
          setDeletingJarId(null);
        }
      },
    });
  };

  if (!hasLoaded || (isLoading && jars.length === 0)) {
    return (
      <div className="jars-page-root" role="region" aria-label="Quản lý hũ tiết kiệm">
        <div className="feature-loading" role="status" aria-live="polite">Đang tải dữ liệu hũ…</div>
      </div>
    );
  }

  if (error && jars.length === 0) {
    return (
      <div className="jars-page-root" role="region" aria-label="Quản lý hũ tiết kiệm">
        <EmptyState
          icon={<AlertTriangleOutlineIcon size={32} />}
          title="Chưa thể tải dữ liệu hũ"
          description={getUserErrorMessage(error, 'error.load')}
          actionLabel="Thử lại"
          onAction={fetchData}
          className="jars-first-run-state"
        />
      </div>
    );
  }

  if (jars.length === 0) {
    const emptySectionId = jarsSubTab === 'jars'
      ? 'jars-section-list'
      : jarsSubTab === 'history'
        ? 'jars-section-history'
        : 'jars-section-goals';
    // Tiêu đề trống cũng đúng tên mục menu đang sáng.
    const emptyHeading = t(jarsSubTab === 'jars' ? 'nav.jarList' : jarsSubTab === 'history' ? 'nav.history' : 'nav.goals');
    return (
      <div className="jars-page-root" role="region" aria-label="Quản lý hũ tiết kiệm">
        <section id={emptySectionId} className="jars-hero-overview-card jars-first-run-card">
          <div className="jars-hero-top-row">
            <div className="jars-hero-titles">
              <h1 className="jars-hero-heading">{emptyHeading}</h1>
            </div>
          </div>
          <EmptyState
            icon={<JarOutlineIcon size={36} />}
            title="Bạn chưa có hũ tiết kiệm"
            description="Tạo hũ đầu tiên và nhập số tiền mục tiêu để theo dõi tiến độ."
            actionLabel="Tạo hũ đầu tiên"
            onAction={handleCreateNew}
            className="jars-first-run-state"
          />
        </section>
        {isJarModalOpen && (
          <JarModal
            isOpen={isJarModalOpen}
            onClose={() => setIsJarModalOpen(false)}
            jarToEdit={editingJar}
          returnFocusRef={menuTriggerRef}
          />
        )}
      </div>
    );
  }

  return (
    <div className="jars-page-root" role="region" aria-label="Quản lý hũ tiết kiệm">
      {/* ── ERROR STATE BANNER ── */}
      {error && (
        <div className="jars-load-error" role="alert">
          <span>{getUserErrorMessage(error, 'error.load')}</span>
          <Button variant="danger" size="sm" onClick={fetchData}>Thử lại</Button>
        </div>
      )}

      {/* Mỗi mục menu là một màn hình riêng, trên điện thoại lẫn máy tính (NAV-05, JLS-01):
          URL, tiêu đề tab, mục menu sáng và nội dung luôn cùng một mục. */}
      {jarsSubTab === 'goals' && (
        <>
      {/* ── SECTION 1: HEADER & OVERVIEW (#jars-section-goals) ── */}
      <JarsOverviewSection datedJarsCount={datedJarsCount} handleCreateNew={handleCreateNew} jarsCount={jars.length} thisMonthNet={thisMonthNet} totalCurrent={totalCurrent} totalPercent={totalPercent} totalRemaining={totalRemaining} totalTarget={totalTarget} />

      {/* ── SECTIONS 2 & 3: LỊCH TIẾT KIỆM + HOẠT ĐỘNG GẦN ĐÂY, rồi MỐC KẾ TIẾP ── */}
      <section className="jars-insights-grid jars-insights-grid--calendar">
        <JarActivityCalendar
          days={jarDays}
          month={calendarMonth}
          monthOptions={availableMonths}
          onMonthChange={changeCalendarMonth}
          view={calendarView}
          onViewChange={changeCalendarView}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          today={today}
        />
        {/* Bản xem nhanh; lịch sử đầy đủ là trang "Lịch sử nạp/rút". */}
        <JarRecentActivity
          events={jarEvents}
          selectedDay={selectedDay}
          onClearDay={() => setSelectedDay(null)}
          onViewAll={() => navigateTo('jars', 'history')}
          limit={isMobile ? 3 : 6}
          compact={isMobile}
        />
      </section>

      <JarNextStepStrip
        suggestion={currentSuggestion}
        copy={suggestionCopy}
        percent={suggestionPercent}
        splitText={currentSuggestion.kind === 'milestone' ? splitSuggestion : ''}
        canSwitch={smartSuggestions.length > 1}
        onSwitch={() => setRecomIndex((index) => index + 1)}
        onDeposit={handleDeposit}
        onEditTarget={handleEdit}
        onCreate={handleCreateNew}
      />

      {/* ── SECTION 4: TỔNG QUAN TIẾN ĐỘ (#jars-section-progress) ──
          Chỉ hiện khi có từ 4 hũ: ít hơn thì nó nhắc lại đúng các hũ ngay bên dưới. */}
      {jars.length >= PROGRESS_OVERVIEW_MIN_JARS && (
        <JarsProgressSection handleDeposit={handleDeposit} navigateTo={navigateTo} progressOverview={progressOverview} />
      )}
        </>
      )}

      {/* ── SECTION 5: CÁC HŨ CỦA BẠN (#jars-section-list) ── */}
      {jarsSubTab === 'jars' && (
      <>
      <section id="jars-section-list" className="jars-list-section">
        {/* Điện thoại giữ màn hình như cũ: dải mục ở trên đã nói tên trang, thẻ "Tạo hũ mới" nằm trong lưới. */}
        {!isMobile && <JarsPageHeader icon="jarList" title={t('nav.jarList')} onCreate={handleCreateNew} />}

        {/* Toolbar Header */}
        <JarsListToolbar jars={jars} setCurrentPage={setCurrentPage} setSortBy={setSortBy} setViewMode={setViewMode} sortBy={sortBy} viewMode={viewMode} />

        {/* LOADING STATE */}
        {isLoading && jars.length === 0 && (
          <div className="jars-list-section__div--box">
            <span className="spinner spinner--box" />
            <p className="jars-list-section__p--box">Đang tải danh sách hũ tiết kiệm...</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && jars.length === 0 && (
          <EmptyState
            icon={
              <Icon name="packageBox" width="48" height="48" fill="none" stroke="#5356F1" strokeWidth="1.5" />
            }
            title="Chưa có hũ tiết kiệm nào"
            description="Tạo hũ đầu tiên và nhập số tiền mục tiêu để theo dõi tiến độ."
            actionLabel="+ Tạo hũ tiết kiệm đầu tiên"
            onAction={handleCreateNew}
          />
        )}

        {/* LOADED STATE: GRID VIEW */}
        {<JarsGridView activeMenuJarId={activeMenuJarId} deletingJarId={deletingJarId} handleCreateNew={handleCreateNew} handleDelete={handleDelete} handleDeposit={handleDeposit} handleEdit={handleEdit} handleOpenDetail={handleOpenDetail} handleWithdraw={handleWithdraw} isLoading={isLoading} jarStatuses={jarStatuses} jars={jars} menuTriggerRef={menuTriggerRef} setActiveMenuJarId={setActiveMenuJarId} viewMode={viewMode} visibleJars={visibleJars} />}

        {/* LOADED STATE: LIST VIEW */}
        {<JarsListView handleCreateNew={handleCreateNew} handleDeposit={handleDeposit} handleEdit={handleEdit} handleOpenDetail={handleOpenDetail} handleWithdraw={handleWithdraw} isLoading={isLoading} jars={jars} viewMode={viewMode} visibleJars={visibleJars} />}

        {!isLoading && pageCount > 1 && (
          <nav className="jars-pagination" aria-label="Phân trang danh sách hũ">
            <span className="jars-pagination__summary">
              {Math.min((currentPage - 1) * JARS_PER_PAGE + 1, jars.length)}–{Math.min(currentPage * JARS_PER_PAGE, jars.length)} / {jars.length} hũ
            </span>
            <div className="jars-pagination__controls">
              <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} aria-label="Trang hũ trước">‹</button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                <button key={page} type="button" className={page === currentPage ? 'is-active' : ''} onClick={() => changePage(page)} aria-current={page === currentPage ? 'page' : undefined} aria-label={`Trang hũ ${page}`}>
                  {page}
                </button>
              ))}
              <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Trang hũ sau">›</button>
            </div>
          </nav>
        )}
      </section>
      </>
      )}

      {/* ── SECTION 6: LỊCH SỬ NẠP/RÚT (#jars-section-history): toàn bộ lịch sử, trang thật (JHS-01) ── */}
      {jarsSubTab === 'history' && <JarHistoryPage jars={jars} />}

      {/* ── MODALS ── */}
      {isJarModalOpen && (
        <JarModal
          isOpen={isJarModalOpen}
          onClose={() => setIsJarModalOpen(false)}
          jarToEdit={editingJar}
          returnFocusRef={menuTriggerRef}
        />
      )}

      {isTxModalOpen && activeJar && (
        <JarTransactionModal
          isOpen={isTxModalOpen}
          onClose={() => {
            setIsTxModalOpen(false);
            setActiveJar(null);
            setTxInitialAmount(null);
          }}
          jar={activeJar}
          initialAction={txAction}
          initialAmount={txInitialAmount}
        />
      )}

      {isDetailModalOpen && selectedDetailJar && (
        <JarDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedDetailJar(null);
          }}
          jar={selectedDetailJar}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          onEdit={handleEdit}
        />
      )}

    </div>
  );
}
