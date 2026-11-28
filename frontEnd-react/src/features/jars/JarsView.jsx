import { getUserErrorMessage } from '../../utils/userErrors.js';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useJarStore } from '../../stores/useJarStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useCommandRequest } from '../../hooks/useCommandRequest';
import { JarModal } from './JarModal';
import { JarTransactionModal } from './JarTransactionModal';
import { JarDetailModal } from './JarDetailModal';
import { JarHistoryDrawer } from './JarHistoryDrawer';
import { formatCurrency, formatMonthYear, getLocalDateString } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';
import { EmptyState } from '../../components/ui/EmptyState';
import { JarActivityCalendar } from './JarActivityCalendar';
import { JarRecentActivity } from './JarRecentActivity';
import { JarNextStepStrip } from './JarNextStepStrip';
import { monthOf } from './jarActivity';
import { AlertTriangleOutlineIcon, JarOutlineIcon } from '../../components/ui/AppIcons';
import { Button } from '../../components/ui/Button';
import { JarsListView } from './jars/JarsListView';
import { JarsGridView } from './jars/JarsGridView';
import { JarsListToolbar } from './jars/JarsListToolbar';
import { JarsOverviewSection } from './jars/JarsOverviewSection';
import { JarsPageHeader } from './jars/JarsPageHeader';
import { useJarsOverview, JARS_PER_PAGE } from './jars/useJarsOverview';
import './jars.css';

// Display preference only. The hyphenated name keeps it out of the sign-in
// cleanup that clears private `caltdhy_*` data, without growing the first-load bundle.
const CALENDAR_VIEW_KEY = 'caltdhy-jar-calendar-view';
const readCalendarView = () => {
  try { return localStorage.getItem(CALENDAR_VIEW_KEY) === 'year' ? 'year' : 'month'; } catch { return 'month'; }
};

const MOBILE_TABS_COPY = {
  vi: { jars: 'Các hũ của bạn', activity: 'Nhịp tiết kiệm' },
  en: { jars: 'Your jars', activity: 'Savings activity' },
  'zh-CN': { jars: '我的储蓄罐', activity: '储蓄动态' },
};

