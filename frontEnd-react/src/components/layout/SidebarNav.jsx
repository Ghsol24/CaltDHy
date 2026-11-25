import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NavIcon } from '../ui/NavIcons';
import { scrollToSection } from '../../utils/scrollToSection';
import { SidebarResizeHandle } from './SidebarResizeHandle';
import { readSidebarWidth, saveSidebarWidth } from './sidebarWidth';
import { groupIdForView, normalizePinnedGroups } from './sidebarGroups';
import { Icon } from '../../components/ui/AppIcons';

// Chờ đủ lâu để lướt chuột dọc qua sidebar không làm nhóm bung nhầm; chỉ thu nhóm xem tạm
// khi chuột đã rời hẳn sidebar để không làm các mục bên dưới nhảy lên dưới con trỏ (15f).
const HOVER_OPEN_DELAY_MS = 180;
const HOVER_CLOSE_DELAY_MS = 200;

function isMousePointer(event) {
  return !event?.pointerType || event.pointerType === 'mouse';
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

  const [pinnedGroups, setPinnedGroups] = useState(() => (
    normalizePinnedGroups(useAuthStore.getState().user?.preferences?.sidebarPinnedGroups)
  ));
  const [previewGroupIds, setPreviewGroupIds] = useState([]);
  const [dismissedGroupId, setDismissedGroupId] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);

  const activeViewGroupId = groupIdForView(activeView);
  // Thu gọn nhóm đang xem chỉ có hiệu lực tới khi sang nhóm khác; quay lại thì nhóm tự mở như cũ.
  useEffect(() => { setDismissedGroupId(null); }, [activeViewGroupId]);
  const effectiveDismissedId = dismissedGroupId === activeViewGroupId ? dismissedGroupId : null;

  const pinnedGroupsRef = useRef(pinnedGroups);
  const previewGroupIdsRef = useRef(previewGroupIds);
  const dismissedGroupIdRef = useRef(effectiveDismissedId);
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const pointerInSidebarRef = useRef(false);
  const pointerInsideGroupRef = useRef(null);
  const suppressedHoverRef = useRef(null);

  pinnedGroupsRef.current = pinnedGroups;
  previewGroupIdsRef.current = previewGroupIds;
  dismissedGroupIdRef.current = effectiveDismissedId;

  const clearOpenTimer = () => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const updatePreviewGroups = (next) => {
    previewGroupIdsRef.current = next;
    setPreviewGroupIds(next);
  };

  const commitPinnedGroups = (next) => {
    const normalized = normalizePinnedGroups(next);
    pinnedGroupsRef.current = normalized;
    setPinnedGroups(normalized);
    useAuthStore.getState().updatePreferences({ sidebarPinnedGroups: normalized }).catch(() => {});
  };

  const commitSidebarWidth = (width) => {
    setSidebarWidth(width);
    saveSidebarWidth(width);
  };

  useEffect(() => {
    if (!isSidebarCollapsed) return;
    clearOpenTimer();
    clearCloseTimer();
    pointerInsideGroupRef.current = null;
    suppressedHoverRef.current = null;
    updatePreviewGroups([]);
  }, [isSidebarCollapsed]);

  useEffect(() => () => {
    clearOpenTimer();
    clearCloseTimer();
  }, []);

  const toggleGroup = (groupId) => {
    clearOpenTimer();
    const isPinned = pinnedGroupsRef.current.includes(groupId);
    const isActive = activeViewGroupId === groupId && dismissedGroupIdRef.current !== groupId;
    const withoutGroup = previewGroupIdsRef.current.filter((id) => id !== groupId);

    if (isPinned) {
      commitPinnedGroups(pinnedGroupsRef.current.filter((id) => id !== groupId));
      if (activeViewGroupId === groupId) {
        dismissedGroupIdRef.current = groupId;
        setDismissedGroupId(groupId);
      }
      if (withoutGroup.length !== previewGroupIdsRef.current.length) {
        updatePreviewGroups(withoutGroup);
      }
      if (pointerInsideGroupRef.current === groupId) {
        suppressedHoverRef.current = groupId;
      }
      return;
    }

    if (isActive) {
      dismissedGroupIdRef.current = groupId;
      setDismissedGroupId(groupId);
      if (withoutGroup.length !== previewGroupIdsRef.current.length) {
        updatePreviewGroups(withoutGroup);
      }
      if (pointerInsideGroupRef.current === groupId) {
        suppressedHoverRef.current = groupId;
      }
      return;
    }

    commitPinnedGroups([...pinnedGroupsRef.current, groupId]);
    if (dismissedGroupIdRef.current === groupId) {
      dismissedGroupIdRef.current = null;
      setDismissedGroupId(null);
    }
    if (withoutGroup.length !== previewGroupIdsRef.current.length) {
      updatePreviewGroups(withoutGroup);
    }
    suppressedHoverRef.current = null;
  };

  const handleGroupPointerEnter = (groupId, event) => {
    if (isSidebarCollapsed || !isMousePointer(event)) return;
    if (document.documentElement.classList.contains('is-resizing-sidebar')) return;

    pointerInSidebarRef.current = true;
    pointerInsideGroupRef.current = groupId;
    clearCloseTimer();
    clearOpenTimer();

    if (suppressedHoverRef.current === groupId) return;
    const isAlreadyOpen = pinnedGroupsRef.current.includes(groupId)
      || (activeViewGroupId === groupId && dismissedGroupIdRef.current !== groupId)
      || previewGroupIdsRef.current.includes(groupId);
    if (isAlreadyOpen) return;

    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      if (pointerInsideGroupRef.current !== groupId) return;
      if (pinnedGroupsRef.current.includes(groupId) || previewGroupIdsRef.current.includes(groupId)) return;
      updatePreviewGroups([...previewGroupIdsRef.current, groupId]);
    }, HOVER_OPEN_DELAY_MS);
  };

  const handleGroupPointerLeave = (groupId, event) => {
    if (!isMousePointer(event)) return;
    if (pointerInsideGroupRef.current === groupId) {
      pointerInsideGroupRef.current = null;
    }
    if (suppressedHoverRef.current === groupId) {
      suppressedHoverRef.current = null;
    }
    clearOpenTimer();
  };

  const handleSidebarPointerEnter = (event) => {
    if (!isMousePointer(event)) return;
    pointerInSidebarRef.current = true;
    clearCloseTimer();
  };

  const handleSidebarPointerLeave = (event) => {
    if (!isMousePointer(event)) return;
    pointerInSidebarRef.current = false;
    pointerInsideGroupRef.current = null;
    suppressedHoverRef.current = null;
    clearOpenTimer();
    if (previewGroupIdsRef.current.length > 0 && closeTimerRef.current === null) {
      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        if (!pointerInSidebarRef.current && previewGroupIdsRef.current.length > 0) {
          updatePreviewGroups([]);
        }
      }, HOVER_CLOSE_DELAY_MS);
    }
  };

  const handleNavClick = (viewId, subTabId, sectionId) => {
    const nextGroupId = groupIdForView(viewId);
    const wasPrevActive = Boolean(activeViewGroupId) && dismissedGroupIdRef.current !== activeViewGroupId;

    if (nextGroupId && dismissedGroupIdRef.current === nextGroupId) {
      dismissedGroupIdRef.current = null;
      setDismissedGroupId(null);
    }

    let nextPreviews = previewGroupIdsRef.current.filter((id) => id !== nextGroupId);
    if (wasPrevActive && activeViewGroupId !== nextGroupId
      && !pinnedGroupsRef.current.includes(activeViewGroupId)
      && pointerInSidebarRef.current && !isSidebarCollapsed && window.innerWidth > 900
      && !nextPreviews.includes(activeViewGroupId)) {
      nextPreviews = [...nextPreviews, activeViewGroupId];
    }
    if (nextPreviews.length !== previewGroupIdsRef.current.length
      || nextPreviews.some((id, idx) => id !== previewGroupIdsRef.current[idx])) {
      updatePreviewGroups(nextPreviews);
    }

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
      style={{ '--sidebar-width': `${sidebarWidth}px` }}
      aria-label={t('nav.mainNavigation')}
      onPointerEnter={handleSidebarPointerEnter}
      onPointerLeave={handleSidebarPointerLeave}
    >
      {/* Logo + nút thu gọn ở đầu sidebar: máy tính không còn topbar (đợt 15b). Thu gọn thì
          chỉ còn ô "C", nút mở rộng nằm ngay dưới. */}
      <div className="sidebar-brand">
        <Link
          to="/spending/home"
          className="sidebar-brand__link"
          aria-label={t('topbar.home')}
          title={isSidebarCollapsed ? t('topbar.home') : undefined}
          onClick={() => handleNavClick('home')}
        >
          <span className="tb-logo-icon" data-brand-mark="">C</span>
          {!isSidebarCollapsed && (
            <span className="tb-logo">
              Calt<span className="tb-logo-accent">D</span>Hy
            </span>
          )}
        </Link>
        <button
          type="button"
          className="sidebar-hamburger-btn"
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? t('nav.expand') : t('nav.collapse')}
          title={isSidebarCollapsed ? t('nav.expand') : t('nav.collapse')}
        >
          <HamburgerIcon size={17} />
        </button>
      </div>

      <div className="sidebar-scrollable-content">
        {navGroups.map((group) => {
          if (group.standalone && !isSidebarCollapsed) {
            return (
              <div key={group.id} className="sidebar-nav-group sidebar-nav-group--standalone">
                <div className="sidebar-group-items">{group.items.map(renderItem)}</div>
              </div>
            );
          }
          // The icon-only rail has no group headers, so every item stays reachable there.
          const isPinned = pinnedGroups.includes(group.id);
          const isActive = activeViewGroupId === group.id && effectiveDismissedId !== group.id;
          const isPreview = previewGroupIds.includes(group.id);
          const openReason = !isSidebarCollapsed
            ? (isPinned ? 'pinned' : isActive ? 'active' : isPreview ? 'preview' : null)
            : null;
          const isGroupOpen = isSidebarCollapsed || Boolean(openReason);
          const isHoverOpen = openReason === 'preview';
          const hasActiveItem = group.items.some((item) => item.isActive);
          const itemsId = `sidebar-${group.id}-items`;
          const headerTitle = openReason === 'pinned' || openReason === 'active'
            ? t('nav.collapseGroup')
            : t('nav.keepGroupOpen');

          return (
            <div
              key={group.id}
              className={`sidebar-nav-group${isGroupOpen ? '' : ' is-group-collapsed'}${!isSidebarCollapsed && isPinned ? ' is-group-pinned' : ''}${isHoverOpen ? ' is-hover-open' : ''}${hasActiveItem ? ' has-active-item' : ''}`}
              data-pinned={!isSidebarCollapsed && isPinned ? 'true' : undefined}
              data-open-reason={openReason || undefined}
              onPointerEnter={(event) => handleGroupPointerEnter(group.id, event)}
              onPointerLeave={(event) => handleGroupPointerLeave(group.id, event)}
            >
              {!isSidebarCollapsed && (
                <div className="sidebar-group-header-row">
                  <button
                    type="button"
                    className="sidebar-group-toggle"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isGroupOpen}
                    aria-controls={itemsId}
                    title={headerTitle}
                  >
                    <span className="sidebar-group-label">{group.groupLabel}</span>
                    <Icon name="chevronDownAlt" className="sidebar-group-chevron" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                  </button>
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

      {/* Kéo mép phải để đổi độ rộng (đợt 15c); dạng thu gọn giữ cố định 72px. */}
      {!isSidebarCollapsed && (
        <SidebarResizeHandle
          width={sidebarWidth}
          onChange={setSidebarWidth}
          onCommit={commitSidebarWidth}
        />
      )}
    </aside>
  );
}
