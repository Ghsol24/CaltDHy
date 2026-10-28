import { getUserErrorMessage } from '../../utils/userErrors.js';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useSectionScrollSpy } from '../../hooks/useSectionScrollSpy';
import { JarModal } from './JarModal';
import { JarTransactionModal } from './JarTransactionModal';
import { JarDetailModal } from './JarDetailModal';
import { JarHistoryModal } from './JarHistoryModal';
import { FinancialTipsModal } from './FinancialTipsModal';
import { JarGlassGraphic } from './JarGlassGraphic';
import { formatCurrency, formatPercent, getLocalDateString } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';
import { EmptyState } from '../../components/ui/EmptyState';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { buildJarSuggestions, getJarSuggestionCopy } from './jarSuggestionCopy';
import { JarActivityCalendar } from './JarActivityCalendar';
import { JarRecentActivity } from './JarRecentActivity';
import { JarNextStepStrip } from './JarNextStepStrip';
import { collectJarEvents, compareWithPreviousMonth, monthOf, monthTotals, summariseDays } from './jarActivity';
import {
  TargetOutlineIcon,
  TrophyOutlineIcon,
  AlertTriangleOutlineIcon,
  CheckOutlineIcon,
  JarOutlineIcon
} from '../../components/ui/AppIcons';
import '../../assets/css/jars.css';

const JARS_PER_PAGE = 12;
const JARS_SCROLL_SECTIONS = Object.freeze([
  ['jars-section-goals', 'goals'],
  ['jars-section-list', 'jars'],
  ['jars-section-history', 'history'],
]);

function DeferredJarGlassGraphic(props) {
  const hostRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || shouldRender) return undefined;
    if (!('IntersectionObserver' in window)) {
      setShouldRender(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setShouldRender(true);
      observer.disconnect();
    }, { rootMargin: '240px 0px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={hostRef} className="jar-graphic-deferred-host" aria-hidden="true">
      {shouldRender ? (
        <JarGlassGraphic {...props} />
      ) : (
        <span className="jar-graphic-deferred-placeholder">{Math.max(0, Math.min(100, Number(props.percent) || 0))}%</span>
      )}
    </div>
  );
}

// Display preference only. The hyphenated name keeps it out of the sign-in
// cleanup that clears private `caltdhy_*` data, without growing the first-load bundle.
const CALENDAR_VIEW_KEY = 'caltdhy-jar-calendar-view';
const readCalendarView = () => {
  try { return localStorage.getItem(CALENDAR_VIEW_KEY) === 'year' ? 'year' : 'month'; } catch { return 'month'; }
};

