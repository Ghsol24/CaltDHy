import { useMemo } from 'react';
import { WALLET_TYPE_LABELS } from './walletLabels';

// Color palette hài hòa, chuẩn thiết kế hiện đại
const CHART_PALETTE = ['#2563EB', '#D97706', '#0D9488', '#DC2626', '#6366F1', '#10B981', '#EC4899', '#8B5CF6', '#F59E0B', '#0284C7'];

/**
 * Số liệu suy ra cho tab Ví: tổng tài sản, ví mặc định, số giao dịch mỗi ví,
 * lát biểu đồ phân bổ, danh sách đã lọc và hoạt động chuyển tiền gần đây.
 */
export function useWalletInsights({ wallets, transactions, distributionMode, searchQuery, filterType, filterStatus }) {
  // Calculate totals
  const totalBalance = useMemo(() => {
    return wallets
      .filter((w) => !w.isExcludedFromTotal)
      .reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0);
  }, [wallets]);

  const allAssets = useMemo(() => {
    return wallets.reduce(
      (sum, w) => sum + (Number(w.currentBalance) || 0),
      0
    );
  }, [wallets]);

  // Default wallet
  const defaultWallet = useMemo(() => {
    return wallets.find((w) => w.isDefault) || wallets[0] || null;
  }, [wallets]);

  // Fast lookup walletMap
  const walletMap = useMemo(() => {
    const map = {};
    wallets.forEach((w) => {
      if (w && w.id) map[w.id] = w;
    });
    return map;
  }, [wallets]);

  // Calculate transaction count per wallet
  const walletTxCountMap = useMemo(() => {
    const map = {};
    (transactions || []).forEach((t) => {
      if (t.walletId) {
        map[t.walletId] = (map[t.walletId] || 0) + 1;
      }
      if (t.toWalletId) {
        map[t.toWalletId] = (map[t.toWalletId] || 0) + 1;
      }
    });
    return map;
  }, [transactions]);


  // Slices for Donut Chart (Hỗ trợ theo Số dư hoặc Số giao dịch)
  const donutSlices = useMemo(() => {
    if (distributionMode === 'txCount') {
      const activeWallets = wallets.filter((w) => (walletTxCountMap[w.id] || 0) > 0);
      const totalTx = activeWallets.reduce(
        (sum, w) => sum + (walletTxCountMap[w.id] || 0),
        0
      );

      if (totalTx <= 0) return [];

      return activeWallets.map((w, idx) => ({
        id: w.id,
        name: w.name,
        color: w.color || CHART_PALETTE[idx % CHART_PALETTE.length],
        balance: walletTxCountMap[w.id] || 0,
        percent: ((walletTxCountMap[w.id] || 0) / totalTx) * 100
      }));
    }

    const positiveWallets = wallets.filter((w) => Number(w.currentBalance) > 0);
    const sumPositive = positiveWallets.reduce(
      (s, w) => s + Number(w.currentBalance),
      0
    );

    if (sumPositive <= 0) return [];

    return positiveWallets.map((w, idx) => ({
      id: w.id,
      name: w.name,
      color: w.color || CHART_PALETTE[idx % CHART_PALETTE.length],
      balance: Number(w.currentBalance),
      percent: (Number(w.currentBalance) / sumPositive) * 100
    }));
  }, [wallets, distributionMode, walletTxCountMap]);

  const chartTotal = useMemo(() => {
    if (distributionMode === 'txCount') {
      return donutSlices.reduce((sum, s) => sum + s.balance, 0);
    }
    return totalBalance;
  }, [distributionMode, donutSlices, totalBalance]);

  // Tổng số dư dương để tính % phân bổ số dư / tỷ lệ sử dụng
  const positiveTotal = useMemo(() => {
    return wallets.reduce((sum, w) => {
      const val = Number(w.currentBalance) || 0;
      return sum + (val > 0 ? val : 0);
    }, 0);
  }, [wallets]);

  // Hàm tính tỷ lệ sử dụng / tỷ lệ tài sản cho từng thẻ ví
  const getWalletUsagePercent = (w) => {
    if (w.type === 'credit' && Number(w.creditLimit) > 0) {
      const balance = Math.abs(Number(w.currentBalance) || 0);
      return Math.min(100, Math.round((balance / Number(w.creditLimit)) * 100));
    }
    if (positiveTotal > 0) {
      const balance = Math.max(0, Number(w.currentBalance) || 0);
      return Math.min(100, Math.round((balance / positiveTotal) * 100));
    }
    return 0;
  };

  // Danh sách ví sau khi lọc theo tìm kiếm, loại ví và trạng thái
  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (w.name || '').toLowerCase().includes(q);
        const typeLabel = (WALLET_TYPE_LABELS[w.type] || '').toLowerCase();
        const typeMatch = typeLabel.includes(q);
        if (!nameMatch && !typeMatch) return false;
      }
      if (filterType !== 'all' && w.type !== filterType) {
        return false;
      }
      if (filterStatus === 'default' && !w.isDefault) return false;
      if (filterStatus === 'excluded' && !w.isExcludedFromTotal) return false;
      if (filterStatus === 'active' && w.isExcludedFromTotal) return false;
      return true;
    });
  }, [wallets, searchQuery, filterType, filterStatus]);

  // 2.4. Hoạt động gần đây (CHỈ GIỮA CÁC VÍ)
  const walletActivities = useMemo(() => {
    return (transactions || [])
      .filter(
        (tx) =>
          tx.type === 'transfer' &&
          tx.walletId &&
          tx.toWalletId &&
          !tx.jarId
      )
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 10);
  }, [transactions]);

  return { totalBalance, allAssets, defaultWallet, walletMap, walletTxCountMap, donutSlices, chartTotal, positiveTotal, getWalletUsagePercent, filteredWallets, walletActivities };
}
