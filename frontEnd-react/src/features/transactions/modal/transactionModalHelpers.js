import React from 'react';

export function describeBudgetMetrics(metrics, t) {
  for (const metric of Object.values(metrics)) {
    metric.color = metric.hasLimit ? `var(--color-${metric.status})` : 'var(--color-neutral-bg)';
    metric.statusLabel = !metric.hasLimit ? t('transaction.limitUnset') : metric.rawRemaining <= 0n
      ? t('transaction.limitReached') : t('transaction.limitLeft', { percent: metric.percent });
  }
  return metrics;
}

/** The category of the newest hand-entered transaction of this type (the list arrives newest first). */
export function recentCategoryName(transactions, type, categories) {
  const names = new Map(categories.map((cat) => [cat.name.toLowerCase(), cat.name]));
  let best = null;
  for (const txn of transactions || []) {
    if (txn.type !== type || txn.installmentId || txn.jarId || !txn.category) continue;
    const name = names.get(String(txn.category).toLowerCase());
    if (name && (!best || txn.date > best.date)) best = { date: txn.date, name };
  }
  return best?.name || '';
}

/** Số chip danh mục tối đa trên hai hàng của lưới desktop; nhiều hơn thì có chip "Thêm…". */
export const CATEGORY_CHIP_SLOTS = 10;

/**
 * Các danh mục hiện thành chip (desktop). Vừa 10 ô thì hiện hết; nhiều hơn thì 9 chip + "Thêm…",
 * và danh mục đang chọn luôn nằm trong hàng chip (thay ô cuối nếu nó nằm ngoài 9 chip đầu).
 */
export function pickVisibleCategories(categories, selectedName) {
  if (categories.length <= CATEGORY_CHIP_SLOTS) return { visible: categories, hasMore: false };
  const visible = categories.slice(0, CATEGORY_CHIP_SLOTS - 1);
  const selected = String(selectedName || '').toLowerCase();
  if (selected && !visible.some((cat) => cat.name.toLowerCase() === selected)) {
    const chosen = categories.find((cat) => cat.name.toLowerCase() === selected);
    if (chosen) visible[visible.length - 1] = chosen;
  }
  return { visible, hasMore: true };
}

/**
 * Dòng ngân sách của danh mục đang chọn (FORM-11).
 * - `metric` đã gồm số tiền đang nhập, `baseline` thì không.
 * - Đỏ (`tone: 'danger'`) chỉ khi đã có số tiền VÀ chính khoản này làm vượt hạn mức.
 * - Danh mục đã vượt từ trước thì chỉ ghi trung tính "đã vượt …", không đổi theo số đang gõ.
 * Trả về `{ text, tone, kind }`; `text` rỗng nghĩa là không có gì để nói.
 */
export function describeBudgetLine({ copy, formatMoney, baseline, category, hasDraft, limit, metric }) {
  if (!metric) return { text: '', kind: 'none' };
  const lead = (phrase) => (category ? `${category}${copy.colon}${phrase}` : phrase.charAt(0).toLocaleUpperCase() + phrase.slice(1));
  if (!metric.hasLimit) return { text: lead(copy.unset), kind: 'unset' };
  if (baseline?.hasLimit && baseline.rawRemaining < 0n) {
    return { text: lead(copy.over({ amount: formatMoney(-baseline.rawRemaining), limit })), kind: 'over' };
  }
  if (hasDraft && metric.rawRemaining < 0n) {
    return { text: lead(copy.exceed({ amount: formatMoney(-metric.rawRemaining) })), tone: 'danger', kind: 'exceed' };
  }
  if (metric.rawRemaining === 0n) return { text: lead(copy.reached({ limit })), kind: 'reached' };
  const amount = formatMoney(metric.rawRemaining);
  return hasDraft
    ? { text: lead(copy.leftAfter({ amount })), kind: 'after' }
    : { text: lead(copy.left({ amount, limit })), kind: 'left' };
}

/** Số chip danh mục nhanh dưới số tiền (bố cục máy tính "Phương án 3"). */
export const QUICK_CHIP_COUNT = 4;

/** Chip nhanh chỉ đếm số lần dùng trong chừng này ngày gần nhất, để danh mục bỏ lâu tự rời hàng chip. */
export const QUICK_CHIP_WINDOW_DAYS = 90;

function isoDaysAgo(days, now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Chip nhanh: các danh mục dùng nhiều nhất trong QUICK_CHIP_WINDOW_DAYS ngày gần nhất (rồi dùng gần
 * nhất) trong những giao dịch tự ghi cùng loại, thiếu thì lấy theo thứ tự danh sách. Danh mục đang
 * chọn luôn có chip (thay chip cuối nếu cần), nên chọn từ danh sách đầy đủ vẫn thấy ngay trên hàng chip.
 */
export function pickQuickCategories(categories, transactions, type, selectedName, count = QUICK_CHIP_COUNT, now = new Date()) {
  const since = isoDaysAgo(QUICK_CHIP_WINDOW_DAYS, now);
  const byKey = new Map(categories.map((cat) => [cat.name.toLowerCase(), cat]));
  const stats = new Map();
  for (const txn of transactions || []) {
    if (txn.type !== type || txn.installmentId || txn.jarId || !txn.category) continue;
    const key = String(txn.category).toLowerCase();
    if (!byKey.has(key)) continue;
    const entry = stats.get(key) || { count: 0, last: '' };
    const date = String(txn.date || '');
    if (date >= since) entry.count += 1;
    if (date > entry.last) entry.last = date;
    stats.set(key, entry);
  }
  const ranked = categories
    .map((cat, index) => ({ cat, index, stat: stats.get(cat.name.toLowerCase()) }))
    .sort((a, b) => (b.stat?.count || 0) - (a.stat?.count || 0)
      || (b.stat?.last || '').localeCompare(a.stat?.last || '') || a.index - b.index)
    .map(({ cat }) => cat);
  const visible = ranked.slice(0, count);
  const selected = String(selectedName || '').toLowerCase();
  if (selected && byKey.has(selected) && visible.length && !visible.some((cat) => cat.name.toLowerCase() === selected)) {
    visible[visible.length - 1] = byKey.get(selected);
  }
  return visible;
}

/**
 * Danh mục chọn sẵn khi mở form hay đổi loại: điện thoại chỉ thấy danh mục đang chọn nên lấy mục dùng
 * gần nhất; máy tính lấy chip nhanh đứng đầu (dùng nhiều nhất), để mục chọn sẵn trùng chip đầu tiên.
 */
export function defaultCategoryName(transactions, type, categories, isPhone) {
  if (isPhone) return recentCategoryName(transactions, type, categories);
  return pickQuickCategories(categories, transactions, type, '', 1)[0]?.name || '';
}
