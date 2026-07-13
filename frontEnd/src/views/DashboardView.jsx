/* ============================================================
   CaltDHy — views/DashboardView.jsx
   Daily logs view: Envelope Budgets & Transaction Feed.
   Đã khôi phục hoàn toàn cấu trúc DOM và class CSS gốc để hiển thị đúng UI.
   ============================================================ */

import { useState, useMemo } from 'react';
import { t, tCat, getCatIcon } from '../utils/i18n';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'DATE: NEWEST' },
  { value: 'date-asc', label: 'DATE: OLDEST' },
  { value: 'amount-desc', label: 'AMOUNT: HIGH' },
  { value: 'amount-asc', label: 'AMOUNT: LOW' },
];

export default function DashboardView({ txState, formatCurrency, onOpenBudgetModal, lang = 'vi' }) {
  const {
    transactions,
    budgets,
    getAllCategories,
    getCategoryType,
    deleteTransaction,
  } = txState;

  // ── Filter & Sort states ──
  const [filterPeriod, setFilterPeriod] = useState('month'); // 'month' | 'all'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'income' | 'expense'
  const [sort, setSort] = useState('date-desc');
  const [sortOpen, setSortOpen] = useState(false);

  const categories = getAllCategories();

  // ── Filtered & sorted transactions ──
  const filteredTxns = useMemo(() => {
    let list = [...transactions];

    // Period filter
    if (filterPeriod === 'month') {
      const today = new Date();
      const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      list = list.filter(tx => tx.date.startsWith(currentMonthPrefix));
    }

    // Type filter
    if (filterType !== 'all') {
      list = list.filter(tx => tx.type === filterType);
    }

    // Sort
    list.sort((a, b) => {
      if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sort === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sort === 'amount-desc') return b.amount - a.amount;
      if (sort === 'amount-asc') return a.amount - b.amount;
      return 0;
    });

    return list;
  }, [transactions, filterPeriod, filterType, sort]);

  // ── Compute budgets ──
  const budgetList = useMemo(() => {
    const today = new Date();
    const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    return categories
      .filter(cat => budgets[cat] && budgets[cat] > 0)
      .map(cat => {
        const limit = budgets[cat];
        const spentAmt = transactions
          .filter(t => t.category === cat && t.type === 'expense' && t.date.startsWith(currentMonthPrefix))
          .reduce((sum, t) => sum + t.amount, 0);

        const remaining = limit - spentAmt;
        const pct = Math.min(100, (spentAmt / limit) * 100);

        const overBudget = remaining < 0;
        const nearLimit = !overBudget && (spentAmt / limit) >= 0.8;

        const statusCls = overBudget ? 'budget-card--over' : nearLimit ? 'budget-card--warn' : 'budget-card--ok';
        const barCls = overBudget ? 'budget-bar__fill--over' : nearLimit ? 'budget-bar__fill--warn' : 'budget-bar__fill--ok';

        return {
          cat,
          limit,
          spentAmt,
          remaining,
          pct,
          overBudget,
          statusCls,
          barCls,
        };
      });
  }, [categories, budgets, transactions]);

  return (
    <div id="view-home" className="dashboard-view active">
      {/* ── 1. Envelope Budgets Section ── */}
      <section className="budget-section" aria-labelledby="budget-heading">
        <div className="budget-section__header">
          <h2 className="section-label" id="budget-heading">{t('budgetPanel', lang)}</h2>
          <div className="budget-header-actions">
            <button className="btn-set-budgets" onClick={onOpenBudgetModal} aria-haspopup="dialog">
              {t('setBudgets', lang)}
            </button>
          </div>
        </div>

        {budgetList.length === 0 ? (
          <div className="budget-panel">
            <p style={{ opacity: 0.4, fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              // {t('budgetEmpty', lang).toUpperCase()}
            </p>
          </div>
        ) : (
          <div className="budget-panel">
            {budgetList.map(({ cat, limit, remaining, pct, overBudget, statusCls, barCls }) => (
              <div key={cat} className={`budget-card ${statusCls}`}>
                <div className="budget-card__header">
                  <span className="budget-card__icon">{getCatIcon(cat)}</span>
                  <span className="budget-card__name">{tCat(cat, lang)}</span>
                  <span className="budget-card__led budget-card__drag-handle" aria-hidden="true"></span>
                </div>
                <div className="budget-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
                  <div className={`budget-bar__fill ${barCls}`} style={{ width: `${pct}%` }}></div>
                </div>
                <div className="budget-card__footer">
                  <span className={`budget-card__remaining ${overBudget ? 'over' : ''}`}>
                    {overBudget
                      ? `⚠ ${formatCurrency(Math.abs(remaining))} ${t('budgetOver', lang).toUpperCase()}`
                      : `${formatCurrency(remaining)} ${t('budgetLeft', lang)}`}
                  </span>
                  <span className="budget-card__limit">/ {formatCurrency(limit)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Transaction Feed Section ── */}
      <section className="feed-section" aria-labelledby="feed-heading">
        <div className="feed-toolbar">
          <div className="feed-header-left">
            <h2 className="section-label" id="feed-heading">{t('transactionFeed', lang)}</h2>

            {/* Period filter group */}
            <div className="feed-period-group" role="group" aria-label="Period filter">
              <button
                className={`period-btn${filterPeriod === 'month' ? ' period-btn--active' : ''}`}
                onClick={() => setFilterPeriod('month')}
              >
                {t('periodThisMonth', lang).toUpperCase()}
              </button>
              <button
                className={`period-btn${filterPeriod === 'all' ? ' period-btn--active' : ''}`}
                onClick={() => setFilterPeriod('all')}
              >
                {t('periodAllTime', lang).toUpperCase()}
              </button>
            </div>

            {/* Sort Dropdown Trigger */}
            <div className={`feed-sort-wrapper${sortOpen ? ' open' : ''}`}>
              <button
                className="feed-sort-btn"
                onClick={() => setSortOpen(!sortOpen)}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                title={lang === 'vi' ? 'Sắp xếp giao dịch' : 'Sort transactions'}
                type="button"
              >
                <svg className="feed-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {sortOpen && (
                <div className="feed-sort-dropdown" role="listbox" style={{ opacity: 1, visibility: 'visible', transform: 'translateY(0) scale(1)' }}>
                  <div className="feed-sort-section-label">
                    {lang === 'vi' ? 'SẮP XẾP GIAO DỊCH' : 'SORT TRANSACTIONS'}
                  </div>
                  {SORT_OPTIONS.map(opt => {
                    const getSortLabel = (val) => {
                      if (val === 'date-desc') return t('sortDateDesc', lang).toUpperCase();
                      if (val === 'date-asc') return t('sortDateAsc', lang).toUpperCase();
                      if (val === 'amount-desc') return t('sortAmountDesc', lang).toUpperCase();
                      if (val === 'amount-asc') return t('sortAmountAsc', lang).toUpperCase();
                      return '';
                    };
                    return (
                      <button
                        key={opt.value}
                        className={`feed-sort-option${sort === opt.value ? ' active' : ''}`}
                        onClick={() => {
                          setSort(opt.value);
                          setSortOpen(false);
                        }}
                        role="option"
                        aria-selected={sort === opt.value}
                      >
                        {getSortLabel(opt.value)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Type filters */}
          <div className="filter-group" role="group" aria-label="Filter transactions">
            <button
              className={`filter-btn${filterType === 'all' ? ' filter-btn--active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              {t('filterAll', lang)}
            </button>
            <button
              className={`filter-btn${filterType === 'income' ? ' filter-btn--active' : ''}`}
              onClick={() => setFilterType('income')}
            >
              {t('filterIncome', lang)}
            </button>
            <button
              className={`filter-btn${filterType === 'expense' ? ' filter-btn--active' : ''}`}
              onClick={() => setFilterType('expense')}
            >
              {t('filterExpense', lang)}
            </button>
          </div>
        </div>

        <div className="txn-feed" id="txnFeed" aria-live="polite">
          {filteredTxns.length === 0 ? (
            <div className="txn-empty">
              {t('noTxn', lang)}<br />
              {t('pressAdd', lang)}
            </div>
          ) : (
            filteredTxns.map(txn => (
              <div key={txn._id || txn.id} className="txn-slot" data-type={txn.type} data-id={txn._id || txn.id}>
                <div className="txn-icon">{getCatIcon(txn.category)}</div>
                <div className="txn-info">
                  <div className="txn-name">{txn.note || txn.desc || (lang === 'vi' ? 'Không có mô tả' : 'No description')}</div>
                  <div className="txn-meta">
                    {tCat(txn.category, lang).toUpperCase()} &middot; {new Date(txn.date).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                  </div>
                </div>
                <div className={`txn-amount ${txn.type === 'expense' ? 'neg' : 'pos'}`}>
                  {txn.type === 'expense' ? '−' : '+'}{formatCurrency(txn.amount)}
                </div>
                <button
                  className="txn-delete"
                  onClick={() => deleteTransaction(txn._id || txn.id)}
                  title="Delete"
                  aria-label="Delete transaction"
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
