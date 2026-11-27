import React, { useId, useRef, useState } from 'react';
import { BrandMark } from '../../components/ui/BrandMark';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { LandingIcon } from './LandingIcons';

const TAB_IDS = ['home', 'budgets', 'jars', 'debts'];

const TAB_META = {
  home: { icon: 'home', group: 'overview' },
  budgets: { icon: 'budgets', group: 'plan' },
  jars: { icon: 'jars', group: 'savings' },
  debts: { icon: 'swap', group: 'plan' },
};

export function LandingAppPreview({ copy, lang }) {
  const [activeTab, setActiveTab] = useState('home');
  const tabRefs = useRef({});
  const baseId = useId();
  const p = copy.preview;

  const monthLabel = formatDate(new Date(), 'month', { locale: lang });

  const selectTab = (id, { focus = false } = {}) => {
    setActiveTab(id);
    const node = tabRefs.current[id];
    if (node) {
      if (focus) node.focus({ preventScroll: true });
      node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const handleTabKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % TAB_IDS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + TAB_IDS.length) % TAB_IDS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = TAB_IDS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(TAB_IDS[nextIndex], { focus: true });
  };

  const tabId = (id) => `${baseId}-tab-${id}`;

  return (
    <div className="lp-showcase-shell" role="region" aria-label={p.regionLabel}>
      <div className="lp-app-window">
        {/* Window Topbar — mirrors CaltDHy desktop & mobile header */}
        <div className="lp-app-chrome">
          <div className="lp-app-chrome-left">
            <div className="lp-window-dots" aria-hidden="true">
              <span className="lp-window-dot" />
              <span className="lp-window-dot" />
              <span className="lp-window-dot" />
            </div>
            <div className="lp-app-brand">
              <BrandMark className="lp-app-brand-mark" />
              <span className="lp-app-brand-name">
                Calt<span className="lp-brand-accent">D</span>Hy
              </span>
            </div>
          </div>

          <div className="lp-app-chrome-right">
            <span className="lp-app-month">{monthLabel}</span>
            <span className="lp-sample-pill">
              <span className="lp-sample-full">{p.sampleBadge}</span>
              <span className="lp-sample-short" aria-hidden="true">{p.sampleShort}</span>
            </span>
          </div>
        </div>

        {/* App Body: Container-query adapts between desktop sidebar + stage and mobile stacked frame */}
        <div className="lp-app-body">
          <aside className="lp-app-sidebar">
            <div className="lp-app-nav-heading" aria-hidden="true">{p.groups.overview}</div>
            <div
              className="lp-app-tablist"
              role="tablist"
              aria-label={p.tablistLabel}
            >
              {TAB_IDS.map((id, index) => {
                const selected = activeTab === id;
                return (
                  <button
                    key={id}
                    ref={(el) => { tabRefs.current[id] = el; }}
                    type="button"
                    role="tab"
                    id={tabId(id)}
                    className="lp-app-tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(id)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                  >
                    <LandingIcon name={TAB_META[id].icon} size={16} />
                    <span className="lp-app-tab-full">{p.tabs[id]}</span>
                    <span className="lp-app-tab-short" aria-hidden="true">{p.tabsShort[id]}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="lp-app-stage">
            {/* TAB 1: HOME */}
            <div
              role="tabpanel"
              aria-labelledby={tabId('home')}
              hidden={activeTab !== 'home'}
              tabIndex={activeTab === 'home' ? 0 : undefined}
              className="lp-panel"
            >
              <div className="lp-panel-inner">
                <div className="lp-stage-header">
                  <div>
                    <h3 className="lp-stage-title">{p.home.headline}</h3>
                  </div>
                  <span className="lp-mock-primary-btn" aria-hidden="true">
                    <LandingIcon name="plus" size={14} strokeWidth={2.2} />
                    <span>{p.addTxn}</span>
                  </span>
                </div>

                <div className="lp-home-grid">
                  <div className="lp-home-col-main">
                    {/* Real CaltDHy signature balance hero card */}
                    <div className="lp-balance-hero">
                      <span className="lp-balance-chip">{p.home.spendableLabel}</span>
                      <div className="lp-balance-amount">{formatCurrency(15095000)}</div>
                      <p className="lp-balance-note">{p.home.spendableNote}</p>
                      <div className="lp-balance-split">
                        <div className="lp-balance-sub">
                          <span className="lp-balance-sub-label">{p.home.spentLabel}</span>
                          <strong className="lp-balance-sub-val lp-balance-sub-val--out">
                            {formatCurrency(2905000, { showSign: true })}
                          </strong>
                        </div>
                        <div className="lp-balance-sub">
                          <span className="lp-balance-sub-label">{p.home.incomeLabel}</span>
                          <strong className="lp-balance-sub-val lp-balance-sub-val--in">
                            {formatCurrency(18000000, { showSign: true, isIncome: true })}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Forecast strip */}
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-head">
                        <span className="lp-mock-card-title">{p.home.forecastTitle}</span>
                      </div>
                      <div className="lp-forecast-row">
                        <div className="lp-forecast-stat">
                          <span className="lp-muted-label">{p.home.forecastBalanceLabel}</span>
                          <strong className="lp-stat-num">{formatCurrency(11296154)}</strong>
                        </div>
                        <div className="lp-forecast-stat">
                          <span className="lp-muted-label">{p.home.forecastRateLabel}</span>
                          <strong className="lp-stat-num lp-stat-num--success">84%</strong>
                        </div>
                      </div>
                      <p className="lp-muted-caption">{p.home.forecastPaceNote}</p>
                    </div>
                  </div>

                  {/* Plan side card */}
                  <div className="lp-home-col-side">
                    <div className="lp-mock-card">
                      <div className="lp-mock-card-head">
                        <span className="lp-mock-card-title">{p.home.planTitle}</span>
                      </div>
                      <div className="lp-progress-list">
                        <div className="lp-progress-row">
                          <div className="lp-progress-top">
                            <span className="lp-cat-label">
                              <LandingIcon name="shopping" size={14} />
                              {p.home.catShopping}
                            </span>
                            <span className="lp-cat-money">
                              {formatCurrency(1430000)} / {formatCurrency(2000000)}
                            </span>
                          </div>
                          <div className="lp-track"><span className="lp-fill lp-fill--primary" style={{ width: '72%' }} /></div>
                        </div>

                        <div className="lp-progress-row">
                          <div className="lp-progress-top">
                            <span className="lp-cat-label">
                              <LandingIcon name="food" size={14} />
                              {p.home.catFood}
                            </span>
                            <span className="lp-cat-money">
                              {formatCurrency(825000)} / {formatCurrency(1500000)}
                            </span>
                          </div>
                          <div className="lp-track"><span className="lp-fill lp-fill--success" style={{ width: '55%' }} /></div>
                        </div>

                        <div className="lp-progress-row">
                          <div className="lp-progress-top">
                            <span className="lp-cat-label">
                              <LandingIcon name="transport" size={14} />
                              {p.home.catTransport}
                            </span>
                            <span className="lp-cat-money">
                              {formatCurrency(650000)} / {formatCurrency(1000000)}
                            </span>
                          </div>
                          <div className="lp-track"><span className="lp-fill lp-fill--primary" style={{ width: '65%' }} /></div>
                        </div>
                      </div>
                    </div>

                    <div className="lp-status-callout lp-status-callout--success">
                      <LandingIcon name="check" size={15} strokeWidth={2.2} />
                      <span>{p.home.planStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB 2: BUDGETS */}
            <div
              role="tabpanel"
              aria-labelledby={tabId('budgets')}
              hidden={activeTab !== 'budgets'}
              tabIndex={activeTab === 'budgets' ? 0 : undefined}
              className="lp-panel"
            >
              <div className="lp-panel-inner">
                <div className="lp-mock-card lp-budget-hero">
                  <div className="lp-budget-hero-top">
                    <div>
                      <span className="lp-muted-label">{p.budgets.remainingLabel}</span>
                      <div className="lp-big-figure">{formatCurrency(1595000)}</div>
                    </div>
                    <span className="lp-tone-pill lp-tone-pill--success">{p.budgets.statusBadge}</span>
                  </div>

                  <div className="lp-budget-meter-wrap">
                    <div className="lp-budget-meter-meta">
                      <span>{p.budgets.spentPrefix} {formatCurrency(2905000)} · 65%</span>
                      <span>{p.budgets.limitPrefix} {formatCurrency(4500000)}</span>
                    </div>
                    <div className="lp-track lp-track--lg">
                      <span className="lp-fill lp-fill--success" style={{ width: '65%' }} />
                      <span className="lp-today-marker" style={{ left: '43%' }} aria-hidden="true" />
                    </div>
                    <div className="lp-today-caption">{p.budgets.todayMarker}</div>
                  </div>

                  <div className="lp-budget-kpis">
                    <div className="lp-budget-kpi">
                      <span className="lp-muted-label">{p.budgets.dailyLimitLabel}</span>
                      <strong className="lp-stat-num">{formatCurrency(88000)}</strong>
                      <span className="lp-muted-caption">{p.budgets.dailyLimitSub}</span>
                    </div>
                    <div className="lp-budget-kpi">
                      <span className="lp-muted-label">{p.budgets.rolloverLabel}</span>
                      <strong className="lp-stat-num lp-stat-num--success">{p.budgets.rolloverOn}</strong>
                      <span className="lp-muted-caption">{p.budgets.rolloverSub}</span>
                    </div>
                  </div>
                </div>

                <div className="lp-mock-card">
                  <div className="lp-mock-card-head">
                    <span className="lp-mock-card-title">{p.budgets.categoriesTitle}</span>
                  </div>
                  <div className="lp-budget-rows">
                    {[
                      { icon: 'shopping', name: p.home.catShopping, pct: 72, spent: 1430000, limit: 2000000, tone: 'warning' },
                      { icon: 'transport', name: p.home.catTransport, pct: 65, spent: 650000, limit: 1000000, tone: 'primary' },
                      { icon: 'food', name: p.home.catFood, pct: 55, spent: 825000, limit: 1500000, tone: 'success' },
                    ].map((row) => (
                      <div key={row.name} className="lp-budget-cat-row">
                        <div className="lp-cat-label">
                          <LandingIcon name={row.icon} size={15} />
                          <span>{row.name}</span>
                        </div>
                        <div className="lp-track"><span className={`lp-fill lp-fill--${row.tone}`} style={{ width: `${row.pct}%` }} /></div>
                        <span className="lp-budget-pct">{row.pct}%</span>
                        <span className="lp-cat-money">{formatCurrency(row.spent)} / {formatCurrency(row.limit)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* TAB 3: SAVINGS JARS */}
            <div
              role="tabpanel"
              aria-labelledby={tabId('jars')}
              hidden={activeTab !== 'jars'}
              tabIndex={activeTab === 'jars' ? 0 : undefined}
              className="lp-panel"
            >
              <div className="lp-panel-inner">
                <div className="lp-jars-summary">
                  <div>
                    <span className="lp-muted-label">{p.jars.totalLabel}</span>
                    <div className="lp-big-figure">{formatCurrency(32400000)}</div>
                  </div>
                  <span className="lp-tone-pill lp-tone-pill--info">{p.jars.countBadge}</span>
                </div>

                <div className="lp-jars-grid">
                  {p.jars.items.map((jar) => (
                    <div key={jar.name} className="lp-mock-card lp-jar-card">
                      <div className="lp-jar-card-head">
                        <span className="lp-jar-title">{jar.name}</span>
                        <span className={`lp-tone-pill lp-tone-pill--${jar.tone}`}>{jar.status}</span>
                      </div>
                      <div className="lp-jar-amounts">
                        <strong className="lp-stat-num">{formatCurrency(jar.saved)}</strong>
                        <span className="lp-muted-caption">/ {formatCurrency(jar.target)}</span>
                      </div>
                      <div className="lp-track">
                        <span className={`lp-fill lp-fill--${jar.tone === 'neutral' ? 'primary' : jar.tone}`} style={{ width: `${jar.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lp-status-callout lp-status-callout--neutral">
                  <LandingIcon name="swap" size={15} />
                  <span>{p.jars.internalNote}</span>
                </div>
              </div>
            </div>

            {/* TAB 4: RECURRING & DEBTS */}
            <div
              role="tabpanel"
              aria-labelledby={tabId('debts')}
              hidden={activeTab !== 'debts'}
              tabIndex={activeTab === 'debts' ? 0 : undefined}
              className="lp-panel"
            >
              <div className="lp-panel-inner">
                <div className="lp-debts-split">
                  <div className="lp-mock-card">
                    <div className="lp-mock-card-head">
                      <span className="lp-mock-card-title">{p.debts.recurringTitle}</span>
                    </div>
                    <div className="lp-ledger-list">
                      {p.debts.itemsRecurring.map((item) => (
                        <div key={item.name} className="lp-ledger-row">
                          <div className="lp-ledger-info">
                            <strong className="lp-ledger-name">{item.name}</strong>
                            <span className="lp-muted-caption">{item.meta}</span>
                          </div>
                          <div className="lp-ledger-right">
                            <span className={`lp-ledger-amount ${item.isIncome ? 'is-pos' : 'is-neg'}`}>
                              {formatCurrency(item.amount, { showSign: true, isIncome: item.isIncome })}
                            </span>
                            <span className={`lp-tone-pill ${item.done ? 'lp-tone-pill--success' : 'lp-tone-pill--primary'}`}>
                              {item.done ? p.debts.paid : p.debts.oneTap}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lp-mock-card">
                    <div className="lp-mock-card-head">
                      <span className="lp-mock-card-title">{p.debts.debtsTitle}</span>
                    </div>
                    <div className="lp-ledger-list">
                      {p.debts.itemsDebts.map((debt) => (
                        <div key={debt.person} className="lp-ledger-row">
                          <div className="lp-ledger-info">
                            <div className="lp-debt-name-row">
                              <span className={`lp-tone-pill ${debt.type === 'lent' ? 'lp-tone-pill--success' : 'lp-tone-pill--warning'}`}>
                                {debt.type === 'lent' ? p.debts.lentBadge : p.debts.borrowedBadge}
                              </span>
                              <strong className="lp-ledger-name">{debt.person}</strong>
                            </div>
                            <span className="lp-muted-caption">{debt.note}</span>
                          </div>
                          <div className="lp-ledger-right">
                            <span className="lp-ledger-amount">{formatCurrency(debt.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lp-status-callout lp-status-callout--neutral">
                  <LandingIcon name="shield" size={15} />
                  <span>{p.debts.debtNote}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile frame bottom navigation bar visual hint (visible only in narrow container) */}
        <div className="lp-app-mobile-dock" aria-hidden="true">
          <span className={`lp-dock-item ${activeTab === 'home' ? 'is-active' : ''}`}>
            <LandingIcon name="home" size={16} />
            <span>{p.mobileNav.home}</span>
          </span>
          <span className={`lp-dock-item ${activeTab === 'budgets' || activeTab === 'debts' ? 'is-active' : ''}`}>
            <LandingIcon name="plan" size={16} />
            <span>{p.mobileNav.plan}</span>
          </span>
          <span className="lp-dock-item">
            <LandingIcon name="analytics" size={16} />
            <span>{p.mobileNav.analytics}</span>
          </span>
          <span className={`lp-dock-item ${activeTab === 'jars' ? 'is-active' : ''}`}>
            <LandingIcon name="jars" size={16} />
            <span>{p.mobileNav.jars}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
