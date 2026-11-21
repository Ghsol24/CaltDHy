import { useMemo } from 'react';
import { DISTRIBUTION_PALETTE, WALLET_TYPE_LABELS } from './walletLabels';

// Order of the groups on the page: where most people keep most of their money first.
export const WALLET_GROUP_ORDER = ['bank', 'e-wallet', 'cash', 'credit'];
// The allocation bar names this many wallets; the rest share one "Khác" segment.
const NAMED_SLICES = 5;
const STALE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const walletBalance = (wallet) => Number(wallet.currentBalance ?? wallet.initialBalance ?? 0) || 0;

/**
 * Số liệu cho tab Ví: tổng số dư, thanh phân bổ (một màu cho mỗi ví, khớp với ô
 * biểu tượng trong danh sách), danh sách gom theo loại ví và chuyển tiền gần đây.
 */
export function useWalletInsights({ wallets, transactions, searchQuery = '' }) {
  const totalBalance = useMemo(() => wallets
    .filter((w) => !w.isExcludedFromTotal)
    .reduce((sum, w) => sum + walletBalance(w), 0), [wallets]);

  const walletMap = useMemo(() => {
    const map = {};
    wallets.forEach((w) => { if (w?.id) map[w.id] = w; });
    return map;
  }, [wallets]);

  const lastTxDateMap = useMemo(() => {
    const map = {};
    const note = (id, date) => {
      if (id && date && (!map[id] || date > map[id])) map[id] = date;
    };
    (transactions || []).forEach((t) => {
      const date = String(t.date || '').slice(0, 10);
      note(t.walletId, date);
      note(t.toWalletId, date);
    });
    return map;
  }, [transactions]);

  // Colours follow rank by size, never the user's choice (WAL-09), and the list
  // reuses them so each row's icon matches its segment in the bar.
  const { slices, colorByWalletId } = useMemo(() => {
    const ranked = wallets
      .filter((w) => !w.isExcludedFromTotal && walletBalance(w) > 0)
      .sort((a, b) => walletBalance(b) - walletBalance(a));
    const sum = ranked.reduce((s, w) => s + walletBalance(w), 0);
    const colors = {};
    if (sum <= 0) return { slices: [], colorByWalletId: colors };

    const named = ranked.slice(0, NAMED_SLICES).map((w, idx) => {
      colors[w.id] = DISTRIBUTION_PALETTE[idx];
      return { id: w.id, name: w.name, color: DISTRIBUTION_PALETTE[idx], percent: (walletBalance(w) / sum) * 100 };
    });
    const rest = ranked.slice(NAMED_SLICES);
    if (rest.length > 0) {
      const restSum = rest.reduce((s, w) => s + walletBalance(w), 0);
      named.push({ id: 'other', name: 'Khác', color: null, percent: (restSum / sum) * 100 });
    }
    return { slices: named, colorByWalletId: colors };
  }, [wallets]);

  const groups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const visible = q
      ? wallets.filter((w) => (w.name || '').toLowerCase().includes(q)
        || (WALLET_TYPE_LABELS[w.type] || '').toLowerCase().includes(q))
      : wallets;
    const byBalance = (a, b) => walletBalance(b) - walletBalance(a);
    const known = new Set(WALLET_GROUP_ORDER);
    // A type this page doesn't know (e.g. the model's 'savings') still needs a home: it sits with cash.
    const groupOf = (w) => {
      const type = w.type === 'ewallet' ? 'e-wallet' : w.type;
      return known.has(type) ? type : 'cash';
    };

    const result = WALLET_GROUP_ORDER.map((type) => {
      const items = visible.filter((w) => !w.isExcludedFromTotal && groupOf(w) === type).sort(byBalance);
      return { key: type, label: WALLET_TYPE_LABELS[type], items, subtotal: items.reduce((s, w) => s + walletBalance(w), 0) };
    });
    const excluded = visible.filter((w) => w.isExcludedFromTotal).sort(byBalance);
    result.push({ key: 'excluded', label: 'Không tính vào tổng', items: excluded, subtotal: null });
    return result.filter((g) => g.items.length > 0);
  }, [wallets, searchQuery]);

  // A line under the wallet name only when there is something worth saying,
  // instead of "Cập nhật: Hôm nay" and a transaction count on every wallet.
  const getWalletNote = (w, formatCurrency) => {
    if (w.type === 'credit' && Number(w.creditLimit) > 0) {
      const left = Math.max(0, Number(w.creditLimit) - Math.abs(walletBalance(w)));
      return `Còn ${formatCurrency(left)} hạn mức`;
    }
    const last = lastTxDateMap[w.id];
    const age = last ? (Date.now() - new Date(`${last}T00:00:00`).getTime()) / DAY_MS : Infinity;
    return age > STALE_DAYS ? `Không có giao dịch trong ${STALE_DAYS} ngày qua` : null;
  };

  const walletActivities = useMemo(() => (transactions || [])
    .filter((tx) => tx.type === 'transfer' && tx.walletId && tx.toWalletId && !tx.jarId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5), [transactions]);

  const includedCount = wallets.filter((w) => !w.isExcludedFromTotal).length;

  return { totalBalance, includedCount, walletMap, slices, colorByWalletId, groups, getWalletNote, walletActivities, lastTxDateMap };
}
