import React, { useCallback, useMemo, useState } from 'react';
import { NavIcon } from '../../../components/ui/NavIcons';
import { Icon } from '../../../components/ui/AppIcons';
import { CategoryMark } from '../../../components/ui/CategoryMark';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';
import { CategoryDonut } from './CategoryDonut';
import { buildCategorySlices, OTHER_SLICE_KEY } from './categoryColors';

function CategoryRow({ active, ariaLabel, colorVar, expanded, icon, nested = false, onActivate, onClick, percent, amount, title }) {
  return (
    <li>
      <button
        type="button"
        className={`analytics-cat-item-row${active ? ' is-active' : ''}${nested ? ' analytics-cat-item-row--nested' : ''}`}
        style={{ '--cat-color': `var(${colorVar})` }}
        aria-label={ariaLabel}
        aria-expanded={expanded}
        onClick={onClick}
        onMouseEnter={() => onActivate(true)}
        onMouseLeave={() => onActivate(false)}
        onFocus={() => onActivate(true)}
        onBlur={() => onActivate(false)}
      >
        <span className="cat-swatch" aria-hidden="true" />
        <span className="cat-avatar-tile" aria-hidden="true">{icon}</span>
        <span className="cat-text-info">
          <span className="cat-title-text" title={title}>{title}</span>
          <span className="cat-progress-track" aria-hidden="true">
            <span className="cat-progress-fill" style={{ width: `${Math.max(2, percent)}%` }} />
          </span>
        </span>
        <span className="cat-figures">
          <strong className="cat-amount-text">{formatCurrency(amount)}</strong>
          <span className="cat-pct-badge">{formatPercent(percent)}</span>
        </span>
        <Icon name={expanded === undefined ? 'chevronRight' : 'chevronDown'} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`cat-chevron${expanded ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
    </li>
  );
}

export function AnalyticsCategorySection({ analyticsSubTab, isMobile, monthData, monthLabel, openAddTxnModal, prefersReducedMotion, theme, viewCategoryHistory }) {
  const { t, label } = useTranslation();
  const [activeKey, setActiveKey] = useState(null);
  const [showOthers, setShowOthers] = useState(false);

  const slices = useMemo(() => buildCategorySlices(monthData.categories), [monthData.categories]);
  const sliceTitle = useCallback((slice) => (slice.members
    ? t('analytics.category.other', { count: slice.members.length }) : label(slice.name)), [t, label]);
  const activeIndex = activeKey === null ? null : slices.findIndex((slice) => slice.key === activeKey);
  const safeActiveIndex = activeIndex === -1 ? null : activeIndex;

  const activateIndex = useCallback((index) => setActiveKey(index === null ? null : slices[index]?.key ?? null), [slices]);
  const selectSlice = useCallback((index) => {
    const slice = slices[index];
    if (!slice) return;
    if (slice.members) setShowOthers((open) => !open);
    else viewCategoryHistory(slice.name);
  }, [slices, viewCategoryHistory]);
  const describe = (slice, action) => `${action ? `${action} ` : ''}${sliceTitle(slice)}: ${formatCurrency(slice.amount)}, ${formatPercent(slice.percent)}`;

  return ((!isMobile || analyticsSubTab === 'spending') && (
  <>
  <div className="analytics-section-panel" id="analytics-spending">
    <div className="panel-header">
      <div className="panel-titles">
        <h2 className="panel-main-title panel-main-title--layout">
          <NavIcon name="spending" size={18} /> Chi tiêu theo danh mục
        </h2>
        <p className="panel-subtitle">
          {monthData.categories.length > 0
            ? t('analytics.category.subtitle', { count: monthData.categories.length })
            : 'Chưa có khoản chi nào trong tháng'}
        </p>
      </div>
    </div>

    {monthData.categories.length === 0 ? (
      /* Empty state: Bordered/dashed area, min-height 310px */
      <div className="analytics-empty-dashed-box">
        <div className="empty-pie-icon-tile" aria-hidden="true">
          <Icon name="pieChart" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </div>
        <strong className="empty-heading-caps">
          Chưa có dữ liệu chi tiêu trong {monthLabel}
        </strong>
        <p className="empty-body-desc">
          Thêm các giao dịch chi tiêu mới để hệ thống tự động phân loại và trực quan hóa tỷ trọng từng nhóm chi phí.
        </p>
        <button
          type="button"
          className="btn-add-txn-empty"
          onClick={openAddTxnModal}
        >
          + Thêm giao dịch ngay
        </button>
      </div>
    ) : (
      /* Data state: donut on the left, ranked list (one button per category) on the right */
      <div className="analytics-category-data-grid">
        <div className="category-chart-wrapper">
          <CategoryDonut
            slices={slices} total={monthData.expense} theme={theme} label={sliceTitle}
            activeIndex={safeActiveIndex} onActiveChange={activateIndex} onSelect={selectSlice}
            prefersReducedMotion={prefersReducedMotion} totalLabel="Tổng chi"
            ariaLabel={t('analytics.category.chartAria', { total: formatCurrency(monthData.expense) })}
          />
          <table className="analytics-sr-only">
            <caption>{t('analytics.category.chartAria', { total: formatCurrency(monthData.expense) })}</caption>
            <thead><tr><th scope="col">{t('analytics.category.colName')}</th><th scope="col">{t('analytics.category.colAmount')}</th><th scope="col">{t('analytics.category.colShare')}</th></tr></thead>
            <tbody>
              {monthData.categories.map((cat) => (
                <tr key={cat.name}><th scope="row">{label(cat.name)}</th><td>{formatCurrency(cat.amount)}</td><td>{formatPercent(cat.percent)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="category-ranked-list">
          {slices.map((slice) => {
            const isOther = slice.key === OTHER_SLICE_KEY;
            const active = slice.key === activeKey;
            const setActive = (on) => setActiveKey((current) => (on ? slice.key : (current === slice.key ? null : current)));
            return (
              <React.Fragment key={slice.key}>
                <CategoryRow
                  active={active}
                  ariaLabel={describe(slice, isOther ? '' : t('history.viewCategory'))}
                  colorVar={slice.colorVar}
                  expanded={isOther ? showOthers : undefined}
                  icon={isOther ? <Icon name="grid" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : <CategoryMark name={slice.name} size={15} />}
                  onActivate={setActive}
                  onClick={() => selectSlice(slices.indexOf(slice))}
                  percent={slice.percent}
                  amount={slice.amount}
                  title={sliceTitle(slice)}
                />
                {isOther && showOthers && slice.members.map((member) => (
                  <CategoryRow
                    key={member.name}
                    nested
                    active={false}
                    ariaLabel={describe({ ...member, members: null }, t('history.viewCategory'))}
                    colorVar={slice.colorVar}
                    icon={<CategoryMark name={member.name} size={15} />}
                    onActivate={() => {}}
                    onClick={() => viewCategoryHistory(member.name)}
                    percent={member.percent}
                    amount={member.amount}
                    title={label(member.name)}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    )}
  </div>
  </>
  )) || null;
}
