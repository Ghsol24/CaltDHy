export const INITIAL_CASH_FLOW_VIEW = Object.freeze({
  mode: 'daily', series: 'expense', excludeRecurring: false,
});

const MODES = new Set(['daily', '3months', '6months']);
const SERIES = new Set(['expense', 'income', 'both']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function isCashFlowView(value) {
  return isObject(value) && Object.keys(value).length === 3 &&
    owns(value, 'mode') && MODES.has(value.mode) && owns(value, 'series') && SERIES.has(value.series) &&
    owns(value, 'excludeRecurring') &&
    typeof value.excludeRecurring === 'boolean';
}

export function normalizeCashFlowPreferences(value) {
  const copy = view => isCashFlowView(view) ? {
    mode: view.mode, series: view.series, excludeRecurring: view.excludeRecurring,
  } : null;
  return { lastUsed: copy(value?.lastUsed), pinnedDefault: copy(value?.pinnedDefault) };
}

export function cashFlowEntryView(preferences) {
  const saved = normalizeCashFlowPreferences(preferences?.cashFlow);
  return saved.pinnedDefault || saved.lastUsed || {
    ...INITIAL_CASH_FLOW_VIEW,
    excludeRecurring: preferences?.analyticsExcludeRecurring === true,
  };
}

export function updateCashFlowView(current, update) {
  const patch = typeof update === 'function' ? update(current) : update;
  if (!isObject(patch) || Object.keys(patch).some(key => !['mode', 'series', 'excludeRecurring'].includes(key))) {
    throw new TypeError('Invalid cash-flow view update.');
  }
  const next = { ...current, ...patch };
  if (!isCashFlowView(next)) throw new TypeError('Invalid cash-flow view update.');
  return next;
}

export function sameCashFlowView(a, b) {
  return a?.mode === b?.mode && a?.series === b?.series && a?.excludeRecurring === b?.excludeRecurring;
}
