import React from 'react';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { Icon, StarOutlineIcon } from '../../../components/ui/AppIcons';
import { formatCurrency } from '../../../utils/formatters';
import { IconButton } from '../../../components/ui/Button';
import { MenuPopover } from '../../../components/ui/MenuPopover';
import { walletBalance } from './useWalletInsights';

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };

/**
 * Danh sách ví gom theo loại (Ngân hàng / Ví điện tử / Tiền mặt / Thẻ tín dụng),
 * mỗi nhóm có tổng phụ; ví "Không tính vào tổng" nằm riêng ở cuối.
 * Mỗi dòng chỉ có biểu tượng, tên, số dư; thao tác nhanh hiện khi rê chuột hoặc focus.
 */
export function WalletGroupedList({
  groups, colorByWalletId, getWalletNote, deletingWalletId, openMenuWalletId, setOpenMenuWalletId,
  menuRef, menuTriggerRef, onOpenHistory, handleTransfer, handleEdit, handleArchive, handleDelete, openAddTxnModal,
}) {
  return (
    <div className="wallet-groups">
      {groups.map((group) => (
        <section key={group.key} className={`wallet-group${group.key === 'excluded' ? ' wallet-group--excluded' : ''}`} aria-labelledby={`wallet-group-${group.key}`}>
          <h2 className="wallet-group-head">
            <span id={`wallet-group-${group.key}`} className="wallet-group-label">{group.label}</span>
            {group.subtotal !== null && <span className="wallet-group-total">{formatCurrency(group.subtotal)}</span>}
          </h2>
          <ul className="wallet-rows">
            {group.items.map((w) => {
              const balance = walletBalance(w);
              const accent = colorByWalletId[w.id];
              const note = getWalletNote(w, formatCurrency);
              const isMenuOpen = openMenuWalletId === w.id;
              const openMenu = (e) => { menuTriggerRef.current = e.currentTarget; setOpenMenuWalletId(isMenuOpen ? null : w.id); };
              return (
                <li key={w.id} className={`wallet-row${deletingWalletId === w.id ? ' is-deleting' : ''}${isMenuOpen ? ' is-menu-open' : ''}`}>
                  <button type="button" className="wallet-row-main" onClick={() => onOpenHistory(w)} title={`Xem giao dịch của ${w.name}`}>
                    <span className={`wallet-row-icon${accent ? '' : ' is-neutral'}`} style={accent ? { '--wallet-accent': accent } : undefined} aria-hidden="true">
                      <WalletOutlineIcon type={w.type} size={18} color="currentColor" />
                    </span>
                    <span className="wallet-row-text">
                      <span className="wallet-row-name">
                        <span className="wallet-row-name-text">{w.name}</span>
                        {w.isDefault && (
                          <span className="wallet-row-default" title="Ví mặc định">
                            <StarOutlineIcon size={13} />
                            <span className="u-sr-only">Ví mặc định</span>
                          </span>
                        )}
                      </span>
                      {note && <span className="wallet-row-note">{note}</span>}
                    </span>
                    <span className={`wallet-row-amount${balance < 0 ? ' is-negative' : ''}${balance === 0 ? ' is-zero' : ''}`}>
                      {formatCurrency(balance)}
                    </span>
                  </button>

                  <div className="wallet-row-actions" ref={isMenuOpen ? menuRef : null}>
                    <IconButton className="wallet-row-quick" label={`Chuyển tiền từ ${w.name}`} onClick={() => handleTransfer(w.id)}>
                      <Icon name="transfer" width="16" height="16" {...iconProps} />
                    </IconButton>
                    <IconButton
                      className="wallet-row-quick"
                      label={`Thêm giao dịch vào ${w.name}`}
                      onClick={() => openAddTxnModal({ type: 'expense', walletId: w.id })}
                    >
                      <Icon name="plus" width="16" height="16" {...iconProps} />
                    </IconButton>
                    <IconButton className="wallet-dots-btn" label={`Tùy chọn ví ${w.name}`} onClick={openMenu} aria-expanded={isMenuOpen}>
                      <Icon name="moreVertical" width="18" height="18" {...iconProps} strokeWidth="2.5" />
                    </IconButton>

                    {isMenuOpen && (
                      <MenuPopover className="wallet-actions-popover" label={`Tùy chọn ví ${w.name}`} onClose={() => setOpenMenuWalletId(null)} triggerRef={menuTriggerRef}>
                        <button type="button" className="wallet-popover-action" role="menuitem"
                          onClick={() => { setOpenMenuWalletId(null); openAddTxnModal({ type: 'income', title: `Nạp tiền vào ${w.name}`, walletId: w.id }); }}>
                          <Icon name="arrowDown" width="14" height="14" {...iconProps} />
                          <span>Nạp tiền vào ví</span>
                        </button>
                        <button type="button" className="wallet-popover-action" role="menuitem"
                          onClick={() => { setOpenMenuWalletId(null); openAddTxnModal({ type: 'expense', title: `Rút tiền từ ${w.name}`, walletId: w.id }); }}>
                          <Icon name="arrowUp" width="14" height="14" {...iconProps} />
                          <span>Rút tiền từ ví</span>
                        </button>
                        <button type="button" className="wallet-popover-action" role="menuitem" onClick={() => handleTransfer(w.id)}>
                          <Icon name="transfer" width="14" height="14" {...iconProps} />
                          <span>Chuyển tiền từ ví này</span>
                        </button>
                        <button type="button" className="wallet-popover-action" role="menuitem" onClick={() => handleEdit(w)}>
                          <Icon name="pencil" width="14" height="14" {...iconProps} />
                          <span>Chỉnh sửa ví</span>
                        </button>
                        <div className="wallet-popover-divider" aria-hidden="true" />
                        <button type="button" className="wallet-popover-action wallet-popover-action--tone" role="menuitem" onClick={() => handleArchive(w)}>
                          <Icon name="archive" width="14" height="14" {...iconProps} />
                          <span>Lưu trữ / Đóng ví</span>
                        </button>
                        <button type="button" className="wallet-popover-action text-danger" role="menuitem" onClick={() => handleDelete(w)}>
                          <Icon name="trash" width="14" height="14" {...iconProps} />
                          <span>Xóa vĩnh viễn</span>
                        </button>
                      </MenuPopover>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
