import { useMemo } from 'react';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

/**
 * SVG Donut Chart for Wallet Balance Distribution
 * Clean, seamless, interactive donut chart without messy floating labels
 */
export function WalletDonutChart({
  slices,
  totalBalance,
  hoveredId,
  onHoverSlice,
  centerLabel = 'Tổng số dư',
  isCountMode = false
}) {
  const size = 260;
  const strokeWidth = 34;
  const center = size / 2; // 130
  const radius = 94;
  const circumference = 2 * Math.PI * radius; // ~590.62

  const hoveredSlice = useMemo(() => {
    if (!hoveredId || !slices) return null;
    return slices.find((s) => s.id === hoveredId) || null;
  }, [hoveredId, slices]);

  if (!slices || slices.length === 0 || totalBalance <= 0) {
    return (
      <div className="wallet-donut-svg-wrapper">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="wallet-donut-svg"
          role="img"
          aria-label="Biểu đồ phân bổ chưa có dữ liệu"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--donut-track-bg, #F1F5F9)"
            strokeWidth={strokeWidth}
          />
        </svg>
        <div className="wallet-donut-center-overlay">
          <span className="donut-center-label">{centerLabel}</span>
          <strong className="donut-center-val">{formatCurrency(0)}</strong>
        </div>
      </div>
    );
  }

  // Phân tách giữa các lát cắt bằng khe 4px radial sắc nét chuẩn thiết kế Ảnh 1
  const hasMultiple = slices.length > 1;
  const gapLength = hasMultiple ? 4 : 0;

  let accumulatedPercent = 0;
  const sliceElements = [];

  slices.forEach((slice) => {
    const rawLength = (slice.percent / 100) * circumference;
    const dashLength = Math.max(0.5, rawLength - gapLength);
    const strokeDasharray = `${dashLength} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference + (hasMultiple ? gapLength / 2 : 0));

    accumulatedPercent += slice.percent;

    const isHovered = hoveredId === slice.id;

    sliceElements.push(
      <circle
        key={slice.id}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={slice.color}
        strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="butt"
        transform={`rotate(-90 ${center} ${center})`}
        className={`donut-slice-circle ${isHovered ? 'is-active-slice' : ''} donut-slice-circle--box`}
        style={{ '--donut-slice-circle-opacity': hoveredId && !isHovered ? 0.35 : 1 }}
        onMouseEnter={() => onHoverSlice && onHoverSlice(slice.id)}
        onMouseLeave={() => onHoverSlice && onHoverSlice(null)}
      />
    );
  });

  return (
    <div className="wallet-donut-svg-wrapper">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="wallet-donut-svg"
        role="img"
        aria-label="Biểu đồ phân bổ"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--donut-track-bg, #F1F5F9)"
          strokeWidth={strokeWidth}
        />
        {sliceElements}
      </svg>
      <div className="wallet-donut-center-overlay">
        {hoveredSlice ? (
          <>
            <span className="donut-center-label">
              {hoveredSlice.name} • {formatPercent(hoveredSlice.percent, { fractionDigits: 1 })}
            </span>
            <strong className="donut-center-val donut-center-val--tone" style={{ '--donut-center-val-color': hoveredSlice.color }}>
              {isCountMode ? `${hoveredSlice.balance} GD` : formatCurrency(hoveredSlice.balance)}
            </strong>
          </>
        ) : (
          <>
            <span className="donut-center-label">{centerLabel}</span>
            <strong className="donut-center-val">
              {isCountMode ? `${totalBalance} GD` : formatCurrency(totalBalance)}
            </strong>
          </>
        )}
      </div>
    </div>
  );
}
