const PLAN_TABS = new Set(['overview', 'wallets', 'budgets', 'recurring']);
const ANALYTICS_TABS = new Set(['overview', 'spending', 'cash-flow', 'reports', 'transactions']);
const JARS_PATH_TO_TAB = { goals: 'goals', list: 'jars', history: 'history' };
const JARS_TAB_TO_PATH = { goals: 'goals', jars: 'list', history: 'history' };

const ROUTE_META = {
  home: { titleKey: 'nav.home', focus: '.home-dashboard-greeting' },
  'plan:overview': { titleKey: 'nav.overview', focus: '.plan-overview-title' },
  'plan:wallets': { titleKey: 'nav.wallets', focus: '.wallets-v2-heading' },
  'plan:budgets': { titleKey: 'nav.budgets', focus: '.budgets-view-title' },
  'plan:recurring': { titleKey: 'nav.recurring', focus: '.recurring-route-heading' },
  'analytics:overview': { titleKey: 'nav.overview', focus: '#analytics-overview' },
  'analytics:spending': { titleKey: 'nav.spending', focus: '#analytics-spending' },
  'analytics:cash-flow': { titleKey: 'nav.cashFlow', focus: '#analytics-cashflow' },
  'analytics:reports': { titleKey: 'nav.reports', focus: '#analytics-reports' },
  'analytics:transactions': { titleKey: 'nav.transactionHistory', focus: '#transaction-history-title' },
  'jars:goals': { titleKey: 'nav.goals', focus: '#jars-section-goals' },
  'jars:jars': { titleKey: 'nav.jarList', focus: '#jars-section-list' },
  'jars:history': { titleKey: 'nav.history', focus: '#jars-section-history' }
};

export function parseSpendingPath(pathname) {
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (segments[0] !== 'spending') return null;
  if (segments.length === 1 || segments[1] === 'home') return { view: 'home', subTab: null };

  const [view, rawSubTab] = [segments[1], segments[2] || 'overview'];
  if (segments.length > 3) return null;
  if (view === 'plan' && PLAN_TABS.has(rawSubTab)) return { view, subTab: rawSubTab };
  if (view === 'analytics' && ANALYTICS_TABS.has(rawSubTab)) return { view, subTab: rawSubTab };
  if (view === 'jars' && JARS_PATH_TO_TAB[rawSubTab]) return { view, subTab: JARS_PATH_TO_TAB[rawSubTab] };
  return null;
}

export function buildSpendingPath({ activeView, planSubTab, analyticsSubTab, jarsSubTab }) {
  if (activeView === 'plan') return `/spending/plan/${PLAN_TABS.has(planSubTab) ? planSubTab : 'overview'}`;
  if (activeView === 'analytics') return `/spending/analytics/${ANALYTICS_TABS.has(analyticsSubTab) ? analyticsSubTab : 'overview'}`;
  if (activeView === 'jars') return `/spending/jars/${JARS_TAB_TO_PATH[jarsSubTab] || 'goals'}`;
  return '/spending/home';
}

export function getSpendingRouteMeta(route) {
  const key = route.subTab ? `${route.view}:${route.subTab}` : route.view;
  return ROUTE_META[key] || ROUTE_META.home;
}
