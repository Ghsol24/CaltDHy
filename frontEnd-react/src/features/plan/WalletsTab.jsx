import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useRef, useEffect } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { WalletModal } from './WalletModal';
import { TransferModal } from './TransferModal';
import { ArchiveWalletModal } from './ArchiveWalletModal';
import { EmptyState } from '../../components/ui/EmptyState';

import { WalletOutlineIcon } from '../../components/ui/WalletOutlineIcon';
import { Icon } from '../../components/ui/AppIcons';
import { WalletsArchivedSection } from './wallets/WalletsArchivedSection';
import { WalletTipCard } from './wallets/WalletTipCard';
import { WalletRecentActivityCard } from './wallets/WalletRecentActivityCard';
import { WalletBalanceDistributionCard } from './wallets/WalletBalanceDistributionCard';
import { WalletQuickActions } from './wallets/WalletQuickActions';
import { WalletListView } from './wallets/WalletListView';
import { WalletGridView } from './wallets/WalletGridView';
import { WalletsFilterToolbar } from './wallets/WalletsFilterToolbar';
import { WalletStatsCard } from './wallets/WalletStatsCard';
import { WalletsPageHeader } from './wallets/WalletsPageHeader';
import { useWalletInsights } from './wallets/useWalletInsights';
export { WalletOutlineIcon };

