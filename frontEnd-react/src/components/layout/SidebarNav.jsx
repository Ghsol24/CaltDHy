import React, { useEffect, useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NavIcon } from '../ui/NavIcons';
import { scrollToSection } from '../../utils/scrollToSection';

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
  const analyticsInViewSection = useSpendingStore((s) => s.analyticsInViewSection);
  const jarsSubTab = useSpendingStore((s) => s.jarsSubTab);
  const isSidebarCollapsed = useSpendingStore((s) => s.isSidebarCollapsed);
  const setSidebarCollapsed = useSpendingStore((s) => s.setSidebarCollapsed);
  const toggleSidebar = useSpendingStore((s) => s.toggleSidebar);
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

  const handleNavClick = (viewId, subTabId, sectionId) => {
    // On the long computer "Tóm tắt thu chi" page the block is already here: glide to it
    // (the highlight follows) instead of opening its own screen. Elsewhere it is a page.
    if (sectionId && activeView === 'analytics'
      && analyticsSubTab === 'overview' && window.innerWidth > 900 && scrollToSection(sectionId)) {
      return;
    }
    navigateTo(viewId, subTabId);

    if (window.innerWidth <= 900) {
      setSidebarCollapsed(true);
    }
  };

  // On the long "Tóm tắt thu chi" page the highlight follows the block being read, so only
  // one item ever looks selected. The page keeps aria-current (the URL does not move) and
  // clicking an item scrolls to its block here (see handleNavClick).
  const overviewInView = activeView === 'analytics' && analyticsSubTab === 'overview'
    ? analyticsInViewSection : null;

  const navGroups = [
    {
      id: 'group_home',
      groupLabel: t('nav.home'),
      // A one-item group needs no header: "Trang chủ" stands on its own (NAV-03).
      standalone: true,
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
        }
      ]
    },
    {
      id: 'group_analytics',
      groupLabel: t('nav.analytics'),
      items: [
        {
          id: 'analytics_overview', viewId: 'analytics', subTabId: 'overview', label: t('nav.analyticsOverview'), icon: 'analyticsOverview',
          isActive: activeView === 'analytics' && (analyticsSubTab === 'overview' || !analyticsSubTab),
          // Reading a block below: the highlight moves to that block's item, this one fades.
          isShadowed: Boolean(overviewInView)
        },
        {
          id: 'analytics_spending', viewId: 'analytics', subTabId: 'spending', label: t('nav.spending'), icon: 'spending',
          isActive: activeView === 'analytics' && analyticsSubTab === 'spending',
          isInView: overviewInView === 'spending',
          sectionId: 'analytics-spending'
        },
        {
          id: 'analytics_cashflow', viewId: 'analytics', subTabId: 'cash-flow', label: t('nav.cashFlow'), icon: 'cashFlow',
          isActive: activeView === 'analytics' && analyticsSubTab === 'cash-flow',
          isInView: overviewInView === 'cash-flow',
          sectionId: 'analytics-cashflow'
        },
        {
          id: 'analytics_reports', viewId: 'analytics', subTabId: 'reports', label: t('nav.reports'), icon: 'reports',
          isActive: activeView === 'analytics' && analyticsSubTab === 'reports',
          isInView: overviewInView === 'reports',
          sectionId: 'analytics-reports'
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

  const renderItem = (item) => (
    <button
      key={item.id}
      type="button"
      className={`sidebar-nav-item ${item.isActive ? 'active' : ''}${item.isInView ? ' is-in-view' : ''}${item.isShadowed ? ' is-shadowed' : ''}`}
      onClick={() => handleNavClick(item.viewId, item.subTabId, item.sectionId)}
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
  );

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
          if (group.standalone && !isSidebarCollapsed) {
            return (
              <div key={group.id} className="sidebar-nav-group sidebar-nav-group--standalone">
                <div className="sidebar-standalone-row">
                  <div className="sidebar-group-items">{group.items.map(renderItem)}</div>
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
              </div>
            );
          }
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
                  {group.items.map(renderItem)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
