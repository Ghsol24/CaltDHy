import React, { useState } from 'react';
import { formatCurrency, formatDate } from '../../../utils/formatters';

const WIDTH = 600;
const HEIGHT = 120;
const PAD_Y = 10;

// Đường số dư dạng bậc thang: số dư chỉ đổi khi có giao dịch, không trượt dần giữa hai ngày.
function stepPath(points, x, y) {
  return points.map((p, i) => (i === 0
    ? `M${x(0)},${y(p.balance)}`
    : `H${x(i)}V${y(p.balance)}`)).join('');
}

/**
 * Số dư theo ngày trong khung chi tiết ví (đợt 15d). Rê chuột để xem số dư từng ngày;
 * trình đọc màn hình nghe tóm tắt đầu–cuối qua aria-label.
 */
export function WalletBalanceChart({ points, title }) {
  const [hover, setHover] = useState(null);
  const values = points.map((p) => p.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => (i / (points.length - 1)) * WIDTH;
  const y = (v) => PAD_Y + (1 - (v - min) / span) * (HEIGHT - PAD_Y * 2);
  const line = stepPath(points, x, y);
  const first = points[0];
  const last = points[points.length - 1];
  const change = last.balance - first.balance;
  const shown = hover === null ? null : points[hover];

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };

  return (
    <figure className="wallet-chart">
      <figcaption className="wallet-chart-head">
        <span className="wallet-chart-title">{title}</span>
        <span className={`wallet-chart-change${change < 0 ? ' is-negative' : change > 0 ? ' is-positive' : ''}`}>
          {change === 0 ? 'Không đổi' : `${change > 0 ? '+' : '−'}${formatCurrency(Math.abs(change))}`}
        </span>
      </figcaption>
      <div className="wallet-chart-plot" onPointerMove={handleMove} onPointerLeave={() => setHover(null)}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}: từ ${formatCurrency(first.balance)} ngày ${formatDate(first.date, 'short')} đến ${formatCurrency(last.balance)} hôm nay`}
        >
          <path className="wallet-chart-area" d={`${line}V${HEIGHT}H0Z`} />
          <path className="wallet-chart-line" d={line} vectorEffect="non-scaling-stroke" />
          {shown && <line className="wallet-chart-cursor" x1={x(hover)} x2={x(hover)} y1="0" y2={HEIGHT} vectorEffect="non-scaling-stroke" />}
        </svg>
        {shown && (
          // Kẹp trong 10–90% để nhãn không tràn khỏi mép khung.
          <div className="wallet-chart-tip" style={{ left: `${Math.min(90, Math.max(10, (hover / (points.length - 1)) * 100))}%` }} aria-hidden="true">
            <span>{formatDate(shown.date, 'short')}</span>
            <strong>{formatCurrency(shown.balance)}</strong>
          </div>
        )}
      </div>
      <div className="wallet-chart-axis" aria-hidden="true">
        <span>{formatDate(first.date, 'short')}</span>
        <span>Hôm nay</span>
      </div>
    </figure>
  );
}
