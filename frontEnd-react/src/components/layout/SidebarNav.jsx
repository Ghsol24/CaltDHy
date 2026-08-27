import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';

export function SidebarNav() {
  const {
    activeView,
    setActiveView,
    planSubTab,
    setPlanSubTab,
    analyticsSubTab,
    setAnalyticsSubTab,
    jarsSubTab,
    setJarsSubTab,
    isSidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar
  } = useSpendingStore();

  const handleNavClick = (viewId, subTabId) => {
    setActiveView(viewId);
    if (viewId === 'plan' && subTabId) {
      setPlanSubTab(subTabId);
    } else if (viewId === 'analytics' && subTabId) {
      setAnalyticsSubTab(subTabId);
      const targetMap = {
        overview: 'analytics-overview',
        spending: 'analytics-spending',
        'cash-flow': 'analytics-cashflow',
        reports: 'analytics-reports'
      };
      const targetId = targetMap[subTabId] || 'analytics-overview';
      window.__caltdhy_programmatic_scroll = true;
      const scrollAction = () => {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setTimeout(() => {
          window.__caltdhy_programmatic_scroll = false;
        }, 800);
      };
      if (activeView === 'analytics') {
        scrollAction();
      } else {
        setTimeout(scrollAction, 100);
      }
    } else if (viewId === 'jars' && subTabId) {
      setJarsSubTab(subTabId);
      const targetMap = {
        jars: 'jars-section-list',
        goals: 'jars-section-goals',
        history: 'jars-section-history'
      };
      const targetId = targetMap[subTabId] || 'jars-section-list';
      window.__caltdhy_programmatic_scroll = true;
      const scrollAction = () => {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setTimeout(() => {
          window.__caltdhy_programmatic_scroll = false;
        }, 800);
      };
      if (activeView === 'jars') {
        scrollAction();
      } else {
        setTimeout(scrollAction, 120);
      }
    }

    if (window.innerWidth <= 900) {
      setSidebarCollapsed(true);
    }
  };

  const navGroups = [
    {
      id: 'group_home',
      groupLabel: 'TRANG CHỦ',
      items: [
        {
          id: 'home_main',
          viewId: 'home',
          label: 'Trang chủ',
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
      groupLabel: 'KẾ HOẠCH',
      items: [
        {
          id: 'plan_wallets',
          viewId: 'plan',
          subTabId: 'wallets',
          label: 'Ví & Tài khoản',
          isActive: activeView === 'plan' && (planSubTab === 'wallets' || !planSubTab),
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
          label: 'Hạn mức ngân sách',
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
          label: 'Khoản định kỳ',
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
      groupLabel: 'PHÂN TÍCH',
      items: [
        {
          id: 'analytics_overview',
          viewId: 'analytics',
          subTabId: 'overview',
          label: 'Tổng quan',
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
          label: 'Phân tích chi tiêu',
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
          label: 'Xu hướng dòng tiền',
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
          label: 'Báo cáo',
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
        }
      ]
    },
    {
      id: 'group_jars',
      groupLabel: 'HŨ CHI TIÊU',
      items: [
        {
          id: 'jars_goals',
          viewId: 'jars',
          subTabId: 'goals',
          label: 'Mục tiêu',
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
          label: 'Danh sách hũ',
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
          label: 'Lịch sử',
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
      aria-label="Điều hướng chính"
    >
      {/* Collapsed Top Toggle Button */}
      {isSidebarCollapsed && (
        <div className="sidebar-collapsed-header">
          <button
            type="button"
            className="sidebar-hamburger-btn"
            onClick={toggleSidebar}
            aria-label="Mở rộng thanh điều hướng"
            title="Mở rộng thanh điều hướng"
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
                    aria-label="Thu gọn thanh điều hướng"
                    title="Thu gọn thanh điều hướng"
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
      </div>
    </aside>
  );
}