export function JarsView() {
  const { lang, intlLocale } = useTranslation();
  const jars = useJarStore((s) => s.jars);
  const isLoading = useJarStore((s) => s.isLoading);
  const hasLoaded = useJarStore((s) => s.hasLoaded);
  const error = useJarStore((s) => s.error);
  const fetchData = useJarStore((s) => s.fetchData);
  const deleteJar = useJarStore((s) => s.deleteJar);
  const confirm = useConfirmStore((s) => s.confirm);
  const addToast = useToastStore((s) => s.addToast);
  const jarsSubTab = useSpendingStore((s) => s.jarsSubTab);
  const setJarsSubTab = useSpendingStore((s) => s.setJarsSubTab);
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const isMobile = useIsMobile(900);

  // Modals state
  const [isJarModalOpen, setIsJarModalOpen] = useState(false);
  const [editingJar, setEditingJar] = useState(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [activeJar, setActiveJar] = useState(null);
  const [txAction, setTxAction] = useState('deposit'); // 'deposit' | 'withdraw'
  const [txInitialAmount, setTxInitialAmount] = useState(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailJar, setSelectedDetailJar] = useState(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
  const [tipsTopic, setTipsTopic] = useState('smart'); // 'smart' | '50-30-20'

  // Toolbar & view settings
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'progress_desc' | 'deadline_asc' | 'name_asc'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuJarId, setActiveMenuJarId] = useState(null);
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
    const formatter = new Intl.DateTimeFormat(intlLocale || 'vi-VN', { month: 'long', year: 'numeric' });
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ value: val, label: formatter.format(d) });
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
  const { totalSaved, totalTarget, totalPercent, totalRemaining, activeJarsCount } = useMemo(() => {
    let saved = 0;
    let target = 0;
    let activeCount = 0;

    jars.forEach((jar) => {
      const cur = Number(jar.current) || 0;
      const tgt = Number(jar.target) || 0;
      saved += cur;
      target += tgt;
      if (cur > 0 || tgt > 0) {
        activeCount++;
      }
    });

    const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    const remaining = Math.max(0, target - saved);

    return {
      totalSaved: saved,
      totalTarget: target,
      totalPercent: percent,
      totalRemaining: remaining,
      activeJarsCount: activeCount
    };
  }, [jars]);

  const totalCurrent = totalSaved;

  // ── 2. Real jar activity (deposits and withdrawals by day) ──
  const jarEvents = useMemo(() => collectJarEvents(jars), [jars]);
  const jarDays = useMemo(() => summariseDays(jarEvents), [jarEvents]);
  const thisMonth = monthOf(today);
  const thisMonthNet = useMemo(() => monthTotals(jarDays, thisMonth).net, [jarDays, thisMonth]);
  const thisMonthComparison = useMemo(() => compareWithPreviousMonth(jarDays, thisMonth), [jarDays, thisMonth]);

  // Suggestions use exact balances; locale changes only affect their presentation.
  const smartSuggestions = useMemo(() => buildJarSuggestions(jars), [jars]);
  const currentSuggestion = smartSuggestions[recomIndex % smartSuggestions.length];
  const suggestionCopy = getJarSuggestionCopy(lang);
  const suggestionPercent = currentSuggestion.kind === 'complete' ? 100 : Math.floor(currentSuggestion.progress);
  const splitFirst = Math.floor((currentSuggestion.amount || 0) / 2);
  const splitSecond = (currentSuggestion.amount || 0) - splitFirst;
  const splitSuggestion = splitFirst > 0
    ? splitFirst === splitSecond
      ? suggestionCopy.splitEven(formatCurrency(splitFirst))
      : suggestionCopy.splitUneven(formatCurrency(splitFirst), formatCurrency(splitSecond))
    : '';

  // ── 4. Progress Overview 3 Cards Data ──
  const progressOverview = useMemo(() => {
    if (jars.length === 0) {
      return { closest: null, onTrack: [], needsAttention: [] };
    }

    // 1. Closest
    const sortedByPercent = [...jars].sort((a, b) => {
      const pA = Number(a.current || 0) / Number(a.target || 1);
      const pB = Number(b.current || 0) / Number(b.target || 1);
      return pB - pA;
    });
    const closest = sortedByPercent[0] || null;

    // 2. Needs Attention & 3. On Track
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const needsAttention = [];
    const onTrack = [];

    jars.forEach((j) => {
      const cur = Number(j.current) || 0;
      const tgt = Number(j.target) || 1;
      const pct = cur / tgt;

      if (cur === 0 && tgt > 0) {
        needsAttention.push({
          jar: j,
          reason: 'Chưa có số dư khởi động',
          missing: tgt
        });
      } else if (j.targetDate) {
        const targetD = new Date(j.targetDate);
        targetD.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((targetD.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (targetD < today && cur < tgt) {
          needsAttention.push({
            jar: j,
            reason: 'Đã quá hạn mục tiêu',
            missing: Math.max(0, tgt - cur)
          });
        } else if (diffDays <= 45 && pct < 0.4) {
          needsAttention.push({
            jar: j,
            reason: `Còn ${diffDays} ngày (${Math.round(pct * 100)}%)`,
            missing: Math.max(0, tgt - cur)
          });
        } else {
          onTrack.push(j);
        }
      } else if (cur > 0) {
        onTrack.push(j);
      }
    });

    return { closest, onTrack, needsAttention };
  }, [jars]);

  // ── 5. Sorted Jars for List Section ──
  const sortedJars = useMemo(() => {
    const list = [...jars];
    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case 'oldest':
        return list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      case 'progress_desc':
        return list.sort((a, b) => {
          const pA = Number(a.current || 0) / Number(a.target || 1);
          const pB = Number(b.current || 0) / Number(b.target || 1);
          return pB - pA;
        });
      case 'deadline_asc':
        return list.sort((a, b) => {
          if (a.targetDate && b.targetDate) return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
          if (a.targetDate) return -1;
          if (b.targetDate) return 1;
          return 0;
        });
      case 'name_asc':
        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default:
        return list;
    }
  }, [jars, sortBy]);
  const pageCount = Math.max(1, Math.ceil(sortedJars.length / JARS_PER_PAGE));
  const visibleJars = useMemo(() => {
    const start = (currentPage - 1) * JARS_PER_PAGE;
    return sortedJars.slice(start, start + JARS_PER_PAGE);
  }, [currentPage, sortedJars]);

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

  const handleOpenTips = (topic) => {
    setTipsTopic(topic);
    setIsTipsModalOpen(true);
  };

  useSectionScrollSpy({
    disabled: isMobile || jars.length === 0,
    sections: JARS_SCROLL_SECTIONS,
    onActiveChange: (activeTab) => {
      if (activeTab && useSpendingStore.getState().jarsSubTab !== activeTab) {
        setJarsSubTab(activeTab, { syncRoute: false });
      }
    },
  });

  if (!hasLoaded || (isLoading && jars.length === 0)) {
    return (
      <div className="jars-page-root" role="region" aria-label="Quản lý Hũ chi tiêu và Tiết kiệm">
        <div className="feature-loading" role="status" aria-live="polite">Đang tải dữ liệu hũ…</div>
      </div>
    );
  }

  if (error && jars.length === 0) {
    return (
      <div className="jars-page-root" role="region" aria-label="Quản lý Hũ chi tiêu và Tiết kiệm">
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
    const emptyHeading = jarsSubTab === 'jars'
      ? 'Danh sách hũ'
      : jarsSubTab === 'history'
        ? 'Lịch sử hũ'
        : 'Mục tiêu';
    return (
      <div className="jars-page-root" role="region" aria-label="Quản lý Hũ chi tiêu và Tiết kiệm">
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
          />
        )}
      </div>
    );
  }

  return (
    <div className="jars-page-root" role="region" aria-label="Quản lý Hũ chi tiêu và Tiết kiệm">
      {/* ── ERROR STATE BANNER ── */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #EF4444',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#DC2626',
            fontSize: '13px'
          }}
        >
          <span>{getUserErrorMessage(error, 'error.load')}</span>
          <button
            type="button"
            onClick={fetchData}
            style={{
              background: '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {(!isMobile || jarsSubTab === 'goals') && (
        <>
      {/* ── SECTION 1: HEADER & OVERVIEW (#jars-section-goals) ── */}
      <section id="jars-section-goals" className="jars-hero-overview-card">
        {/* Header Title Row */}
        <div className="jars-hero-top-row">
          <div className="jars-hero-titles">
            <h1 className="jars-hero-heading">Mục tiêu</h1>
          </div>

          <button
            type="button"
            className="jars-hero-cta-btn"
            onClick={handleCreateNew}
          >
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Tạo hũ mới</span>
          </button>
        </div>

        {/* 4 Metric Cards */}
        <div className="jars-hero-metrics-grid">
          {/* Card 1: Đã tích lũy */}
          <div className="jars-metric-card">
            <div className="jars-metric-top">
              <span className="jars-metric-label">Đã tích lũy</span>
              <div className="jars-metric-icon-box jars-metric-icon-box--blue">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </div>
            </div>
            <strong className="jars-metric-value">{formatCurrency(totalCurrent)}</strong>
            {thisMonthComparison.percent !== null ? (
              <span className={`jars-metric-trend${thisMonthComparison.percent < 0 ? ' jars-metric-trend--down' : ''}`}>
                {thisMonthComparison.percent < 0 ? '↓' : '↑'} {Math.abs(thisMonthComparison.percent)}% so với tháng trước
              </span>
            ) : (
              <span className={`jars-metric-trend${thisMonthNet > 0 ? '' : ' jars-metric-trend--neutral'}`}>
                {thisMonthNet > 0 ? `+${formatCurrency(thisMonthNet)} trong tháng này`
                  : thisMonthNet < 0 ? `${formatCurrency(thisMonthNet)} trong tháng này` : 'Tháng này chưa nạp thêm'}
              </span>
            )}
          </div>

          {/* Card 2: Tổng mục tiêu */}
          <div className="jars-metric-card">
            <div className="jars-metric-top">
              <span className="jars-metric-label">Tổng mục tiêu</span>
              <div className="jars-metric-icon-box jars-metric-icon-box--purple">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" x2="4" y1="22" y2="15" />
                </svg>
              </div>
            </div>
            <strong className="jars-metric-value">{formatCurrency(totalTarget)}</strong>
            <span className="jars-metric-trend jars-metric-trend--neutral">
              Mục tiêu cả năm
            </span>
          </div>

          {/* Card 3: Đang thực hiện */}
          <div className="jars-metric-card">
            <div className="jars-metric-top">
              <span className="jars-metric-label">Đang thực hiện</span>
              <div className="jars-metric-icon-box jars-metric-icon-box--orange">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="3" width="14" height="3" rx="1" />
                  <path d="M6 6v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
                  <circle cx="12" cy="13" r="3" />
                  <path d="M12 11.5v3" />
                </svg>
              </div>
            </div>
            <strong className="jars-metric-value">{activeJarsCount} hũ</strong>
            <span className="jars-metric-trend jars-metric-trend--neutral">
              Hoạt động ổn định
            </span>
          </div>

          {/* Card 4: Tỷ lệ hoàn thành */}
          <div className="jars-metric-card">
            <div className="jars-metric-top">
              <span className="jars-metric-label">Tỷ lệ hoàn thành</span>
              <div className="jars-metric-icon-box jars-metric-icon-box--teal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </div>
            </div>
            <strong className="jars-metric-value">{formatPercent(totalPercent)}</strong>
            <div className="jars-metric-mini-track">
              <div
                className="jars-metric-mini-fill"
                style={{ width: `${Math.max(totalPercent > 0 ? 4 : 0, totalPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="jars-global-progress-banner">
          <div className="jars-global-progress-labels">
            <span>
              Bạn đã hoàn thành <strong>{formatPercent(totalPercent)}</strong> mục tiêu
            </span>
            <span>
              Còn thiếu: <strong>{formatCurrency(totalRemaining)}</strong>
            </span>
          </div>
          <div className="jars-global-progress-track">
            <div
              className="jars-global-progress-fill"
              style={{ width: `${Math.max(totalPercent > 0 ? 3 : 0, totalPercent)}%` }}
            />
          </div>
        </div>
      </section>

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
        <JarRecentActivity
          id={isMobile ? undefined : 'jars-section-history'}
          events={jarEvents}
          selectedDay={selectedDay}
          onClearDay={() => setSelectedDay(null)}
          onViewAll={() => (isMobile ? navigateTo('jars', 'history') : setIsHistoryModalOpen(true))}
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

      {/* ── SECTION 4: TỔNG QUAN TIẾN ĐỘ (#jars-section-progress) ── */}
      <section id="jars-section-progress" className="jars-progress-overview-section">
        <div className="jars-section-header-row">
          <h2 className="jars-section-title">
            <TargetOutlineIcon size={20} />
            <span>Tổng quan tiến độ</span>
          </h2>
          <button
            type="button"
            className="jars-section-action-link"
            onClick={() => navigateTo('jars', 'jars')}
          >
            <span>Xem chi tiết</span>
            <span>→</span>
          </button>
        </div>

        <div className="jars-status-cards-grid">
          {/* 1. Gần đạt nhất */}
          <div className="jars-status-card jars-status-card--closest">
            <div className="jars-status-card-header">
              <div className="jars-status-card-header-left">
                <TrophyOutlineIcon size={16} />
                <span>Gần đạt nhất</span>
              </div>
            </div>
            <div className="jars-status-card-body">
              {progressOverview.closest ? (
                <>
                  <div className="jars-status-jar-row">
                    <span>{progressOverview.closest.name}</span>
                    <span className="jars-status-jar-percent">
                      {formatPercent(
                        Math.round(
                          ((Number(progressOverview.closest.current) || 0) /
                            (Number(progressOverview.closest.target) || 1)) *
                            100
                        )
                      )}
                    </span>
                  </div>
                  <div className="jars-status-track">
                    <div
                      className="jars-status-fill jars-status-fill--closest"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((Number(progressOverview.closest.current) || 0) /
                              (Number(progressOverview.closest.target) || 1)) *
                              100
                          )
                        )}%`
                      }}
                    />
                  </div>
                  <span className="jars-status-subtext">
                    Còn{' '}
                    <strong>
                      {formatCurrency(
                        Math.max(
                          0,
                          (Number(progressOverview.closest.target) || 0) -
                            (Number(progressOverview.closest.current) || 0)
                        )
                      )}
                    </strong>{' '}
                    để đạt mục tiêu
                  </span>
                </>
              ) : (
                <span className="jars-status-empty-text">Chưa có mục tiêu nào được tạo.</span>
              )}
            </div>
          </div>

          {/* 2. Đang đúng tiến độ */}
          <div className="jars-status-card jars-status-card--ontrack">
            <div className="jars-status-card-header">
              <div className="jars-status-card-header-left">
                <TargetOutlineIcon size={16} />
                <span>Đang đúng tiến độ</span>
              </div>
              {progressOverview.onTrack.length > 0 && (
                <span className="jars-status-tag jars-status-tag--ontrack">
                  {progressOverview.onTrack.length} mục tiêu
                </span>
              )}
            </div>
            <div className="jars-status-card-body">
              {progressOverview.onTrack.length > 0 ? (
                <>
                  <div className="jars-status-jar-row">
                    <span>{progressOverview.onTrack[0].name}</span>
                    <span className="jars-status-jar-percent" style={{ color: '#059669' }}>
                      {formatPercent(
                        Math.round(
                          ((Number(progressOverview.onTrack[0].current) || 0) /
                            (Number(progressOverview.onTrack[0].target) || 1)) *
                            100
                        )
                      )}
                    </span>
                  </div>
                  <div className="jars-status-track">
                    <div
                      className="jars-status-fill jars-status-fill--ontrack"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((Number(progressOverview.onTrack[0].current) || 0) /
                              (Number(progressOverview.onTrack[0].target) || 1)) *
                              100
                          )
                        )}%`
                      }}
                    />
                  </div>
                  <span className="jars-status-subtext">
                    Đã tích lũy{' '}
                    <strong>{formatCurrency(Number(progressOverview.onTrack[0].current) || 0)}</strong> / {formatCurrency(Number(progressOverview.onTrack[0].target) || 0)}
                  </span>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="jars-status-tag jars-status-tag--ontrack" style={{ alignSelf: 'flex-start' }}>
                    Đang theo dõi
                  </span>
                  <span className="jars-status-empty-text">
                    Hãy nạp tiền vào các hũ để ghi nhận đà tăng trưởng!
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Cần chú ý */}
          <div className="jars-status-card jars-status-card--attention">
            <div className="jars-status-card-header">
              <div className="jars-status-card-header-left">
                <AlertTriangleOutlineIcon size={16} />
                <span>Cần chú ý</span>
              </div>
              {progressOverview.needsAttention.length > 0 && (
                <span className="jars-status-tag jars-status-tag--attention">
                  {progressOverview.needsAttention.length} mục tiêu
                </span>
              )}
            </div>
            <div className="jars-status-card-body">
              {progressOverview.needsAttention.length > 0 ? (
                <>
                  <div className="jars-status-jar-row">
                    <span>{progressOverview.needsAttention[0].jar.name}</span>
                    <span className="jars-status-tag jars-status-tag--attention">
                      {progressOverview.needsAttention[0].reason}
                    </span>
                  </div>
                  <span className="jars-status-subtext" style={{ color: '#B45309' }}>
                    Còn thiếu <strong>{formatCurrency(progressOverview.needsAttention[0].missing)}</strong> để đạt mục tiêu.
                  </span>
                  <button
                    type="button"
                    className="jars-status-action-btn"
                    onClick={() => handleDeposit(progressOverview.needsAttention[0].jar)}
                  >
                    <span>+ Nạp ngay</span>
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="jars-status-tag jars-status-tag--safe" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckOutlineIcon size={12} />
                    <span>Chưa có cảnh báo tiến độ</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
        </>
      )}

      {/* ── SECTION 5: CÁC HŨ CỦA BẠN (#jars-section-list) ── */}
      {(!isMobile || jarsSubTab === 'jars') && (
      <>
      <section id="jars-section-list" className="jars-list-section">
        {/* Toolbar Header */}
        <div className="jars-toolbar-row">
          <div className="jars-toolbar-left">
            <h2 className="jars-section-title" style={{ margin: 0 }}>
              Các hũ của bạn
            </h2>
            <span className="jars-count-badge">({jars.length})</span>
          </div>

          <div className="jars-toolbar-right">
            {/* Sort Dropdown */}
            <CustomSelect
              prefixLabel="Sắp xếp:"
              options={[
                { value: 'newest', label: 'Mới nhất' },
                { value: 'oldest', label: 'Cũ nhất' },
                { value: 'progress_desc', label: 'Tiến độ cao nhất' },
                { value: 'deadline_asc', label: 'Đến hạn sớm nhất' },
                { value: 'name_asc', label: 'Tên A-Z' },
              ]}
              value={sortBy}
              onChange={(val) => {
                setSortBy(val);
                setCurrentPage(1);
              }}
              size="sm"
              variant="subtle"
              align="right"
              ariaLabel="Sắp xếp danh sách hũ"
            />

            {/* View Mode Grid/List */}
            <div className="jars-view-toggle">
              <button
                type="button"
                className={`jars-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Chế độ lưới"
                title="Chế độ xem lưới"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                className={`jars-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                aria-label="Chế độ danh sách"
                title="Chế độ xem danh sách"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading && jars.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
            <span className="spinner" style={{ width: 28, height: 28, marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Đang tải danh sách hũ chi tiêu...</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && jars.length === 0 && (
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#5356F1" strokeWidth="1.5">
                <path d="M19 11V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5" />
                <rect width="20" height="9" x="2" y="11" rx="2" />
                <line x1="12" y1="11" x2="12" y2="20" />
              </svg>
            }
            title="Chưa có hũ chi tiêu nào"
            description="Tạo hũ đầu tiên và nhập số tiền mục tiêu để theo dõi tiến độ."
            actionLabel="+ Tạo hũ tiết kiệm đầu tiên"
            onAction={handleCreateNew}
          />
        )}

        {/* LOADED STATE: GRID VIEW */}
        {!isLoading && jars.length > 0 && viewMode === 'grid' && (
          <div className="jars-grid-container">
            {visibleJars.map((jar) => {
              const currentAmt = Number(jar.current || 0);
              const targetAmt = Number(jar.target || 0);
              const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
              const remaining = Math.max(0, targetAmt - currentAmt);
              const isCompleted = targetAmt > 0 && currentAmt >= targetAmt;
              const accentColor = jar.color || '#5356F1';

              // Calculate monthly savings suggestion
              let monthlyHintText = 'Đặt ngày đến hạn để nhận gợi ý tích lũy hàng tháng';
              if (jar.targetDate && remaining > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((new Date(jar.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > 0) {
                  const monthsLeft = Math.max(1, Math.round(diffDays / 30));
                  const perMonth = Math.round(remaining / monthsLeft);
                  monthlyHintText = `Cần khoảng ${formatCurrency(perMonth)} / tháng để đạt mục tiêu đúng hạn`;
                } else {
                  monthlyHintText = 'Đã đến hạn mục tiêu!';
                }
              } else if (isCompleted) {
                monthlyHintText = 'Đã hoàn thành 100% mục tiêu xuất sắc!';
              }

              return (
                <div
                  key={jar.id}
                  className={`jar-premium-card ${deletingJarId === jar.id ? 'is-deleting' : ''}`}
                  style={{ '--jar-accent-color': accentColor }}
                  onClick={() => handleOpenDetail(jar)}
                >
                  {/* Top Category Tag + Menu */}
                  <div className="jar-card-top-row" onClick={(e) => e.stopPropagation()}>
                    <span
                      className="jar-category-badge"
                      style={{
                        background: `${accentColor}18`,
                        color: accentColor
                      }}
                    >
                      {jar.category || 'MỤC TIÊU'}
                    </span>

                    {/* 3-dots dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className={`jar-card-menu-btn ${activeMenuJarId === jar.id ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuJarId(activeMenuJarId === jar.id ? null : jar.id);
                        }}
                        aria-label="Tùy chọn hũ"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>

                      {activeMenuJarId === jar.id && (
                        <div className="jar-card-dropdown-menu">
                          <button
                            type="button"
                            className="jar-dropdown-item"
                            onClick={() => {
                              setActiveMenuJarId(null);
                              handleOpenDetail(jar);
                            }}
                          >
                            Xem chi tiết
                          </button>
                          <button
                            type="button"
                            className="jar-dropdown-item"
                            onClick={() => {
                              setActiveMenuJarId(null);
                              handleEdit(jar);
                            }}
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            type="button"
                            className="jar-dropdown-item jar-dropdown-item--danger"
                            onClick={() => {
                              setActiveMenuJarId(null);
                              handleDelete(jar);
                            }}
                          >
                            Xóa hũ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3D Glass Jar Illustration Graphic */}
                  <div className="jar-graphic-center-box">
                    <DeferredJarGlassGraphic
                      percent={percent}
                      color={accentColor}
                      icon={jar.icon}
                      width={80}
                      height={96}
                    />
                  </div>

                  {/* Jar Name & Amounts */}
                  <div className="jar-info-section">
                    <h3 className="jar-name-title" title={jar.name}>
                      {jar.name}
                    </h3>
                    <div className="jar-amounts-row">
                      <strong className="jar-current-amount">{formatCurrency(currentAmt)}</strong>
                      <span className="jar-target-amount">/ {formatCurrency(targetAmt)}</span>
                    </div>

                    <div className="jar-progress-track">
                      <div
                        className="jar-progress-fill"
                        style={{
                          width: `${Math.max(percent > 0 ? 3 : 0, percent)}%`,
                          background: isCompleted ? '#10B981' : accentColor
                        }}
                      />
                    </div>
                  </div>

                  {/* 2 Meta Columns: Còn thiếu / Đến hạn */}
                  <div className="jar-meta-cols-row">
                    <span>
                      Còn thiếu: <strong>{formatCurrency(remaining)}</strong>
                    </span>
                    <span>
                      {jar.targetDate ? (
                        <>Đến hạn: <strong>{formatDate(jar.targetDate, 'short')}</strong></>
                      ) : (
                        'Mục tiêu linh hoạt'
                      )}
                    </span>
                  </div>

                  {/* Smart Monthly Target Box */}
                  <div className="jar-smart-hint-box">
                    <span>{monthlyHintText}</span>
                  </div>

                  {/* Footer 3 Action Buttons */}
                  <div className="jar-card-footer-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="jar-btn-deposit"
                      onClick={() => handleDeposit(jar)}
                    >
                      + Nạp tiền
                    </button>

                    <button
                      type="button"
                      className="jar-btn-withdraw"
                      onClick={() => handleWithdraw(jar)}
                      disabled={currentAmt <= 0}
                    >
                      Rút tiền
                    </button>

                    <button
                      type="button"
                      className="jar-btn-detail-icon"
                      onClick={() => handleEdit(jar)}
                      aria-label={`Chỉnh sửa hũ ${jar.name}`}
                      title="Chỉnh sửa hũ"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Card "+ Tạo hũ mới" (Dashed Border) */}
            <button type="button" className="jar-card-add-new" onClick={handleCreateNew}>
              <div className="jar-card-add-icon-circle">+</div>
              <h3 className="jar-card-add-title">Tạo hũ mới</h3>
              <p className="jar-card-add-desc">Bắt đầu một mục tiêu mới ngay hôm nay!</p>
            </button>
          </div>
        )}

        {/* LOADED STATE: LIST VIEW */}
        {!isLoading && jars.length > 0 && viewMode === 'list' && (
          <div className="jars-list-mode-container">
            {visibleJars.map((jar) => {
              const currentAmt = Number(jar.current || 0);
              const targetAmt = Number(jar.target || 0);
              const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
              const remaining = Math.max(0, targetAmt - currentAmt);
              const accentColor = jar.color || '#5356F1';

              return (
                <div
                  key={jar.id}
                  className="jar-list-mode-row"
                  onClick={() => handleOpenDetail(jar)}
                >
                  <div className="jar-list-left">
                    <span style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${accentColor}18`, color: accentColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <JarOutlineIcon size={20} color="currentColor" />
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '14px', color: '#0F172A' }}>{jar.name}</strong>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: `${accentColor}18`,
                            color: accentColor
                          }}
                        >
                          {jar.category || 'MỤC TIÊU'}
                        </span>
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Còn thiếu: {formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>

                  <div className="jar-list-center">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span><strong>{formatCurrency(currentAmt)}</strong> / {formatCurrency(targetAmt)}</span>
                      <strong style={{ color: accentColor }}>{formatPercent(percent)}</strong>
                    </div>
                    <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.max(percent > 0 ? 3 : 0, percent)}%`,
                          height: '100%',
                          background: accentColor,
                          borderRadius: '99px'
                        }}
                      />
                    </div>
                  </div>

                  <div className="jar-list-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="jar-btn-deposit"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleDeposit(jar)}
                    >
                      + Nạp
                    </button>
                    <button
                      type="button"
                      className="jar-btn-withdraw"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleWithdraw(jar)}
                      disabled={currentAmt <= 0}
                    >
                      Rút
                    </button>
                    <button
                      type="button"
                      className="jar-btn-detail-icon"
                      onClick={() => handleEdit(jar)}
                      aria-label={`Chỉnh sửa hũ ${jar.name}`}
                      title="Chỉnh sửa hũ"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Row "+ Tạo hũ mới" (Dashed Border) in List Mode */}
            <button type="button" className="jar-list-mode-add-row" onClick={handleCreateNew}>
              <div className="jar-list-mode-add-icon">+</div>
              <div>
                <span className="jar-list-mode-add-title">Tạo hũ mới</span>
                <span className="jar-list-mode-add-desc">— Bắt đầu một mục tiêu mới ngay hôm nay</span>
              </div>
            </button>
          </div>
        )}

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

      {/* ── SECTION 6: LỊCH SỬ HŨ ──
          Desktop shows recent activity beside the calendar (id jars-section-history
          lives there). On phones the "Lịch sử" tab shows the longer list here. */}
      {isMobile && jarsSubTab === 'history' && (
        <JarRecentActivity
          id="jars-section-history"
          events={jarEvents}
          selectedDay={selectedDay}
          onClearDay={() => setSelectedDay(null)}
          onViewAll={() => setIsHistoryModalOpen(true)}
          limit={30}
        />
      )}

      {/* ── SECTION 7: THÔNG TIN HỮU ÍCH ── */}
      {(!isMobile || jarsSubTab === 'goals') && (
      <section className="jars-financial-tips-grid">
        {/* Tip 1 */}
        <div className="jars-tip-card" onClick={() => handleOpenTips('smart')} style={{ cursor: 'pointer' }}>
          <div className="jars-tip-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <div className="jars-tip-body">
            <h3 className="jars-tip-title">Tại sao cần có mục tiêu?</h3>
            <p className="jars-tip-desc">
              Có mục tiêu rõ ràng giúp bạn có động lực tiết kiệm và đạt được những điều quan trọng trong cuộc sống.
            </p>
            <button type="button" className="jars-tip-link">
              <span>Tìm hiểu thêm</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Tip 2 */}
        <div className="jars-tip-card" onClick={() => handleOpenTips('50-30-20')} style={{ cursor: 'pointer' }}>
          <div className="jars-tip-icon-box jars-tip-icon-box--success">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="jars-tip-body">
            <h3 className="jars-tip-title">Quy tắc 50/30/20</h3>
            <p className="jars-tip-desc">
              50% cho nhu cầu thiết yếu, 30% cho mong muốn cá nhân, 20% cho tiết kiệm và đầu tư.
            </p>
            <button type="button" className="jars-tip-link jars-tip-link--success">
              <span>Xem chi tiết & Tính toán</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>
      )}

      {/* ── MODALS ── */}
      {isJarModalOpen && (
        <JarModal
          isOpen={isJarModalOpen}
          onClose={() => setIsJarModalOpen(false)}
          jarToEdit={editingJar}
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

      {isHistoryModalOpen && (
        <JarHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          jars={jars}
        />
      )}

      {isTipsModalOpen && (
        <FinancialTipsModal
          isOpen={isTipsModalOpen}
          onClose={() => setIsTipsModalOpen(false)}
          initialTopic={tipsTopic}
        />
      )}
    </div>
  );
}
