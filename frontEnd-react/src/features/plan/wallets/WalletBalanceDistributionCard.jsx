import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { WalletDonutChart } from './WalletDonutChart';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function WalletBalanceDistributionCard({ chartTotal, distDropdownRef, distributionMode, donutSlices, hoveredSliceId, isDistDropdownOpen, setDistributionMode, setHoveredSliceId, setIsDistDropdownOpen }) {
  return (
    <div className="wallets-side-card wallets-donut-card">
      <div className="side-card-header donut-card-header">
        <div className="donut-card-title-group">
          <div className="donut-header-icon-box" aria-hidden="true">
            <Icon name="pieChartFilled" width="20" height="20" fill="currentColor" />
          </div>
          <h3 className="side-card-title donut-card-title">Phân bổ số dư</h3>
        </div>
    
        <div className="donut-dist-dropdown-wrap" ref={distDropdownRef}>
          <button
            type="button"
            className="donut-dist-dropdown-trigger"
            onClick={() => setIsDistDropdownOpen((prev) => !prev)}
            aria-expanded={isDistDropdownOpen}
            aria-haspopup="listbox"
            title="Thay đổi cách tính tỷ lệ"
          >
            <Icon name="barChart" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <span>{distributionMode === 'balance' ? 'Tỷ lệ theo số dư' : 'Tỷ lệ theo giao dịch'}</span>
            <Icon name="chevronDown" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`donut-dropdown-chevron ${isDistDropdownOpen ? 'is-open' : ''}`} />
          </button>
    
          {isDistDropdownOpen && (
            <div className="donut-dist-dropdown-menu" role="listbox">
              <button
                type="button"
                role="option"
                aria-selected={distributionMode === 'balance'}
                className={`donut-dist-dropdown-item ${distributionMode === 'balance' ? 'is-active' : ''}`}
                onClick={() => {
                  setDistributionMode('balance');
                  setIsDistDropdownOpen(false);
                }}
              >
                <Icon name="dollar" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <span>Tỷ lệ theo số dư</span>
              </button>
              <button
                type="button"
                role="option"
                aria-selected={distributionMode === 'txCount'}
                className={`donut-dist-dropdown-item ${distributionMode === 'txCount' ? 'is-active' : ''}`}
                onClick={() => {
                  setDistributionMode('txCount');
                  setIsDistDropdownOpen(false);
                }}
              >
                <Icon name="activity" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <span>Tỷ lệ theo giao dịch</span>
              </button>
            </div>
          )}
        </div>
      </div>
    
      <div className="donut-chart-and-legend">
        <WalletDonutChart
          slices={donutSlices}
          totalBalance={chartTotal}
          hoveredId={hoveredSliceId}
          onHoverSlice={setHoveredSliceId}
          centerLabel={distributionMode === 'balance' ? 'Tổng số dư' : 'Tổng giao dịch'}
          isCountMode={distributionMode === 'txCount'}
        />
    
        <div className="donut-table-wrapper">
          <div className="donut-table-header">
            <span className="donut-th-cat">Danh mục</span>
            <span className="donut-th-pct">Tỷ lệ</span>
            <span className="donut-th-val">
              {distributionMode === 'balance' ? 'Số tiền' : 'Số GD'}
            </span>
            <span className="donut-th-spacer" aria-hidden="true" />
          </div>
    
          <div className="donut-table-card">
            {donutSlices.length === 0 ? (
              <div className="donut-table-empty">
                <span>Chưa có dữ liệu phân bổ</span>
              </div>
            ) : (
              donutSlices.map((slice) => {
                const isHovered = hoveredSliceId === slice.id;
                return (
                  <div
                    key={slice.id}
                    className={`donut-table-row ${isHovered ? 'is-hovered' : ''}`}
                    onMouseEnter={() => setHoveredSliceId(slice.id)}
                    onMouseLeave={() => setHoveredSliceId(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${slice.name}: ${formatPercent(slice.percent, { fractionDigits: 1 })}, ${distributionMode === 'balance' ? formatCurrency(slice.balance) : `${slice.balance} giao dịch`}`}
                  >
                    <div className="donut-row-cat">
                      <span
                        className="donut-row-dot donut-row-dot--tone"
                        style={{ '--donut-row-dot-background-color': slice.color }}
                        aria-hidden="true"
                      />
                      <span className="donut-row-name" title={slice.name}>
                        {slice.name}
                      </span>
                    </div>
    
                    <div className="donut-row-pct">
                      {formatPercent(slice.percent, { fractionDigits: 1 })}
                    </div>
    
                    <div className="donut-row-val">
                      {distributionMode === 'balance'
                        ? formatCurrency(slice.balance)
                        : `${slice.balance} GD`}
                    </div>
    
                    <div className="donut-row-chevron" aria-hidden="true">
                      <Icon name="chevronRight" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
    
          {donutSlices.length > 0 && (
            <div className="donut-table-footer">
              <Icon name="info" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <span>Tổng {donutSlices.length} danh mục</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
