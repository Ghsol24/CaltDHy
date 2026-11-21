import React from 'react';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { Icon, StarOutlineIcon } from '../../../components/ui/AppIcons';
import { formatCurrency } from '../../../utils/formatters';
import { IconButton } from '../../../components/ui/Button';
import { walletBalance } from './useWalletInsights';
import { WalletActionsMenu } from './WalletActionsMenu';

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };

// Đi lên / xuống giữa các dòng chọn được (khung chia đôi): focus và chọn luôn dòng mới.
function moveSelection(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const options = [...event.currentTarget.querySelectorAll('[data-wallet-option]')];
  const index = options.indexOf(document.activeElement);
  if (index === -1) return;
  const next = options[index + (event.key === 'ArrowDown' ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
  next.click();
}

/**
 * Danh sách ví gom theo loại (Ngân hàng / Ví điện tử / Tiền mặt / Thẻ tín dụng),
 * mỗi nhóm có tổng phụ; ví "Không tính vào tổng" nằm riêng ở cuối.
 * Một cột (điện thoại, màn hẹp): bấm dòng mở lịch sử giao dịch của ví đó.
 * Chia đôi (máy tính, đợt 15d): bấm dòng chọn ví để xem chi tiết bên phải; dòng "Tất cả ví"
 * ở đầu; thao tác nhanh nằm ở khung chi tiết nên dòng chỉ còn menu ⋮ (hiện khi rê chuột).
 */
export function WalletGroupedList({
  groups, colorByWalletId, getWalletNote, deletingWalletId, openMenuWalletId, setOpenMenuWalletId,
  menuRef, menuTriggerRef, onOpenHistory, handleTransfer, handleEdit, handleArchive, handleDelete, openAddTxnModal,
  isSplit = false, selectedId = 'all', onSelect, walletCount = 0,
}) {
  return (
    <div className="wallet-groups" onKeyDown={isSplit ? moveSelection : undefined}>
      {isSplit && (
        <div className={`wallet-row wallet-row--all${selectedId === 'all' ? ' is-selected' : ''}`}>
          <button type="button" className="wallet-row-main" data-wallet-option="" aria-current={selectedId === 'all' ? 'true' : undefined}
            onClick={() => onSelect('all')}>
            <span className="wallet-row-icon is-neutral" aria-hidden="true">
              <Icon name="walletAlt" width="18" height="18" {...iconProps} strokeWidth="1.8" />
            </span>
            <span className="wallet-row-text">
              <span className="wallet-row-name"><span className="wallet-row-name-text">Tất cả ví</span></span>
            </span>
            <span className="wallet-row-count">{walletCount}</span>
          </button>
        </div>
      )}
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
              const isSelected = isSplit && selectedId === w.id;
              const openMenu = (e) => { menuTriggerRef.current = e.currentTarget; setOpenMenuWalletId(isMenuOpen ? null : w.id); };
              return (
                <li key={w.id} className={`wallet-row${deletingWalletId === w.id ? ' is-deleting' : ''}${isMenuOpen ? ' is-menu-open' : ''}${isSelected ? ' is-selected' : ''}`}>
                  <button
                    type="button"
                    className="wallet-row-main"
                    data-wallet-option={isSplit ? '' : undefined}
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => (isSplit ? onSelect(w.id) : onOpenHistory(w))}
                    title={isSplit ? undefined : `Xem giao dịch của ${w.name}`}
                  >
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
                      {note && !isSplit && <span className="wallet-row-note">{note}</span>}
                    </span>
                    <span className={`wallet-row-amount${balance < 0 ? ' is-negative' : ''}${balance === 0 ? ' is-zero' : ''}`}>
                      {formatCurrency(balance)}
                    </span>
                  </button>

                  <div className="wallet-row-actions" ref={isMenuOpen ? menuRef : null}>
                    {!isSplit && (
                      <>
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
                      </>
                    )}
                    <IconButton className="wallet-dots-btn" label={`Tùy chọn ví ${w.name}`} onClick={openMenu} aria-expanded={isMenuOpen}>
                      <Icon name="moreVertical" width="18" height="18" {...iconProps} strokeWidth="2.5" />
                    </IconButton>

                    {isMenuOpen && (
                      <WalletActionsMenu
                        wallet={w}
                        triggerRef={menuTriggerRef}
                        onClose={() => setOpenMenuWalletId(null)}
                        openAddTxnModal={openAddTxnModal}
                        onTransfer={handleTransfer}
                        onEdit={handleEdit}
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                      />
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
