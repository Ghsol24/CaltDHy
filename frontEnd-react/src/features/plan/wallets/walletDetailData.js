import { getLocalDateString } from '../../../utils/formatters';
import { walletBalance } from './useWalletInsights';

// Số liệu cho khung chi tiết ví trên máy tính (đợt 15d). Toàn bộ giao dịch đã nằm sẵn trong
// store, nên mọi con số tính ngay ở trình duyệt, không cần gọi thêm API.

export const RECENT_TXN_LIMIT = 8;
export const BALANCE_DAYS = 90;
// Đường số dư chỉ đáng vẽ khi có ít nhất chừng này lần đổi trong khoảng đang xem.
export const MIN_BALANCE_CHANGES = 2;

const dateOf = (tx) => String(tx?.date || '').slice(0, 10);

// Giao dịch làm số dư của nhóm ví (has) đổi bao nhiêu — cùng quy tắc với
// backEnd/server/utils/walletBalance.js: thu cộng, chi trừ cả phí, chuyển tiền trừ ví
// nguồn (cả phí) và cộng ví đích.
function deltaFor(tx, has) {
  const amount = Number(tx.amount) || 0;
  const fee = Number(tx.fee) || 0;
  if (tx.type === 'income') return has(tx.walletId) ? amount : 0;
  if (tx.type === 'expense') return has(tx.walletId) ? -amount - fee : 0;
  if (tx.type === 'transfer') {
    let delta = 0;
    if (has(tx.walletId)) delta -= amount + fee;
    if (has(tx.toWalletId)) delta += amount;
    return delta;
  }
  return 0;
}

export const walletDelta = (tx, walletId) => deltaFor(tx, (id) => id === walletId);

export const touchesWallet = (tx, walletId) => tx.walletId === walletId || tx.toWalletId === walletId;

export const newestFirst = (list) => [...list].sort((a, b) => dateOf(b).localeCompare(dateOf(a)));

/** Tiền vào / ra của một ví trong tháng (YYYY-MM), tính cả chuyển tiền giữa các ví. */
export function walletMonthFlow(transactions, walletId, month) {
  let inflow = 0;
  let outflow = 0;
  for (const tx of transactions) {
    if (!dateOf(tx).startsWith(month)) continue;
    const delta = walletDelta(tx, walletId);
    if (delta > 0) inflow += delta;
    else outflow -= delta;
  }
  return { inflow, outflow };
}

/** Thu / chi của mọi ví trong tháng; chuyển giữa các ví không phải thu hay chi nên đếm riêng. */
export function allWalletsMonthFlow(transactions, month) {
  const flow = { income: 0, expense: 0, transferCount: 0, transferAmount: 0 };
  for (const tx of transactions) {
    if (!dateOf(tx).startsWith(month)) continue;
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') flow.income += amount;
    else if (tx.type === 'expense') flow.expense += amount + (Number(tx.fee) || 0);
    else if (tx.type === 'transfer' && tx.walletId && tx.toWalletId && !tx.jarId) {
      flow.transferCount += 1;
      flow.transferAmount += amount;
    }
  }
  return flow;
}

/**
 * Số dư cuối mỗi ngày của nhóm ví trong `days` ngày tới hôm nay, lần ngược từ số dư hiện tại.
 * `changes` đếm số ngày có đổi mà đường vẽ thấy được (ngày đầu tiên không tính).
 */
function balanceSeries(transactions, has, currentBalance, days, today) {
  const deltas = new Map();
  for (const tx of transactions) {
    const delta = deltaFor(tx, has);
    if (delta) deltas.set(dateOf(tx), (deltas.get(dateOf(tx)) || 0) + delta);
  }
  // Số dư hiện tại đã gồm cả giao dịch ghi ngày tương lai: bỏ chúng ra để có số dư hết hôm nay.
  let balance = currentBalance;
  for (const [date, delta] of deltas) if (date > today) balance -= delta;

  const points = [];
  let changes = 0;
  const cursor = new Date(`${today}T00:00:00`);
  for (let i = 0; i < days; i += 1) {
    const date = getLocalDateString(cursor);
    points.push({ date, balance });
    const delta = deltas.get(date);
    if (delta) {
      balance -= delta;
      if (i < days - 1) changes += 1;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  points.reverse();
  return { points, changes };
}

export function walletBalanceSeries(transactions, wallet, days = BALANCE_DAYS, today = getLocalDateString()) {
  return balanceSeries(transactions, (id) => id === wallet.id, walletBalance(wallet), days, today);
}

/** Tổng số dư các ví được tính vào tổng (bỏ ví "Không tính vào tổng"). */
export function totalBalanceSeries(transactions, wallets, days = BALANCE_DAYS, today = getLocalDateString()) {
  const included = wallets.filter((w) => !w.isExcludedFromTotal);
  const ids = new Set(included.map((w) => w.id));
  const total = included.reduce((sum, w) => sum + walletBalance(w), 0);
  return balanceSeries(transactions, (id) => ids.has(id), total, days, today);
}

export function daysSince(date, today = getLocalDateString()) {
  if (!date) return null;
  const ms = new Date(`${today}T00:00:00`).getTime() - new Date(`${String(date).slice(0, 10)}T00:00:00`).getTime();
  return Math.round(ms / 86400000);
}
