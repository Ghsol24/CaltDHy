import React, { useEffect, useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NavIcon } from '../ui/NavIcons';

import { Icon } from '../../components/ui/AppIcons';
// Which sidebar groups the viewer folded away. A per-browser convenience:
// if storage is blocked every group simply starts open.
const COLLAPSED_GROUPS_KEY = 'caltdhy_sidebar_collapsed_groups';

function readCollapsedGroups() {
  try {
    const stored = JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function HamburgerIcon({ size }) {
  return (
    <Icon name="menu" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
  );
}

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
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(collapsedGroups));
    } catch {
      // Storage unavailable: the choice lasts for this visit only.
    }
  }, [collapsedGroups]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups((current) => (current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]));
  };

  const handleNavClick = (viewId, subTabId) => {
    navigateTo(viewId, subTabId);

    if (window.innerWidth <= 900) {
      setSidebarCollapsed(true);
    }
  };

  const navGroups = [
    {
      id: 'group_home',
      groupLabel: t('nav.home'),
      items: [
        { id: 'home_main', viewId: 'home', label: t('nav.home'), icon: 'home', isActive: activeView === 'home' }
      ]
    },
    {
      id: 'group_plan',
      groupLabel: t('nav.plan'),
      items: [
        {
          id: 'plan_overview', viewId: 'plan', subTabId: 'overview', label: t('nav.overview'), icon: 'planOverview',
          isActive: activeView === 'plan' && (planSubTab === 'overview' || !planSubTab)
        },
        {
          id: 'plan_wallets', viewId: 'plan', subTabId: 'wallets', label: t('nav.wallets'), icon: 'wallets',
          isActive: activeView === 'plan' && planSubTab === 'wallets'
        },
        {
          id: 'plan_budgets', viewId: 'plan', subTabId: 'budgets', label: t('nav.budgets'), icon: 'budgets',
          isActive: activeView === 'plan' && planSubTab === 'budgets'
        },
        {
          id: 'plan_recurring', viewId: 'plan', subTabId: 'recurring', label: t('nav.recurring'), icon: 'recurring',
          isActive: activeView === 'plan' && planSubTab === 'recurring'
        },
        {
          id: 'plan_debts', viewId: 'plan', subTabId: 'debts', label: t('nav.debts'), icon: 'debts',
          isActive: activeView === 'plan' && planSubTab === 'debts'
        }
      ]
    },
    {
      id: 'group_analytics',
      groupLabel: t('nav.analytics'),
      items: [
        {
          id: 'analytics_overview', viewId: 'analytics', subTabId: 'overview', label: t('nav.overview'), icon: 'analyticsOverview',
          isActive: activeView === 'analytics' && (analyticsSubTab === 'overview' || !analyticsSubTab)
        },
        {
          id: 'analytics_spending', viewId: 'analytics', subTabId: 'spending', label: t('nav.spending'), icon: 'spending',
          isActive: activeView === 'analytics' && analyticsSubTab === 'spending'
        },
        {
          id: 'analytics_cashflow', viewId: 'analytics', subTabId: 'cash-flow', label: t('nav.cashFlowTrend'), icon: 'cashFlow',
          isActive: activeView === 'analytics' && analyticsSubTab === 'cash-flow'
        },
        {
          id: 'analytics_reports', viewId: 'analytics', subTabId: 'reports', label: t('nav.reports'), icon: 'reports',
          isActive: activeView === 'analytics' && analyticsSubTab === 'reports'
        },
        {
          id: 'analytics_transactions', viewId: 'analytics', subTabId: 'transactions', label: t('nav.transactionHistory'), icon: 'transactions',
          isActive: activeView === 'analytics' && analyticsSubTab === 'transactions'
        }
      ]
    },
    {
      id: 'group_jars',
      groupLabel: t('nav.jars'),
      items: [
        {
          id: 'jars_goals', viewId: 'jars', subTabId: 'goals', label: t('nav.goals'), icon: 'goals',
          isActive: activeView === 'jars' && (jarsSubTab === 'goals' || !jarsSubTab)
        },
        {
          id: 'jars_list', viewId: 'jars', subTabId: 'jars', label: t('nav.jarList'), icon: 'jarList',
          isActive: activeView === 'jars' && jarsSubTab === 'jars'
        },
        {
          id: 'jars_history', viewId: 'jars', subTabId: 'history', label: t('nav.history'), icon: 'jarHistory',
          isActive: activeView === 'jars' && jarsSubTab === 'history'
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
            <HamburgerIcon size={18} />
          </button>
        </div>
      )}

      <div className="sidebar-scrollable-content">
        {navGroups.map((group, gIdx) => {
          // The icon-only rail has no group headers, so every item stays reachable there.
          const isGroupOpen = isSidebarCollapsed || !collapsedGroups.includes(group.id);
          const hasActiveItem = group.items.some((item) => item.isActive);
          const itemsId = `sidebar-${group.id}-items`;

          return (
            <div
              key={group.id}
              className={`sidebar-nav-group${isGroupOpen ? '' : ' is-group-collapsed'}${hasActiveItem ? ' has-active-item' : ''}`}
            >
              {!isSidebarCollapsed && (
                <div className="sidebar-group-header-row">
                  <button
                    type="button"
                    className="sidebar-group-toggle"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isGroupOpen}
                    aria-controls={itemsId}
                  >
                    <span className="sidebar-group-label">
                      <span className="sidebar-group-dot" aria-hidden="true" />
                      <span>{group.groupLabel}</span>
                    </span>
                    <Icon name="chevronDownAlt" className="sidebar-group-chevron" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                  </button>
                  {gIdx === 0 && (
                    <button
                      type="button"
                      className="sidebar-hamburger-btn"
                      onClick={toggleSidebar}
                      aria-label={t('nav.collapse')}
                      title={t('nav.collapse')}
                    >
                      <HamburgerIcon size={17} />
                    </button>
                  )}
                </div>
              )}
              <div id={itemsId} className="sidebar-group-collapse" inert={!isGroupOpen}>
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
                        <NavIcon name={item.icon} />
                      </span>
                      {!isSidebarCollapsed && (
                        <span className="sidebar-item-label">{item.label}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Quick Record Widget Card (Bottom Sidebar) ── */}
        {!isSidebarCollapsed && (
          <div className="sidebar-quick-record-card">
            <div className="quick-record-header">
              <div className="quick-record-icon-box" aria-hidden="true">
                <Icon name="edit" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
