import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
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
import { WalletsArchivedSection } from './wallets/WalletsArchivedSection';
import { WalletRecentActivityCard } from './wallets/WalletRecentActivityCard';
import { WalletsSummary } from './wallets/WalletsSummary';
import { WalletGroupedList } from './wallets/WalletGroupedList';
import { WalletsPageHeader } from './wallets/WalletsPageHeader';
import { useWalletInsights } from './wallets/useWalletInsights';
import { useCommandRequest } from '../../hooks/useCommandRequest';
export { WalletOutlineIcon };

export function WalletsTab() {
  const wallets = useWalletStore((state) => state.wallets);
  const archivedWallets = useWalletStore((state) => state.archivedWallets);
  const deleteWallet = useWalletStore((state) => state.deleteWallet);
  const unarchiveWallet = useWalletStore((state) => state.unarchiveWallet);
  const isLoading = useWalletStore((state) => state.isLoading);
  const transactions = useTransactionStore((state) => state.transactions);
  const navigate = useNavigate();
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

  // Search only earns its row once the list is long enough to need it.
  const [searchQuery, setSearchQuery] = useState('');
  const showSearch = wallets.length >= 8;

  // 3-dots action menu popover
  const [openMenuWalletId, setOpenMenuWalletId] = useState(null);
  const menuRef = useRef(null);
  // The ⋮ button that opened the wallet menu: dialogs opened from that menu
  // hand focus back to it, since the menu item itself is gone by then.
  const menuTriggerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuWalletId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const {
    totalBalance, includedCount, walletMap, slices, colorByWalletId, groups, getWalletNote, walletActivities,
  } = useWalletInsights({ wallets, transactions, searchQuery: showSearch ? searchQuery : '' });

  // A wallet row opens that wallet's own transactions in the history screen.
  const handleOpenHistory = (wallet) => {
    navigate(`/spending/analytics/transactions?${new URLSearchParams({ wallet: wallet.id }).toString()}`);
  };

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
  useCommandRequest('transfer', () => handleTransfer(null));

  const handleDelete = (wallet) => {
    setOpenMenuWalletId(null);
    confirm({
      title: 'Xóa ví / tài khoản',
      message: `Bạn có chắc chắn muốn xóa ví "${wallet.name}"? Các giao dịch liên quan sẽ được tự động chuyển sang ví mặc định.`,
      confirmText: 'Xóa ví',
      cancelText: 'Hủy',
      confirmVariant: 'danger',
      returnFocusRef: menuTriggerRef,
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

  const handleGoToFullHistory = () => {
    navigate(`/spending/analytics/transactions?${new URLSearchParams({ type: 'transfer' }).toString()}`);
  };

  return (
    <div className="wallets-v2-container" role="region" aria-label="Quản lý ví và tài khoản">
      {/* ── 1. Page Header: Title + Actions ── */}
      <WalletsPageHeader handleCreateNew={handleCreateNew} handleTransfer={handleTransfer} wallets={wallets} />

      <div className="wallets-v2-layout">
        <div className="wallets-v2-col-left">
          <WalletsSummary totalBalance={totalBalance} includedCount={includedCount} slices={slices} />

          {showSearch && (
            <label className="wallets-search">
              <span className="u-sr-only">Tìm kiếm ví</span>
              <input
                type="search"
                className="wallets-search-input"
                placeholder="Tìm kiếm ví..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          )}

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

          {wallets.length > 0 && groups.length === 0 && (
            <p className="wallets-no-results">Không tìm thấy ví nào phù hợp.</p>
          )}

          <WalletGroupedList
            groups={groups}
            colorByWalletId={colorByWalletId}
            getWalletNote={getWalletNote}
            deletingWalletId={deletingWalletId}
            openMenuWalletId={openMenuWalletId}
            setOpenMenuWalletId={setOpenMenuWalletId}
            menuRef={menuRef}
            menuTriggerRef={menuTriggerRef}
            onOpenHistory={handleOpenHistory}
            handleTransfer={handleTransfer}
            handleEdit={handleEdit}
            handleArchive={handleArchive}
            handleDelete={handleDelete}
            openAddTxnModal={openAddTxnModal}
          />
        </div>

        <aside className="wallets-v2-col-right" aria-label="Chuyển tiền gần đây">
          <WalletRecentActivityCard handleGoToFullHistory={handleGoToFullHistory} walletActivities={walletActivities} walletMap={walletMap} />
        </aside>
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
