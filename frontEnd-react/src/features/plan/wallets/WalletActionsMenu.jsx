import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { MenuPopover } from '../../../components/ui/MenuPopover';

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };

/** Menu ⋮ của một ví: dùng chung cho dòng trong danh sách và đầu khung chi tiết ví. */
export function WalletActionsMenu({ wallet, triggerRef, onClose, openAddTxnModal, onTransfer, onEdit, onArchive, onDelete }) {
  return (
    <MenuPopover className="wallet-actions-popover" label={`Tùy chọn ví ${wallet.name}`} onClose={onClose} triggerRef={triggerRef}>
      <button type="button" className="wallet-popover-action" role="menuitem"
        onClick={() => { onClose(); openAddTxnModal({ type: 'income', title: `Nạp tiền vào ${wallet.name}`, walletId: wallet.id }); }}>
        <Icon name="arrowDown" width="14" height="14" {...iconProps} />
        <span>Nạp tiền vào ví</span>
      </button>
      <button type="button" className="wallet-popover-action" role="menuitem"
        onClick={() => { onClose(); openAddTxnModal({ type: 'expense', title: `Rút tiền từ ${wallet.name}`, walletId: wallet.id }); }}>
        <Icon name="arrowUp" width="14" height="14" {...iconProps} />
        <span>Rút tiền từ ví</span>
      </button>
      <button type="button" className="wallet-popover-action" role="menuitem" onClick={() => onTransfer(wallet.id)}>
        <Icon name="transfer" width="14" height="14" {...iconProps} />
        <span>Chuyển tiền từ ví này</span>
      </button>
      <button type="button" className="wallet-popover-action" role="menuitem" onClick={() => onEdit(wallet)}>
        <Icon name="pencil" width="14" height="14" {...iconProps} />
        <span>Chỉnh sửa ví</span>
      </button>
      <div className="wallet-popover-divider" aria-hidden="true" />
      <button type="button" className="wallet-popover-action wallet-popover-action--tone" role="menuitem" onClick={() => onArchive(wallet)}>
        <Icon name="archive" width="14" height="14" {...iconProps} />
        <span>Lưu trữ / Đóng ví</span>
      </button>
      <button type="button" className="wallet-popover-action text-danger" role="menuitem" onClick={() => onDelete(wallet)}>
        <Icon name="trash" width="14" height="14" {...iconProps} />
        <span>Xóa vĩnh viễn</span>
      </button>
    </MenuPopover>
  );
}
