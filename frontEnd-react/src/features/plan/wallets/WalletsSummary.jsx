import React from 'react';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

/**
 * Đầu trang Ví: một con số tổng và một thanh phân bổ duy nhất. Thay cho thẻ chỉ số,
 * biểu đồ vòng tròn, bảng chú thích và thanh % trong từng ví (cùng một dữ liệu ×3).
 */
export function WalletsSummary({ totalBalance, includedCount, slices }) {
  const percentText = (value) => formatPercent(value, { fractionDigits: 1 });
  return (
    <section className="wallets-summary" aria-labelledby="wallets-summary-label">
      <p id="wallets-summary-label" className="wallets-summary-label">{`Tổng số dư · ${includedCount} ví`}</p>
      <p className={`wallets-summary-total${totalBalance < 0 ? ' is-negative' : ''}`}>{formatCurrency(totalBalance)}</p>

      {slices.length > 0 && (
        <>
          <div className="wallets-alloc-bar" role="img" aria-label={`Phân bổ số dư: ${slices.map((s) => `${s.name} ${percentText(s.percent)}`).join(', ')}`}>
            {slices.map((s) => (
              <span
                key={s.id}
                className="wallets-alloc-seg"
                style={{ flexGrow: s.percent, ...(s.color ? { '--seg-color': s.color } : {}) }}
              />
            ))}
          </div>
          <ul className="wallets-alloc-legend" aria-hidden="true">
            {slices.map((s) => (
              <li key={s.id}>
                <span className="wallets-alloc-dot" style={s.color ? { '--seg-color': s.color } : undefined} />
                <span className="wallets-alloc-name">{s.name}</span>
                <span className="wallets-alloc-pct">{percentText(s.percent)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
