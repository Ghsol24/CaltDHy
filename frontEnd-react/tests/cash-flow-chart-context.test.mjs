import test from 'node:test';
import assert from 'node:assert/strict';
import { cashFlowChartContext } from '../src/features/analytics/cashFlowChartContext.js';

const context = {
  mode: 'daily', days: [{ date: '2026-10-13' }, { date: '2026-10-14' }],
  months: [{ prefix: '2026-10' }], today: '2026-10-13',
  colors: { future: 'gray', tick: 'black' }, futureLabel: 'Ngày chưa tới', ongoingLabel: 'Đang diễn ra',
};
function fixture() {
  const calls = [];
  return { calls, chart: {
    canvas: { dataset: {} }, chartArea: { left: 10, right: 210, top: 30, bottom: 130, width: 200, height: 100 },
    scales: { x: { getPixelForValue: index => 60 + 100 * index }, y: { min: 0, max: 100 } },
    data: { labels: ['13', '14'], datasets: [{ data: [10, 20] }] },
    getDatasetMeta: () => ({ data: [{ getProps: () => ({ x: 60, y: 50, base: 130 }) }] }),
    ctx: { save() {}, restore() {}, beginPath() {}, clip() {},
      rect: (...args) => calls.push(['rect', ...args]), fillRect() {},
      fillText: (...args) => calls.push(['text', ...args]), measureText: () => ({ width: 50 }) },
  } };
}

test('chart decorations tolerate detached canvases, rebuilt scales and zero-size layouts', () => {
  for (const mode of ['daily', '3months']) {
    const plugin = cashFlowChartContext(() => ({ ...context, mode }));
    for (const patch of [{ canvas: null }, { ctx: null }, { scales: {} }, { chartArea: null },
      { chartArea: { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 } }]) {
      const { chart, calls } = fixture();
      Object.assign(chart, patch);
      assert.doesNotThrow(() => { plugin.afterUpdate(chart); plugin.beforeDatasetsDraw(chart); plugin.afterDatasetsDraw(chart); });
      assert.deepEqual(calls, []);
    }
  }
});

test('valid charts still shade only future dates and label the current month', () => {
  const { chart, calls } = fixture();
  let current = context;
  const plugin = cashFlowChartContext(() => current);
  plugin.afterUpdate(chart);
  assert.equal(chart.canvas.dataset.scaleMin, '0');
  assert.deepEqual(JSON.parse(chart.canvas.dataset.pointPositions), [{ index: 0, datasetIndex: 0, x: 60, y: 90 }]);
  plugin.beforeDatasetsDraw(chart);
  assert.deepEqual(calls[0], ['rect', 110, 30, 100, 100]);
  current = { ...context, mode: '3months' };
  plugin.afterDatasetsDraw(chart);
  assert.ok(calls.some(([kind, label]) => kind === 'text' && label === 'Đang diễn ra'));
  current = null;
  assert.doesNotThrow(() => plugin.beforeDatasetsDraw(chart));
});
