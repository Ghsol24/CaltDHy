import React, { useLayoutEffect, useRef, useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTranslation } from '../../i18n/useTranslation';

const PRIMARY_ITEMS = [
  { id: 'home', labelKey: 'nav.home', icon: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></> },
  { id: 'plan', labelKey: 'nav.plan', icon: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></> },
  { id: 'analytics', labelKey: 'nav.analytics', icon: <><line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" /></> },
  { id: 'jars', labelKey: 'nav.jarShort', icon: <><path d="M6 5h12" /><path d="M7 5V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2" /><path d="M5 9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9Z" /></> }
];

const SECTION_ITEMS = {
  plan: [
    { id: 'overview', labelKey: 'nav.overview' }, { id: 'wallets', labelKey: 'nav.wallets' },
    { id: 'budgets', labelKey: 'nav.budgets' }, { id: 'recurring', labelKey: 'nav.recurring' }
  ],
  analytics: [
    { id: 'overview', labelKey: 'nav.overview', target: 'analytics-overview' },
    { id: 'spending', labelKey: 'nav.spending', target: 'analytics-spending' },
    { id: 'cash-flow', labelKey: 'nav.cashFlow', target: 'analytics-cashflow' },
    { id: 'reports', labelKey: 'nav.reports', target: 'analytics-reports' },
    { id: 'transactions', labelKey: 'nav.transactionHistory', target: 'transaction-history-title' }
  ],
  jars: [
    { id: 'goals', labelKey: 'nav.goals', target: 'jars-section-goals' },
    { id: 'jars', labelKey: 'nav.jarList', target: 'jars-section-list' },
    { id: 'history', labelKey: 'nav.history', target: 'jars-section-history' }
  ]
};

const SECTION_LABELS = {
  plan: 'nav.plan', analytics: 'nav.analytics', jars: 'nav.jarShort'
};

export function MobilePrimaryNavigation() {
  const { t } = useTranslation();
  const activeView = useSpendingStore((state) => state.activeView);
  const navigateTo = useSpendingStore((state) => state.navigateTo);

  const activate = (id) => {
    navigateTo(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <nav className="mobile-primary-nav" aria-label={t('nav.mobileNavigation')}>
      {PRIMARY_ITEMS.map((item) => {
        const isActive = activeView === item.id;
        return (
          <button key={item.id} type="button" className={`mobile-primary-nav__item ${isActive ? 'is-active' : ''}`} onClick={() => activate(item.id)} aria-current={isActive ? 'page' : undefined}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{item.icon}</svg>
            <span>{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function MobileSectionNavigation() {
  const { t } = useTranslation();
  const activeView = useSpendingStore((state) => state.activeView);
  const planSubTab = useSpendingStore((state) => state.planSubTab);
  const analyticsSubTab = useSpendingStore((state) => state.analyticsSubTab);
  const jarsSubTab = useSpendingStore((state) => state.jarsSubTab);
  const navigateTo = useSpendingStore((state) => state.navigateTo);
  const items = SECTION_ITEMS[activeView];
  const activeTab = activeView === 'plan' ? planSubTab : activeView === 'analytics' ? analyticsSubTab : jarsSubTab;
  const scrollerRef = useRef(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    const updateEdges = () => {
      const left = scroller.scrollLeft > 2;
      const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2;
      setScrollEdges((current) => current.left === left && current.right === right ? current : { left, right });
    };

    const activeItem = scroller.querySelector('[aria-current="page"]');
    if (activeItem) {
      const viewport = scroller.getBoundingClientRect();
      const selected = activeItem.getBoundingClientRect();
      if (selected.left < viewport.left) scroller.scrollLeft -= viewport.left - selected.left + 8;
      if (selected.right > viewport.right) scroller.scrollLeft += selected.right - viewport.right + 8;
    }
    updateEdges();

    scroller.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null;
    if (observer) {
      observer.observe(scroller);
      for (const item of scroller.children) observer.observe(item);
    }
    return () => {
      scroller.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
      observer?.disconnect();
    };
  }, [activeView, activeTab]);

  if (!items) return null;

  const activate = (item) => {
    navigateTo(activeView, item.id);
  };

  return (
    <nav className="mobile-section-nav" aria-label={t('nav.sectionNavigation', { section: t(SECTION_LABELS[activeView]) })}>
      <div className="mobile-section-nav__scroller" ref={scrollerRef}>
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return <button key={item.id} type="button" className={`mobile-section-nav__item ${isActive ? 'is-active' : ''}`} onClick={() => activate(item)} aria-current={isActive ? 'page' : undefined}>{t(item.labelKey)}</button>;
        })}
      </div>
      {scrollEdges.left && <span className="mobile-section-nav__hint mobile-section-nav__hint--left" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></span>}
      {scrollEdges.right && <span className="mobile-section-nav__hint mobile-section-nav__hint--right" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></span>}
    </nav>
  );
}
