const PLAN_TABS = new Set(['overview', 'wallets', 'budgets', 'recurring']);
const ANALYTICS_TABS = new Set(['overview', 'spending', 'cash-flow', 'reports', 'transactions']);
// Legacy sub-paths under /spending/jars/* stay valid bookmarks and redirect cleanly to /spending/jars.
const LEGACY_JARS_PATHS = new Set(['goals', 'list', 'history']);

// groupKey names the sidebar group so both "Tổng quan" pages get distinct tab titles.
const ROUTE_META = {
  home: { titleKey: 'nav.home', focus: '.home-dashboard-greeting' },
  'plan:overview': { groupKey: 'nav.plan', titleKey: 'nav.overview', focus: '.plan-overview-title' },
  'plan:wallets': { groupKey: 'nav.plan', titleKey: 'nav.wallets', focus: '.wallets-v2-heading' },
  'plan:budgets': { groupKey: 'nav.plan', titleKey: 'nav.budgets', focus: '.budgets-view-title' },
  'plan:recurring': { groupKey: 'nav.plan', titleKey: 'nav.recurring', focus: '.recurring-route-heading' },
  'analytics:overview': { groupKey: 'nav.analytics', titleKey: 'nav.analyticsOverview', focus: '#analytics-overview' },
  'analytics:spending': { groupKey: 'nav.analytics', titleKey: 'nav.spending', focus: '#analytics-spending' },
  'analytics:cash-flow': { groupKey: 'nav.analytics', titleKey: 'nav.cashFlow', focus: '#analytics-cashflow' },
  'analytics:reports': { groupKey: 'nav.analytics', titleKey: 'nav.reports', focus: '#analytics-reports' },
  'analytics:transactions': { groupKey: 'nav.analytics', titleKey: 'nav.transactionHistory', focus: '#transaction-history-title' },
  jars: { titleKey: 'nav.jars', focus: '.jars-hero-heading' },
};

export function parseSpendingPath(pathname) {
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (segments[0] !== 'spending') return null;
  if (segments.length === 1 || segments[1] === 'home') return { view: 'home', subTab: null };

  const view = segments[1];
  if (segments.length > 3) return null;

  if (view === 'jars') {
    if (segments.length === 2) return { view: 'jars', subTab: null };
    const legacy = segments[2];
    if (LEGACY_JARS_PATHS.has(legacy)) {
      return { view: 'jars', subTab: null, openDrawer: legacy === 'history' ? 'history' : null };
    }
    return null;
  }

  const rawSubTab = segments[2] || 'overview';
  if (view === 'plan' && PLAN_TABS.has(rawSubTab)) return { view, subTab: rawSubTab };
  if (view === 'analytics' && ANALYTICS_TABS.has(rawSubTab)) return { view, subTab: rawSubTab };
  return null;
}

export function buildSpendingPath({ activeView, planSubTab, analyticsSubTab }) {
  if (activeView === 'plan') return `/spending/plan/${PLAN_TABS.has(planSubTab) ? planSubTab : 'overview'}`;
  if (activeView === 'analytics') return `/spending/analytics/${ANALYTICS_TABS.has(analyticsSubTab) ? analyticsSubTab : 'overview'}`;
  if (activeView === 'jars') return '/spending/jars';
  return '/spending/home';
}

export function getSpendingRouteMeta(route) {
  const key = route.subTab ? `${route.view}:${route.subTab}` : route.view;
  return ROUTE_META[key] || ROUTE_META.home;
}
