import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { WalletModal } from './WalletModal';
import { TransferModal } from './TransferModal';
import { formatCurrency } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';

const WALLET_TYPE_LABELS = {
  cash: 'Ví tiền mặt',
  bank: 'Tài khoản ngân hàng',
  credit: 'Thẻ tín dụng',
  'e-wallet': 'Ví điện tử'
};

/**
 * Helper: Render Outline/Line SVG icon based on wallet type.
 * Tuyệt đối không dùng emoji, không dùng filled icon.
 */
export function WalletOutlineIcon({ type, size = 22, color = 'currentColor' }) {
  if (type === 'bank') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="3" y1="21" x2="21" y2="21" />
        <line x1="6" y1="18" x2="6" y2="11" />
        <line x1="10" y1="18" x2="10" y2="11" />
        <line x1="14" y1="18" x2="14" y2="11" />
        <line x1="18" y1="18" x2="18" y2="11" />
        <polygon points="12 2 20 7 4 7" />
      </svg>
    );
  }

  if (type === 'credit') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    );
  }

  if (type === 'e-wallet') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }

  // default / cash
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

/**
 * Format relative date/time for recent wallet transfers
 */
function formatDateActivity(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);

  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) return `Hôm nay, ${timeStr}`;
  if (isYesterday) return `Hôm qua, ${timeStr}`;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}, ${timeStr}`;
}

/**
 * Custom Dropdown Filter Component (Theme-aware & accessible)
 */
function WalletFilterDropdown({ value, options, onChange, label, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`wallet-custom-dropdown ${className} ${isOpen ? 'is-open' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className="wallet-custom-dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label || selectedOption.label}
      >
        <span className="wallet-dropdown-selected-label">{selectedOption.label}</span>
        <svg
          className={`wallet-dropdown-chevron ${isOpen ? 'is-rotated' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="wallet-custom-dropdown-menu" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`wallet-dropdown-option ${isSelected ? 'is-selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span className="wallet-dropdown-option-label">{opt.label}</span>
                {isSelected && (
                  <svg
                    className="wallet-dropdown-check"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * SVG Donut Chart for Wallet Balance Distribution
 * Clean, seamless, interactive donut chart without messy floating labels
 */
function WalletDonutChart({ slices, totalBalance, hoveredId, onHoverSlice }) {
  const size = 200;
  const strokeWidth = 18;
  const center = size / 2; // 100
  const radius = 68;
  const circumference = 2 * Math.PI * radius;

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
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--surface-subtle, #F1F5F9)"
            strokeWidth={strokeWidth}
          />
        </svg>
        <div className="wallet-donut-center-overlay">
          <strong className="donut-center-val">0 đ</strong>
          <span className="donut-center-label">Tổng số dư</span>
        </div>
      </div>
    );
  }

  // Nếu có nhiều hơn 1 lát cắt, tạo gap nhỏ 3px phân tách vi tế, sạch đẹp
  const hasMultiple = slices.length > 1;
  const gapLength = hasMultiple ? 3 : 0;

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
        className={`donut-slice-circle ${isHovered ? 'is-active-slice' : ''}`}
        style={{
          cursor: 'pointer',
          opacity: hoveredId && !isHovered ? 0.35 : 1,
          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
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
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--surface-subtle, #F1F5F9)"
          strokeWidth={strokeWidth}
        />
        {sliceElements}
      </svg>
      <div className="wallet-donut-center-overlay">
        {hoveredSlice ? (
          <>
            <strong className="donut-center-val" style={{ color: hoveredSlice.color }}>
              {formatCurrency(hoveredSlice.balance)}
            </strong>
            <span className="donut-center-label">
              {hoveredSlice.name} • {hoveredSlice.percent.toFixed(1)}%
            </span>
          </>
        ) : (
          <>
            <strong className="donut-center-val">{formatCurrency(totalBalance)}</strong>
            <span className="donut-center-label">Tổng số dư</span>
          </>
        )}
      </div>
    </div>
  );
}

export function WalletsTab() {
  const { wallets, deleteWallet, isLoading } = useWalletStore();
  const { transactions } = useTransactionStore();
  const { setActiveView, openAddTxnModal } = useSpendingStore();
  const { confirm } = useConfirmStore();
  const { addToast } = useToastStore();

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromWalletId, setTransferFromWalletId] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' (Thẻ) | 'list' (Danh sách)
  const [showTip, setShowTip] = useState(true);

  // Bộ lọc và tìm kiếm danh sách ví
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [hoveredSliceId, setHoveredSliceId] = useState(null);

  // 3-dots action menu popover
  const [openMenuWalletId, setOpenMenuWalletId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuWalletId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

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

  // Slices for Donut Chart
  const donutSlices = useMemo(() => {
    const positiveWallets = wallets.filter((w) => Number(w.currentBalance) > 0);
    const sumPositive = positiveWallets.reduce(
      (s, w) => s + Number(w.currentBalance),
      0
    );

    if (sumPositive <= 0) return [];

    return positiveWallets.map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color || '#10B981',
      balance: Number(w.currentBalance),
      percent: (Number(w.currentBalance) / sumPositive) * 100
    }));
  }, [wallets]);

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

  // Actions
  const handleCreateNew = () => {
    setEditingWallet(null);
    setIsWalletModalOpen(true);
  };

  const handleEdit = (wallet) => {
    setOpenMenuWalletId(null);
    setEditingWallet(wallet);
    setIsWalletModalOpen(true);
  };

  const handleTransfer = (walletId) => {
    setOpenMenuWalletId(null);
    setTransferFromWalletId(walletId);
    setIsTransferModalOpen(true);
  };

  const handleDelete = async (wallet) => {
    setOpenMenuWalletId(null);
    const confirmed = await confirm({
      title: 'Xóa ví / tài khoản',
      message: `Bạn có chắc chắn muốn xóa ví "${wallet.name}"? Các giao dịch liên quan sẽ được tự động chuyển sang ví mặc định.`,
      confirmText: 'Xóa ví',
      cancelText: 'Hủy',
      confirmVariant: 'danger'
    });

    if (confirmed) {
      try {
        await deleteWallet(wallet.id);
        addToast({
          type: 'success',
          message: `Đã xóa ví "${wallet.name}".`,
          duration: 4000
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: err.message || 'Không thể xóa ví.',
          duration: 4000
        });
      }
    }
  };

  // Điều hướng tới Lịch sử giao dịch TOÀN BỘ của User
  const handleGoToFullHistory = () => {
    setActiveView('home');
    setTimeout(() => {
      const el =
        document.querySelector('.home-recent-txns-card') ||
        document.getElementById('recent-transactions-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  };

  return (
    <div className="wallets-v2-container" role="region" aria-label="Quản lý ví và tài khoản">
      {/* ── 1. Page Header: Title + Actions ── */}
      <div className="wallets-v2-header">
        <div className="wallets-v2-title-box">
          <div className="wallets-v2-title-lead">
            <div className="wallets-v2-main-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <div>
              <h2 className="wallets-v2-heading">Ví &amp; Tài khoản</h2>
              <p className="wallets-v2-subheading">Quản lý và theo dõi tất cả ví, tài khoản của bạn</p>
            </div>
          </div>
        </div>

        <div className="wallets-v2-header-actions">
          <button
            type="button"
            className="wallets-btn-transfer-outline"
            onClick={() => handleTransfer(null)}
            disabled={wallets.length < 2}
            title={wallets.length < 2 ? 'Cần ít nhất 2 ví để chuyển tiền' : 'Chuyển tiền giữa các ví'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span>Chuyển tiền</span>
          </button>

          <button
            type="button"
            className="wallets-btn-create-primary"
            onClick={handleCreateNew}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Thêm ví / tài khoản</span>
          </button>
        </div>
      </div>

      {/* ── 2. Responsive 2-Column Main Layout ── */}
      <div className="wallets-v2-layout">
        {/* ── CỘT TRÁI (~62%) ── */}
        <div className="wallets-v2-col-left">
          <div className="wallets-top-stats-card">
            <div className="stat-card-cell">
              <div className="stat-cell-icon-wrap" style={{ background: '#10B98118', color: '#10B981' }}>
                <WalletOutlineIcon type="cash" size={20} color="#10B981" />
              </div>
              <div className="stat-cell-info">
                <span className="stat-cell-label">Tổng số dư</span>
                <strong className="stat-cell-val text-brand">{formatCurrency(totalBalance)}</strong>
              </div>
            </div>
            <div className="stat-cell-divider" aria-hidden="true" />
            <div className="stat-card-cell">
              <div className="stat-cell-icon-wrap" style={{ background: '#3B82F618', color: '#3B82F6' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </div>
              <div className="stat-cell-info">
                <span className="stat-cell-label">Tổng tài sản (tất cả ví)</span>
                <strong className="stat-cell-val">{formatCurrency(allAssets)}</strong>
              </div>
            </div>
            <div className="stat-cell-divider" aria-hidden="true" />
            <div className="stat-card-cell">
              <div className="stat-cell-icon-wrap" style={{ background: '#8B5CF618', color: '#8B5CF6' }}>
                <WalletOutlineIcon type="credit" size={20} color="#8B5CF6" />
              </div>
              <div className="stat-cell-info">
                <span className="stat-cell-label">Số lượng ví</span>
                <strong className="stat-cell-val">{wallets.length} ví</strong>
              </div>
            </div>
            <div className="stat-cell-divider" aria-hidden="true" />
            <div className="stat-card-cell">
              <div className="stat-cell-icon-wrap" style={{ background: '#10B98118', color: '#10B981' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <div className="stat-cell-info">
                <span className="stat-cell-label">Ví mặc định</span>
                <strong className="stat-cell-val text-brand-default">
                  {defaultWallet?.name || 'Chưa đặt'} <span className="check-mark">✓</span>
                </strong>
              </div>
            </div>
          </div>

          <div className="wallets-list-section">
            {/* ── Search & Filter Toolbar (Chuẩn Ảnh 1) ── */}
            <div className="wallets-filter-toolbar">
              <div className="wallets-filter-inputs-group">
                {/* 1. Ô tìm kiếm theo tên ví */}
                <div className="wallets-search-box">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="wallets-search-input"
                    placeholder="Tìm kiếm ví..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Tìm kiếm ví"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="wallets-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Xóa tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* 2. Lọc theo loại ví */}
                <WalletFilterDropdown
                  value={filterType}
                  onChange={setFilterType}
                  options={[
                    { value: 'all', label: 'Tất cả loại ví' },
                    { value: 'cash', label: 'Ví tiền mặt' },
                    { value: 'bank', label: 'Tài khoản ngân hàng' },
                    { value: 'credit', label: 'Thẻ tín dụng' },
                    { value: 'e-wallet', label: 'Ví điện tử' }
                  ]}
                  label="Lọc theo loại ví"
                />

                {/* 3. Lọc theo trạng thái */}
                <WalletFilterDropdown
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[
                    { value: 'all', label: 'Tất cả trạng thái' },
                    { value: 'default', label: 'Ví mặc định' },
                    { value: 'active', label: 'Đang hoạt động' },
                    { value: 'excluded', label: 'Không tính vào tổng' }
                  ]}
                  label="Lọc theo trạng thái"
                />
              </div>

              {/* 4. Nhóm nút chuyển chế độ hiển thị: Thẻ (Card View) & Danh sách (List View) */}
              <div className="wallets-view-toggle-bar" role="group" aria-label="Kiểu hiển thị danh sách ví">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Hiển thị dạng thẻ (lưới)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>Thẻ</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Hiển thị dạng danh sách"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span>Danh sách</span>
                </button>
              </div>
            </div>

            {isLoading && wallets.length === 0 && (
              <div className="wallets-loading">
                <span className="spinner" style={{ width: 24, height: 24, marginBottom: 8 }} />
                <p>Đang tải danh sách ví...</p>
              </div>
            )}

            {!isLoading && wallets.length === 0 && (
              <EmptyState
                icon={<WalletOutlineIcon type="cash" size={44} color="#10B981" />}
                title="Chưa có ví hoặc tài khoản nào"
                description="Tạo các ví tiền mặt, tài khoản ngân hàng hoặc thẻ tín dụng để bắt đầu theo dõi dòng tiền chính xác."
                actionLabel="+ Tạo ví đầu tiên"
                onAction={handleCreateNew}
              />
            )}

            {!isLoading && wallets.length > 0 && filteredWallets.length === 0 && (
              <div className="wallets-no-results">
                <p>Không tìm thấy ví nào phù hợp với bộ lọc tìm kiếm hiện tại.</p>
                <button
                  type="button"
                  className="wallets-btn-reset-filters"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                    setFilterStatus('all');
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}

            {/* ── CARD VIEW (Dạng thẻ lưới chuẩn Ảnh 1 & Ảnh 2) ── */}
            {!isLoading && filteredWallets.length > 0 && viewMode === 'grid' && (
              <div className="wallets-cards-grid">
                {filteredWallets.map((w) => {
                  const isNegative = Number(w.currentBalance) < 0;
                  const typeLabel = WALLET_TYPE_LABELS[w.type] || 'Ví tiền mặt';
                  const accentColor = w.color || '#10B981';
                  const txCount = walletTxCountMap[w.id] || 0;
                  const isMenuOpen = openMenuWalletId === w.id;
                  const usagePct = getWalletUsagePercent(w);

                  return (
                    <div
                      key={w.id}
                      className="wallet-grid-card"
                      style={{ borderTopColor: accentColor }}
                    >
                      {/* Card Header: Icon + Title + Default Badge + 3-dots */}
                      <div className="wallet-grid-card-header">
                        <div className="wallet-grid-header-left">
                          <div
                            className="wallet-grid-icon-box"
                            style={{
                              backgroundColor: `${accentColor}15`,
                              borderColor: `${accentColor}30`
                            }}
                          >
                            <WalletOutlineIcon type={w.type} size={20} color={accentColor} />
                          </div>
                          <div className="wallet-grid-title-box">
                            <div className="wallet-grid-name-row">
                              <h4 className="wallet-grid-name" title={w.name}>{w.name}</h4>
                              {w.isDefault && (
                                <span className="wallet-badge-default-pill">★ Mặc định</span>
                              )}
                              {w.isExcludedFromTotal && (
                                <span className="wallet-badge-excluded-pill">⊘</span>
                              )}
                            </div>
                            <span className="wallet-grid-type">{typeLabel}</span>
                          </div>
                        </div>

                        {/* 3-dots Popover Menu */}
                        <div className="wallet-grid-action-col" ref={isMenuOpen ? menuRef : null}>
                          <button
                            type="button"
                            className="wallet-dots-btn"
                            onClick={() => setOpenMenuWalletId(isMenuOpen ? null : w.id)}
                            aria-label={`Tùy chọn ví ${w.name}`}
                            aria-expanded={isMenuOpen}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </button>

                          {isMenuOpen && (
                            <div className="wallet-actions-popover" role="menu">
                              <button
                                type="button"
                                className="wallet-popover-action"
                                role="menuitem"
                                onClick={() => handleTransfer(w.id)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M17 1l4 4-4 4" />
                                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                  <path d="M7 23l-4-4 4-4" />
                                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                </svg>
                                <span>Chuyển tiền từ ví này</span>
                              </button>

                              <button
                                type="button"
                                className="wallet-popover-action"
                                role="menuitem"
                                onClick={() => handleEdit(w)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                  <path d="m15 5 4 4" />
                                </svg>
                                <span>Chỉnh sửa ví</span>
                              </button>

                              <div className="wallet-popover-divider" aria-hidden="true" />

                              <button
                                type="button"
                                className="wallet-popover-action text-danger"
                                role="menuitem"
                                onClick={() => handleDelete(w)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>Xóa ví</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body: Big Balance + Tỷ lệ sử dụng (Progress Bar) */}
                      <div className="wallet-grid-card-body">
                        <div className={`wallet-grid-balance ${isNegative ? 'text-danger' : 'text-brand'}`}>
                          {formatCurrency(w.currentBalance ?? w.initialBalance ?? 0)}
                        </div>

                        <div className="wallet-grid-usage-box">
                          <div className="wallet-grid-usage-labels">
                            <span className="usage-label">Tỷ lệ sử dụng</span>
                            <strong className="usage-pct">{usagePct}%</strong>
                          </div>
                          <div className="wallet-grid-progress-track">
                            <div
                              className="wallet-grid-progress-fill"
                              style={{
                                width: `${Math.max(4, usagePct)}%`,
                                backgroundColor: accentColor
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Transactions Count & Last Updated */}
                      <div className="wallet-grid-card-footer">
                        <div className="wallet-grid-footer-item">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>{txCount} giao dịch</span>
                        </div>

                        <div className="wallet-grid-footer-item">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 14 10" />
                          </svg>
                          <span>Hôm nay</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── LIST VIEW (Dạng thẻ ngang khi chọn Danh sách) ── */}
            {!isLoading && filteredWallets.length > 0 && viewMode === 'list' && (
              <div className="wallets-horizontal-list">
                {filteredWallets.map((w) => {
                  const isNegative = Number(w.currentBalance) < 0;
                  const typeLabel = WALLET_TYPE_LABELS[w.type] || 'Ví tiền mặt';
                  const accentColor = w.color || '#10B981';
                  const txCount = walletTxCountMap[w.id] || 0;
                  const isMenuOpen = openMenuWalletId === w.id;
                  return (
                    <div
                      key={w.id}
                      className="wallet-h-card"
                      style={{ borderLeftColor: accentColor }}
                    >
                      {/* Icon Pastel Container with OUTLINE SVG */}
                      <div
                        className="wallet-h-icon-container"
                        style={{
                          backgroundColor: `${accentColor}15`,
                          borderColor: `${accentColor}30`
                        }}
                      >
                        <WalletOutlineIcon type={w.type} size={22} color={accentColor} />
                      </div>

                      {/* Info: Name, Type, Badges, Meta */}
                      <div className="wallet-h-info-col">
                        <div className="wallet-h-title-row">
                          <h4 className="wallet-h-name" title={w.name}>
                            {w.name}
                          </h4>
                          {w.isDefault && (
                            <span className="wallet-badge-default-pill">
                              ★ Mặc định
                            </span>
                          )}
                          {w.isExcludedFromTotal && (
                            <span className="wallet-badge-excluded-pill">
                              ⊘ Không tính vào tổng
                            </span>
                          )}
                        </div>

                        <span className="wallet-h-type-text">{typeLabel}</span>

                        <div className="wallet-h-meta-row">
                          <span className="wallet-h-meta-date">Cập nhật: Hôm nay</span>
                          <span className="meta-bullet">•</span>
                          <span className="wallet-h-meta-txns">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span>{txCount} giao dịch</span>
                          </span>
                        </div>
                      </div>

                      {/* Right: Balance + 3-dots Menu */}
                      <div className="wallet-h-balance-col">
                        <span className="wallet-h-balance-label">Số dư hiện tại</span>
                        <strong className={`wallet-h-balance-val ${isNegative ? 'text-danger' : 'text-brand'}`}>
                          {formatCurrency(w.currentBalance ?? w.initialBalance ?? 0)}
                        </strong>
                      </div>

                      {/* 3-Dots Action Menu */}
                      <div className="wallet-h-action-col" ref={isMenuOpen ? menuRef : null}>
                        <button
                          type="button"
                          className="wallet-dots-btn"
                          onClick={() => setOpenMenuWalletId(isMenuOpen ? null : w.id)}
                          aria-label={`Tùy chọn ví ${w.name}`}
                          aria-expanded={isMenuOpen}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="19" r="1" />
                          </svg>
                        </button>

                        {isMenuOpen && (
                          <div className="wallet-actions-popover" role="menu">
                            <button
                              type="button"
                              className="wallet-popover-action"
                              role="menuitem"
                              onClick={() => handleTransfer(w.id)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 1l4 4-4 4" />
                                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                <path d="M7 23l-4-4 4-4" />
                                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                              </svg>
                              <span>Chuyển tiền từ ví này</span>
                            </button>

                            <button
                              type="button"
                              className="wallet-popover-action"
                              role="menuitem"
                              onClick={() => handleEdit(w)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                              </svg>
                              <span>Chỉnh sửa ví</span>
                            </button>

                            <div className="wallet-popover-divider" aria-hidden="true" />

                            <button
                              type="button"
                              className="wallet-popover-action text-danger"
                              role="menuitem"
                              onClick={() => handleDelete(w)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              <span>Xóa ví</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Card "+ Thêm ví / tài khoản mới" Dạng Empty State Chuẩn Ảnh 3 */}
            <button
              type="button"
              className="wallet-add-card-dashed"
              onClick={handleCreateNew}
            >
              <div className="add-dashed-icon-circle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="add-dashed-text-group">
                <strong className="add-dashed-title">Thêm ví / tài khoản mới</strong>
                <span className="add-dashed-subtitle">Tạo hoặc liên kết tài khoản ngân hàng</span>
              </div>
              <svg className="add-dashed-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* ── 2.3. Thao tác nhanh (Quick Actions) ── */}
          <div className="wallet-quick-actions-section">
            <h3 className="wallets-section-title">Thao tác nhanh</h3>
            <div className="wallet-quick-actions-grid">
              {/* 1. Chuyển tiền */}
              <button
                type="button"
                className="wallet-quick-action-card"
                onClick={() => handleTransfer(null)}
              >
                <div className="quick-action-icon-box" style={{ background: '#10B98118', color: '#10B981' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </div>
                <div className="quick-action-content">
                  <strong className="quick-action-title">Chuyển tiền</strong>
                  <span className="quick-action-subtitle">Giữa các ví</span>
                </div>
              </button>

              {/* 2. Nạp tiền */}
              <button
                type="button"
                className="wallet-quick-action-card"
                onClick={openAddTxnModal}
              >
                <div className="quick-action-icon-box" style={{ background: '#06B6D418', color: '#06B6D4' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                </div>
                <div className="quick-action-content">
                  <strong className="quick-action-title">Nạp tiền</strong>
                  <span className="quick-action-subtitle">Vào ví</span>
                </div>
              </button>

              {/* 3. Rút tiền */}
              <button
                type="button"
                className="wallet-quick-action-card"
                onClick={openAddTxnModal}
              >
                <div className="quick-action-icon-box" style={{ background: '#F9731618', color: '#F97316' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </div>
                <div className="quick-action-content">
                  <strong className="quick-action-title">Rút tiền</strong>
                  <span className="quick-action-subtitle">Từ ví</span>
                </div>
              </button>

              {/* 4. Lịch sử giao dịch */}
              <button
                type="button"
                className="wallet-quick-action-card"
                onClick={handleGoToFullHistory}
              >
                <div className="quick-action-icon-box" style={{ background: '#8B5CF618', color: '#8B5CF6' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="quick-action-content">
                  <strong className="quick-action-title">Lịch sử giao dịch</strong>
                  <span className="quick-action-subtitle">Xem toàn bộ giao dịch</span>
                </div>
              </button>
            </div>

            {/* Banner: Lịch sử giao dịch sẽ mở trang tổng hợp toàn bộ giao dịch */}
            <button
              type="button"
              className="wallet-history-redirect-banner"
              onClick={handleGoToFullHistory}
            >
              <span className="banner-bulb-icon">💡</span>
              <span className="banner-text">
                Lịch sử giao dịch sẽ mở trang tổng hợp toàn bộ giao dịch của bạn (chi tiêu, thu nhập, nạp/rút, chuyển tiền, ...)
              </span>
              <span className="banner-arrow">→</span>
            </button>
          </div>
        </div>

        {/* ── CỘT PHẢI (~38%): Phân bổ số dư + Hoạt động gần đây + Mẹo tài chính ── */}
        <div className="wallets-v2-col-right">
          {/* Card 1: Phân bổ số dư */}
          <div className="wallets-side-card">
            <div className="side-card-header">
              <h3 className="side-card-title">Phân bổ số dư</h3>
              <div className="side-card-badge">Tỷ lệ theo số dư</div>
            </div>

            <div className="donut-chart-and-legend">
              <WalletDonutChart
                slices={donutSlices}
                totalBalance={totalBalance}
                hoveredId={hoveredSliceId}
                onHoverSlice={setHoveredSliceId}
              />

              <div className="donut-legend-list">
                {donutSlices.map((slice) => {
                  const isHovered = hoveredSliceId === slice.id;
                  return (
                    <div
                      key={slice.id}
                      className={`donut-legend-item ${isHovered ? 'is-hovered' : ''}`}
                      onMouseEnter={() => setHoveredSliceId(slice.id)}
                      onMouseLeave={() => setHoveredSliceId(null)}
                    >
                      <div className="donut-legend-left">
                        <span className="donut-legend-dot" style={{ backgroundColor: slice.color }} />
                        <span className="donut-legend-name" title={slice.name}>{slice.name}</span>
                      </div>
                      <div className="donut-legend-right">
                        <strong className="donut-legend-pct">{slice.percent.toFixed(1)}%</strong>
                        <span className="donut-legend-bal">{formatCurrency(slice.balance)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Hoạt động gần đây (CHỈ GIỮA CÁC VÍ) */}
          <div className="wallets-side-card">
            <div className="side-card-header">
              <div className="side-card-title-group">
                <h3 className="side-card-title">Hoạt động gần đây</h3>
                <div className="wallet-activity-tooltip-wrapper">
                  <span
                    className="wallet-activity-info-trigger"
                    tabIndex={0}
                    role="button"
                    aria-label="Chỉ hiển thị giao dịch LUÂN CHUYỂN TIỀN GIỮA CÁC VÍ với nhau."
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                  <div className="wallet-activity-tooltip-popup" role="tooltip">
                    Chỉ hiển thị giao dịch <strong>LUÂN CHUYỂN TIỀN GIỮA CÁC VÍ</strong> với nhau.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="side-card-link-btn"
                onClick={handleGoToFullHistory}
              >
                <span>Xem tất cả</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* List of Recent Wallet Transfers */}
            <div className="wallet-activities-list">
              {walletActivities.length === 0 ? (
                <div className="activities-empty-hint">
                  <p>Chưa có giao dịch chuyển tiền nào giữa các ví.</p>
                </div>
              ) : (
                walletActivities.map((tx) => {
                  const fromW = walletMap[tx.walletId];
                  const toW = walletMap[tx.toWalletId];
                  const fromName = fromW ? fromW.name : 'Ví nguồn';
                  const toName = toW ? toW.name : 'Ví đích';
                  const isIncoming = tx.toWalletId === defaultWallet?.id;

                  return (
                    <div key={tx.id || tx._id} className="wallet-activity-row">
                      <div
                        className="activity-icon-badge"
                        style={{
                          background: isIncoming ? '#10B98118' : '#3B82F618',
                          color: isIncoming ? '#10B981' : '#3B82F6'
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 1l4 4-4 4" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <path d="M7 23l-4-4 4-4" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </div>

                      <div className="activity-flow-info">
                        <span className="activity-names-flow">
                          <strong>{fromName}</strong> → <strong>{toName}</strong>
                        </span>
                        <span className="activity-time-text">
                          {formatDateActivity(tx.date)}
                        </span>
                      </div>

                      <div className={`activity-amt-box ${isIncoming ? 'text-brand' : 'text-danger'}`}>
                        {isIncoming ? '+' : '-'}{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card 3: Mẹo quản lý tài chính */}
          {showTip && (
            <div className="wallet-finance-tip-card">
              <div className="tip-header-row">
                <div className="tip-title-lead">
                  <span className="tip-bulb" aria-hidden="true">💡</span>
                  <strong className="tip-title">Mẹo quản lý tài chính</strong>
                </div>
                <button
                  type="button"
                  className="tip-close-btn"
                  onClick={() => setShowTip(false)}
                  aria-label="Đóng mẹo"
                >
                  ✕
                </button>
              </div>
              <p className="tip-body-content">
                Thường xuyên chuyển tiền vào các ví mục tiêu để kiểm soát chi tiêu hiệu quả hơn.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Global Modals for Wallets */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
          setEditingWallet(null);
        }}
        walletToEdit={editingWallet}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferFromWalletId(null);
        }}
        initialFromWalletId={transferFromWalletId}
      />
    </div>
  );
}
