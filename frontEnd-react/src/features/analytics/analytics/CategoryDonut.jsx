import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

// Canvas cannot read CSS variables, so resolve the category hues for the active theme here.
function readChartColors(slices, theme) {
  const styles = getComputedStyle(document.documentElement);
  const read = (name) => styles.getPropertyValue(name).trim();
  return { theme, slice: slices.map((item) => read(item.colorVar)), border: read('--color-surface') };
}

/**
 * Donut for the category split. Hovering or focusing a slice (or its list row) is controlled by
 * the parent through `activeIndex`, so both stay in step; the tooltip is replaced by the centre
 * label. Clicking a slice calls `onSelect`.
 */
export function CategoryDonut({ activeIndex, ariaLabel, label, onActiveChange, onSelect, prefersReducedMotion, slices, theme, total, totalLabel }) {
  const colors = useMemo(() => readChartColors(slices, theme), [slices, theme]);

  const data = useMemo(() => ({
    labels: slices.map((item) => label(item)),
    datasets: [{
      data: slices.map((item) => item.amount),
      backgroundColor: colors.slice,
      borderColor: colors.border,
      borderWidth: 2,
      hoverOffset: 0,
      offset: slices.map((_item, index) => (index === activeIndex ? 6 : 0)),
    }],
  }), [slices, colors, activeIndex, label]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 8 },
    cutout: '70%',
    onClick: (_event, elements) => {
      const index = elements[0]?.index;
      if (index !== undefined) onSelect(index);
    },
    onHover: (_event, elements, chart) => {
      chart.canvas.style.cursor = elements.length ? 'pointer' : 'default';
      onActiveChange(elements.length ? elements[0].index : null);
    },
    animation: prefersReducedMotion ? false : { duration: 550, easing: 'easeOutQuart' },
    resizeDelay: 150,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  }), [onActiveChange, onSelect, prefersReducedMotion]);

  const active = activeIndex === null ? null : slices[activeIndex];
  return (
    <div className="doughnut-canvas-box" onMouseLeave={() => onActiveChange(null)}>
      <Doughnut data={data} options={options} role="img" aria-label={ariaLabel} />
      <div className="doughnut-center-metric" aria-hidden="true">
        {active ? (
          <>
            <span className="doughnut-center-label doughnut-center-label--name">{label(active)}</span>
            <strong className="doughnut-center-val">{formatCurrency(active.amount)}</strong>
            <span className="doughnut-center-label">{formatPercent(active.percent)}</span>
          </>
        ) : (
          <>
            <span className="doughnut-center-label">{totalLabel}</span>
            <strong className="doughnut-center-val">{formatCurrency(total)}</strong>
          </>
        )}
      </div>
    </div>
  );
}
