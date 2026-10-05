// Context belongs to the rendered chart so it follows resizing and theme changes.
export function cashFlowChartContext(readContext) {
  return {
    id: 'cashFlowContext',
    afterUpdate(chart) {
      // Report the actual rendered scale for regression checks and inspection.
      chart.canvas.dataset.scaleMin = String(chart.scales.y.min);
      chart.canvas.dataset.scaleMax = String(chart.scales.y.max);
      chart.canvas.dataset.visibleLabels = JSON.stringify(chart.data.labels);
      chart.canvas.dataset.pointPositions = JSON.stringify(chart.data.datasets.flatMap((_, datasetIndex) =>
        chart.getDatasetMeta(datasetIndex).data.map((element, index) => {
          const { x, y, base } = element.getProps(['x', 'y', 'base'], true);
          return { index, datasetIndex, x, y: (y + base) / 2 };
        })));
    },
    beforeDatasetsDraw(chart) {
      const { mode, days, today, colors, futureLabel } = readContext();
      if (mode !== 'daily') return;
      const firstFuture = days.findIndex((day) => day.date > today);
      if (firstFuture < 0) return;
      const { ctx, chartArea: area, scales: { x } } = chart;
      const categoryWidth = days.length > 1
        ? Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0)) : area.width;
      const left = Math.max(area.left, x.getPixelForValue(firstFuture) - categoryWidth / 2);
      const width = area.right - left;
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, area.top, width, area.height);
      ctx.clip();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = colors.future;
      ctx.fillRect(left, area.top, width, area.height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.tick;
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (width > ctx.measureText(futureLabel).width + 16) {
        ctx.fillText(futureLabel, left + width / 2, area.top + area.height / 2);
      }
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const { mode, months, today, colors, ongoingLabel } = readContext();
      if (mode === 'daily') return;
      const index = months.findIndex((month) => month.prefix === today.slice(0, 7));
      if (index < 0) return;
      const { ctx, chartArea: area, scales: { x } } = chart;
      ctx.save();
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = colors.tick;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const halfWidth = ctx.measureText(ongoingLabel).width / 2;
      const center = Math.max(area.left + halfWidth,
        Math.min(area.right - halfWidth, x.getPixelForValue(index)));
      ctx.fillText(ongoingLabel, center, area.top - 6);
      ctx.restore();
    },
  };
}