export function JarsView() {
  const { lang, intlLocale, t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const jars = useJarStore((s) => s.jars);
  const isLoading = useJarStore((s) => s.isLoading);
  const hasLoaded = useJarStore((s) => s.hasLoaded);
  const error = useJarStore((s) => s.error);
  const fetchData = useJarStore((s) => s.fetchData);
  const deleteJar = useJarStore((s) => s.deleteJar);
  const confirm = useConfirmStore((s) => s.confirm);
  const addToast = useToastStore((s) => s.addToast);
  const isMobile = useIsMobile();

  // Slide-over History Drawer synchronized with `?drawer=history`
  const isHistoryDrawerOpen = searchParams.get('drawer') === 'history';
  const openHistoryDrawer = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('drawer', 'history');
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  const closeHistoryDrawer = useCallback(() => {
    setSearchParams((prev) => {
      if (prev.get('drawer') !== 'history') return prev;
      const next = new URLSearchParams(prev);
      next.delete('drawer');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Mobile inline tab switch: keeps jars immediately above the fold and avoids long mobile scroll
  const [mobileSection, setMobileSection] = useState('jars'); // 'jars' | 'activity'
  const mobileCopy = MOBILE_TABS_COPY[lang] || (String(lang).startsWith('zh') ? MOBILE_TABS_COPY['zh-CN'] : MOBILE_TABS_COPY.vi);

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
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuJarId, setActiveMenuJarId] = useState(null);
  const menuTriggerRef = useRef(null);
  const [deletingJarId, setDeletingJarId] = useState(null);
  const [recomIndex, setRecomIndex] = useState(0);

  // Savings calendar state
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

  useEffect(() => {
    const handleWindowClick = () => setActiveMenuJarId(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const {
    currentSuggestion,
    datedJarsCount,
    jarDays,
    jarEvents,
    jarStatuses,
    pageCount,
    smartSuggestions,
    splitSuggestion,
    suggestionCopy,
    suggestionPercent,
    thisMonthNet,
    totalCurrent,
    totalPercent,
    totalRemaining,
    totalTarget,
    visibleJars,
  } = useJarsOverview({ currentPage, jars, lang, recomIndex, sortBy, today });

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

  useCommandRequest('jar-deposit', ({ jarId }) => {
    const jar = jars.find((item) => item.id === jarId);
    if (jar) handleDeposit(jar);
  }, hasLoaded);

  useCommandRequest('jar-history', () => {
    openHistoryDrawer();
  }, hasLoaded);

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
    return (
      <div className="jars-page-root" role="region" aria-label="Quản lý hũ tiết kiệm">
        <JarsPageHeader icon="jarList" title={t('nav.jars')} />
        <section id="jars-section-goals" className="jars-hero-overview-card jars-first-run-card" aria-label={t('nav.jars')}>
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

  const showListSection = !isMobile || mobileSection === 'jars';
  const showActivitySection = !isMobile || mobileSection === 'activity';

  return (
    <div className="jars-page-root" role="region" aria-label="Quản lý hũ tiết kiệm">
      {error && (
        <div className="jars-load-error" role="alert">
          <span>{getUserErrorMessage(error, 'error.load')}</span>
          <Button variant="danger" size="sm" onClick={fetchData}>Thử lại</Button>
        </div>
      )}

      {/* ── 1. SINGLE UNIFIED PAGE HEADER + SUMMARY CARD ── */}
      <JarsPageHeader
        icon="jarList"
        title={t('nav.jars')}
        onOpenHistory={openHistoryDrawer}
        historyOpen={isHistoryDrawerOpen}
        onCreate={handleCreateNew}
      />

      <JarsOverviewSection
        datedJarsCount={datedJarsCount}
        jarsCount={jars.length}
        thisMonthNet={thisMonthNet}
        totalCurrent={totalCurrent}
        totalPercent={totalPercent}
        totalRemaining={totalRemaining}
        totalTarget={totalTarget}
      />

      {/* Mobile inline view switch: keeps Jars immediately actionable without endless scrolling */}
      {isMobile && (
        <div className="jars-mobile-view-switch" role="tablist" aria-label={t('nav.jars')}>
          <button
            type="button"
            role="tab"
            aria-selected={mobileSection === 'jars'}
            className={`jars-mobile-view-tab${mobileSection === 'jars' ? ' is-active' : ''}`}
            onClick={() => setMobileSection('jars')}
          >
            <span>{mobileCopy.jars}</span>
            <span className="jars-mobile-view-count">{jars.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileSection === 'activity'}
            className={`jars-mobile-view-tab${mobileSection === 'activity' ? ' is-active' : ''}`}
            onClick={() => setMobileSection('activity')}
          >
            <span>{mobileCopy.activity}</span>
          </button>
        </div>
      )}

      {/* ── 2. CÁC HŨ CỦA BẠN (ABOVE THE FOLD — primary daily actions first) ── */}
      {showListSection && (
        <section id="jars-section-list" className="jars-list-section">
          <JarsListToolbar
            jars={jars}
            setCurrentPage={setCurrentPage}
            setSortBy={setSortBy}
            setViewMode={setViewMode}
            sortBy={sortBy}
            viewMode={viewMode}
          />

          <JarsGridView
            activeMenuJarId={activeMenuJarId}
            deletingJarId={deletingJarId}
            handleCreateNew={handleCreateNew}
            handleDelete={handleDelete}
            handleDeposit={handleDeposit}
            handleEdit={handleEdit}
            handleOpenDetail={handleOpenDetail}
            handleWithdraw={handleWithdraw}
            isLoading={isLoading}
            jarStatuses={jarStatuses}
            jars={jars}
            menuTriggerRef={menuTriggerRef}
            setActiveMenuJarId={setActiveMenuJarId}
            viewMode={viewMode}
            visibleJars={visibleJars}
          />

          <JarsListView
            handleCreateNew={handleCreateNew}
            handleDeposit={handleDeposit}
            handleEdit={handleEdit}
            handleOpenDetail={handleOpenDetail}
            handleWithdraw={handleWithdraw}
            isLoading={isLoading}
            jars={jars}
            viewMode={viewMode}
            visibleJars={visibleJars}
          />

          {!isLoading && pageCount > 1 && (
            <nav className="jars-pagination" aria-label="Phân trang danh sách hũ">
              <span className="jars-pagination__summary">
                {`${Math.min((currentPage - 1) * JARS_PER_PAGE + 1, jars.length)}–${Math.min(currentPage * JARS_PER_PAGE, jars.length)} / ${jars.length} hũ`}
              </span>
              <div className="jars-pagination__controls">
                <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} aria-label="Trang hũ trước">‹</button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === currentPage ? 'is-active' : ''}
                    onClick={() => changePage(page)}
                    aria-current={page === currentPage ? 'page' : undefined}
                    aria-label={`Trang hũ ${page}`}
                  >
                    {page}
                  </button>
                ))}
                <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Trang hũ sau">›</button>
              </div>
            </nav>
          )}
        </section>
      )}

      {/* ── 3. NHỊP TIẾT KIỆM & HOẠT ĐỘNG GẦN ĐÂY ── */}
      {showActivitySection && (
        <>
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
            <JarRecentActivity
              events={jarEvents}
              selectedDay={selectedDay}
              onClearDay={() => setSelectedDay(null)}
              onViewAll={openHistoryDrawer}
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
        </>
      )}

      {/* ── 4. SLIDE-OVER HISTORY DRAWER (native modal <dialog>) ── */}
      <JarHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={closeHistoryDrawer}
        jars={jars}
      />

      {/* ── 5. MODALS ── */}
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