export function WalletsTab() {
  const wallets = useWalletStore((state) => state.wallets);
  const archivedWallets = useWalletStore((state) => state.archivedWallets);
  const deleteWallet = useWalletStore((state) => state.deleteWallet);
  const unarchiveWallet = useWalletStore((state) => state.unarchiveWallet);
  const isLoading = useWalletStore((state) => state.isLoading);
  const transactions = useTransactionStore((state) => state.transactions);
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const openAddTxnModal = useSpendingStore((s) => s.openAddTxnModal);
  const confirm = useConfirmStore((state) => state.confirm);
  const addToast = useToastStore((state) => state.addToast);

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromWalletId, setTransferFromWalletId] = useState(null);

  // Modal Lưu trữ / Đóng ví
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [walletToArchive, setWalletToArchive] = useState(null);
  const [isArchivedSectionExpanded, setIsArchivedSectionExpanded] = useState(false);
  const [deletingWalletId, setDeletingWalletId] = useState(null);
  const [unarchivingId, setUnarchivingId] = useState(null);
  const unarchivingRef = useRef(null);

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
  // The ⋮ button that opened the wallet menu: dialogs opened from that menu
  // hand focus back to it, since the menu item itself is gone by then.
  const menuTriggerRef = useRef(null);

  // Phân bổ số dư: chế độ xem ('balance' | 'txCount') và popover dropdown
  const [distributionMode, setDistributionMode] = useState('balance');
  const [isDistDropdownOpen, setIsDistDropdownOpen] = useState(false);
  const distDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuWalletId(null);
      }
      if (distDropdownRef.current && !distDropdownRef.current.contains(e.target)) {
        setIsDistDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const {
    totalBalance, allAssets, defaultWallet, walletMap, walletTxCountMap, donutSlices, chartTotal, getWalletUsagePercent, filteredWallets, walletActivities,
  } = useWalletInsights({ wallets, transactions, distributionMode, searchQuery, filterType, filterStatus });

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

  const handleDelete = (wallet) => {
    setOpenMenuWalletId(null);
    confirm({
      title: 'Xóa ví / tài khoản',
      message: `Bạn có chắc chắn muốn xóa ví "${wallet.name}"? Các giao dịch liên quan sẽ được tự động chuyển sang ví mặc định.`,
      confirmText: 'Xóa ví',
      cancelText: 'Hủy',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setDeletingWalletId(wallet.id);
        try {
          await deleteWallet(wallet.id);
          addToast({ type: 'success', message: `Đã xóa ví "${wallet.name}".`, duration: 4000 });
        } finally {
          setDeletingWalletId(null);
        }
      },
    });
  };

  const handleArchive = (wallet) => {
    setOpenMenuWalletId(null);
    setWalletToArchive(wallet);
    setIsArchiveModalOpen(true);
  };

  const handleUnarchive = async (wallet) => {
    if (unarchivingRef.current) return;
    unarchivingRef.current = wallet.id;
    setUnarchivingId(wallet.id);
    try {
      await unarchiveWallet(wallet.id);
      addToast({
        type: 'success',
        message: `Đã mở lại ví "${wallet.name}".`,
        duration: 4000
      });
    } catch (err) {
      addToast({
        type: 'error',
        message: getUserErrorMessage(err, 'error.save'),
        duration: 4000
      });
    } finally {
      unarchivingRef.current = null;
      setUnarchivingId(null);
    }
  };

  // Điều hướng tới Lịch sử giao dịch TOÀN BỘ của User
  const handleGoToFullHistory = () => {
    navigateTo('home');
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
      <WalletsPageHeader handleCreateNew={handleCreateNew} handleTransfer={handleTransfer} wallets={wallets} />

      {/* ── 2. Responsive 2-Column Main Layout ── */}
      <div className="wallets-v2-layout">
        {/* ── CỘT TRÁI (~62%) ── */}
        <div className="wallets-v2-col-left">
          <WalletStatsCard allAssets={allAssets} defaultWallet={defaultWallet} totalBalance={totalBalance} wallets={wallets} />

          <div className="wallets-list-section">
            {/* ── Search & Filter Toolbar (Chuẩn Ảnh 1) ── */}
            <WalletsFilterToolbar filterStatus={filterStatus} filterType={filterType} searchQuery={searchQuery} setFilterStatus={setFilterStatus} setFilterType={setFilterType} setSearchQuery={setSearchQuery} setViewMode={setViewMode} viewMode={viewMode} />

            {isLoading && wallets.length === 0 && (
              <div className="wallets-loading">
                <span className="spinner spinner--box" />
                <p>Đang tải danh sách ví...</p>
              </div>
            )}

            {!isLoading && wallets.length === 0 && (
              <EmptyState
                icon={<WalletOutlineIcon type="cash" size={44} color="#10B981" />}
                title="Chưa có ví hoặc tài khoản nào"
                description="Tạo ví tiền mặt, tài khoản ngân hàng hoặc thẻ tín dụng để ghi nhận số dư và giao dịch."
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
            {<WalletGridView deletingWalletId={deletingWalletId} filteredWallets={filteredWallets} getWalletUsagePercent={getWalletUsagePercent} handleArchive={handleArchive} handleDelete={handleDelete} handleEdit={handleEdit} handleTransfer={handleTransfer} menuRef={menuRef} menuTriggerRef={menuTriggerRef} openAddTxnModal={openAddTxnModal} openMenuWalletId={openMenuWalletId} setOpenMenuWalletId={setOpenMenuWalletId} viewMode={viewMode} walletTxCountMap={walletTxCountMap} />}

            {/* ── LIST VIEW (Dạng thẻ ngang khi chọn Danh sách) ── */}
            {<WalletListView deletingWalletId={deletingWalletId} filteredWallets={filteredWallets} handleArchive={handleArchive} handleDelete={handleDelete} handleEdit={handleEdit} handleTransfer={handleTransfer} menuRef={menuRef} menuTriggerRef={menuTriggerRef} openAddTxnModal={openAddTxnModal} openMenuWalletId={openMenuWalletId} setOpenMenuWalletId={setOpenMenuWalletId} viewMode={viewMode} walletTxCountMap={walletTxCountMap} />}

            {/* Card "+ Thêm ví / tài khoản mới" Dạng Empty State Chuẩn Ảnh 3 */}
            <button
              type="button"
              className="wallet-add-card-dashed"
              onClick={handleCreateNew}
            >
              <div className="add-dashed-icon-circle">
                <Icon name="plus" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </div>
              <div className="add-dashed-text-group">
                <strong className="add-dashed-title">Thêm ví / tài khoản mới</strong>
                <span className="add-dashed-subtitle">Tạo Ví/Tài khoản mới</span>
              </div>
              <Icon name="chevronRight" className="add-dashed-chevron" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </button>
          </div>

          {/* ── 2.3. Thao tác nhanh (Quick Actions) ── */}
          <WalletQuickActions defaultWallet={defaultWallet} handleGoToFullHistory={handleGoToFullHistory} handleTransfer={handleTransfer} openAddTxnModal={openAddTxnModal} />
        </div>

        {/* ── CỘT PHẢI (~38%): Phân bổ số dư + Hoạt động gần đây + Mẹo tài chính ── */}
        <div className="wallets-v2-col-right">
          {/* Card 1: Phân bổ số dư */}
          <WalletBalanceDistributionCard chartTotal={chartTotal} distDropdownRef={distDropdownRef} distributionMode={distributionMode} donutSlices={donutSlices} hoveredSliceId={hoveredSliceId} isDistDropdownOpen={isDistDropdownOpen} setDistributionMode={setDistributionMode} setHoveredSliceId={setHoveredSliceId} setIsDistDropdownOpen={setIsDistDropdownOpen} />

          {/* Card 2: Hoạt động gần đây (CHỈ GIỮA CÁC VÍ) */}
          <WalletRecentActivityCard defaultWallet={defaultWallet} handleGoToFullHistory={handleGoToFullHistory} walletActivities={walletActivities} walletMap={walletMap} />

          {/* Card 3: Mẹo quản lý tài chính */}
          {<WalletTipCard setShowTip={setShowTip} showTip={showTip} />}
        </div>
      </div>

      {/* ── 3. Khu vực Ví đã lưu trữ (Archived Wallets Accordion) ── */}
      {<WalletsArchivedSection archivedWallets={archivedWallets} handleUnarchive={handleUnarchive} isArchivedSectionExpanded={isArchivedSectionExpanded} setIsArchivedSectionExpanded={setIsArchivedSectionExpanded} unarchivingId={unarchivingId} />}

      {/* Global Modals for Wallets */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
          setEditingWallet(null);
        }}
        walletToEdit={editingWallet}
        returnFocusRef={menuTriggerRef}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferFromWalletId(null);
        }}
        initialFromWalletId={transferFromWalletId}
      />

      <ArchiveWalletModal
        isOpen={isArchiveModalOpen}
        onClose={() => {
          setIsArchiveModalOpen(false);
          setWalletToArchive(null);
        }}
        wallet={walletToArchive}
        returnFocusRef={menuTriggerRef}
      />
    </div>
  );
}
