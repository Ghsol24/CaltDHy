import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTranslation } from '../../i18n/useTranslation';

export function SidebarNav() {
  const { t } = useTranslation();
  const activeView = useSpendingStore((s) => s.activeView);
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const planSubTab = useSpendingStore((s) => s.planSubTab);
  const analyticsSubTab = useSpendingStore((s) => s.analyticsSubTab);
  const jarsSubTab = useSpendingStore((s) => s.jarsSubTab);
  const isSidebarCollapsed = useSpendingStore((s) => s.isSidebarCollapsed);
  const setSidebarCollapsed = useSpendingStore((s) => s.setSidebarCollapsed);
  const toggleSidebar = useSpendingStore((s) => s.toggleSidebar);
  const openAddTxnModal = useSpendingStore((s) => s.openAddTxnModal);

  const handleNavClick = (viewId, subTabId) => {
    navigateTo(viewId, subTabId);

    if (window.innerWidth <= 900) {
      setSidebarCollapsed(true);
    }
  };

  const navGroups = [
    {
      id: 'group_home',
      groupLabel: t('nav.home').toLocaleUpperCase(),
      items: [
        {
          id: 'home_main',
          viewId: 'home',
          label: t('nav.home'),
          isActive: activeView === 'home',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          )
        }
      ]
    },
    {
      id: 'group_plan',
      groupLabel: t('nav.plan').toLocaleUpperCase(),
      items: [
        {
          id: 'plan_overview',
          viewId: 'plan',
          subTabId: 'overview',
          label: t('nav.overview'),
          isActive: activeView === 'plan' && (planSubTab === 'overview' || !planSubTab),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          )
        },
        {
          id: 'plan_wallets',
          viewId: 'plan',
          subTabId: 'wallets',
          label: t('nav.wallets'),
          isActive: activeView === 'plan' && planSubTab === 'wallets',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
          )
        },
        {
          id: 'plan_budgets',
          viewId: 'plan',
          subTabId: 'budgets',
          label: t('nav.budgets'),
          isActive: activeView === 'plan' && planSubTab === 'budgets',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" x2="12" y1="20" y2="10" />
              <line x1="18" x2="18" y1="20" y2="4" />
              <line x1="6" x2="6" y1="20" y2="16" />
            </svg>
          )
        },
        {
          id: 'plan_recurring',
          viewId: 'plan',
          subTabId: 'recurring',
          label: t('nav.recurring'),
          isActive: activeView === 'plan' && planSubTab === 'recurring',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          )
        }
      ]
    },
    {
      id: 'group_analytics',
      groupLabel: t('nav.analytics').toLocaleUpperCase(),
      items: [
        {
          id: 'analytics_overview',
          viewId: 'analytics',
          subTabId: 'overview',
          label: t('nav.overview'),
          isActive: activeView === 'analytics' && (analyticsSubTab === 'overview' || !analyticsSubTab),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" x2="18" y1="20" y2="10" />
              <line x1="12" x2="12" y1="20" y2="4" />
              <line x1="6" x2="6" y1="20" y2="14" />
            </svg>
          )
        },
        {
          id: 'analytics_spending',
          viewId: 'analytics',
          subTabId: 'spending',
          label: t('nav.spending'),
          isActive: activeView === 'analytics' && analyticsSubTab === 'spending',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          )
        },
        {
          id: 'analytics_cashflow',
          viewId: 'analytics',
          subTabId: 'cash-flow',
          label: t('nav.cashFlowTrend'),
          isActive: activeView === 'analytics' && analyticsSubTab === 'cash-flow',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          )
        },
        {
          id: 'analytics_reports',
          viewId: 'analytics',
          subTabId: 'reports',
          label: t('nav.reports'),
          isActive: activeView === 'analytics' && analyticsSubTab === 'reports',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 9H8" />
              <path d="M16 13H8" />
              <path d="M16 17H8" />
            </svg>
          )
        },
        {
          id: 'analytics_transactions',
          viewId: 'analytics',
          subTabId: 'transactions',
          label: t('nav.transactionHistory'),
          isActive: activeView === 'analytics' && analyticsSubTab === 'transactions',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M7 8h10M7 12h10M7 16h7" />
            </svg>
          )
        }
      ]
    },
    {
      id: 'group_jars',
      groupLabel: t('nav.jars').toLocaleUpperCase(),
      items: [
        {
          id: 'jars_goals',
          viewId: 'jars',
          subTabId: 'goals',
          label: t('nav.goals'),
          isActive: activeView === 'jars' && (jarsSubTab === 'goals' || !jarsSubTab),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          )
        },
        {
          id: 'jars_list',
          viewId: 'jars',
          subTabId: 'jars',
          label: t('nav.jarList'),
          isActive: activeView === 'jars' && jarsSubTab === 'jars',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="5" x="2" y="3" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
          )
        },
        {
          id: 'jars_history',
          viewId: 'jars',
          subTabId: 'history',
          label: t('nav.history'),
          isActive: activeView === 'jars' && jarsSubTab === 'history',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )
        }
      ]
    }
  ];

  return (
    <aside
      className={`app-sidebar-nav ${isSidebarCollapsed ? 'is-collapsed' : ''}`}
      aria-label={t('nav.mainNavigation')}
    >
      {/* Collapsed Top Toggle Button */}
      {isSidebarCollapsed && (
        <div className="sidebar-collapsed-header">
          <button
            type="button"
            className="sidebar-hamburger-btn"
            onClick={toggleSidebar}
            aria-label={t('nav.expand')}
            title={t('nav.expand')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="sidebar-scrollable-content">
        {navGroups.map((group, gIdx) => (
          <div key={group.id || gIdx} className="sidebar-nav-group">
            {!isSidebarCollapsed && (
              <div className="sidebar-group-header-row">
                <div className="sidebar-group-label">
                  <span className="sidebar-group-dot" aria-hidden="true" />
                  <span>{group.groupLabel}</span>
                </div>
                {gIdx === 0 && (
                  <button
                    type="button"
                    className="sidebar-hamburger-btn"
                    onClick={toggleSidebar}
                    aria-label={t('nav.collapse')}
                    title={t('nav.collapse')}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" x2="20" y1="12" y2="12" />
                      <line x1="4" x2="20" y1="6" y2="6" />
                      <line x1="4" x2="20" y1="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <div className="sidebar-group-items">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-nav-item ${item.isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.viewId, item.subTabId)}
                  aria-current={item.isActive ? 'page' : undefined}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <span className="sidebar-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {!isSidebarCollapsed && (
                    <span className="sidebar-item-label">{item.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* ── Quick Record Widget Card (Bottom Sidebar) ── */}
        {!isSidebarCollapsed && (
          <div className="sidebar-quick-record-card">
            <div className="quick-record-header">
              <div className="quick-record-icon-box" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div className="quick-record-text">
                <strong className="quick-record-title">{t('nav.quickRecord')}</strong>
              </div>
            </div>
            <button
              type="button"
              className="quick-record-btn"
              onClick={openAddTxnModal}
            >
              <span>{t('nav.addTransaction')}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
