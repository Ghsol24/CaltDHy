import React, { useMemo } from 'react';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { Icon } from '../../../components/ui/AppIcons';
import { IconButton } from '../../../components/ui/Button';
import { formatCurrency, formatRelativeDate, getLocalMonthString } from '../../../utils/formatters';
import { WALLET_TYPE_LABELS } from './walletLabels';
import { walletBalance } from './useWalletInsights';
import { WalletActionsMenu } from './WalletActionsMenu';
import { WalletBalanceChart } from './WalletBalanceChart';
import { WalletTxnList } from './WalletTxnList';
import {
  BALANCE_DAYS, MIN_BALANCE_CHANGES, RECENT_TXN_LIMIT, daysSince, newestFirst, touchesWallet, walletBalanceSeries, walletMonthFlow,
} from './walletDetailData';

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
const typeLabel = (type) => WALLET_TYPE_LABELS[type === 'ewallet' ? 'e-wallet' : type] || WALLET_TYPE_LABELS.cash;

function lastUsedText(date) {
  if (!date) return 'Chưa có giao dịch';
  const days = daysSince(date);
  const relative = formatRelativeDate(date);
  return days > 1 ? `${relative} · ${days} ngày trước` : relative;
}

/**
 * Khung bên phải khi chọn một ví (máy tính, đợt 15d): số dư và thao tác, tiền vào / ra tháng
 * này, lần cuối dùng, đường số dư 90 ngày (khi có đủ thay đổi) và giao dịch gần nhất của ví.
 */
export function WalletDetailPane({
  wallet, walletCount, transactions, walletMap, accent, lastTxDate, onOpenHistory, onOpenTxn,
  openAddTxnModal, handleTransfer, handleEdit, handleArchive, handleDelete,
  openMenuWalletId, setOpenMenuWalletId, menuRef, menuTriggerRef,
}) {
  const balance = walletBalance(wallet);
  const month = getLocalMonthString();
  const monthName = `tháng ${Number(month.slice(5))}`;
  const flow = useMemo(() => walletMonthFlow(transactions, wallet.id, month), [transactions, wallet.id, month]);
  const series = useMemo(() => walletBalanceSeries(transactions, wallet), [transactions, wallet]);
  const recent = useMemo(
    () => newestFirst(transactions.filter((tx) => touchesWallet(tx, wallet.id))).slice(0, RECENT_TXN_LIMIT),
    [transactions, wallet.id],
  );

  const menuKey = `detail:${wallet.id}`;
  const isMenuOpen = openMenuWalletId === menuKey;
  const limit = Number(wallet.creditLimit) || 0;
  const isCredit = wallet.type === 'credit' && limit > 0;
  const used = Math.max(0, -balance);
  const kicker = [typeLabel(wallet.type), wallet.isDefault && 'Ví mặc định', wallet.isExcludedFromTotal && 'Không tính vào tổng']
    .filter(Boolean).join(' · ');

  return (
    <section className="wallet-pane" aria-labelledby="wallet-pane-title">
      <header className="wallet-pane-head">
        <span className={`wallet-row-icon wallet-pane-icon${accent ? '' : ' is-neutral'}`} style={accent ? { '--wallet-accent': accent } : undefined} aria-hidden="true">
          <WalletOutlineIcon type={wallet.type} size={22} color="currentColor" />
        </span>
        <div className="wallet-pane-titles">
          <p className="wallet-pane-kicker">{kicker}</p>
          <h2 id="wallet-pane-title" className="wallet-pane-title">{wallet.name}</h2>
          <p className={`wallet-pane-balance${balance < 0 ? ' is-negative' : ''}`}>{formatCurrency(balance)}</p>
        </div>
        <div className="wallet-pane-actions" ref={isMenuOpen ? menuRef : null}>
          <button type="button" className="wallet-pane-btn"
            onClick={() => openAddTxnModal({ type: 'expense', walletId: wallet.id })}>
            <Icon name="plus" width="15" height="15" {...iconProps} strokeWidth="2.5" />
            <span>Giao dịch</span>
          </button>
          <button type="button" className="wallet-pane-btn" aria-label={`Chuyển tiền từ ${wallet.name}`}
            onClick={() => handleTransfer(wallet.id)} disabled={walletCount < 2}
            title={walletCount < 2 ? 'Cần ít nhất 2 ví để chuyển tiền' : undefined}>
            <Icon name="transfer" width="15" height="15" {...iconProps} />
            <span>Chuyển tiền</span>
          </button>
          <IconButton className="wallet-dots-btn" label={`Tùy chọn ví ${wallet.name}`} aria-expanded={isMenuOpen}
            onClick={(e) => { menuTriggerRef.current = e.currentTarget; setOpenMenuWalletId(isMenuOpen ? null : menuKey); }}>
            <Icon name="moreVertical" width="18" height="18" {...iconProps} strokeWidth="2.5" />
          </IconButton>
          {isMenuOpen && (
            <WalletActionsMenu
              wallet={wallet}
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
      </header>

      {isCredit && (
        <div className="wallet-pane-credit">
          <div className="wallet-pane-credit-bar" role="img" aria-label={`Đã dùng ${Math.round((used / limit) * 100)}% hạn mức`}>
            <span style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
          </div>
          <p>
            Đã dùng <strong>{formatCurrency(used)}</strong> / {formatCurrency(limit)} hạn mức
            {' · '}còn <strong>{formatCurrency(Math.max(0, limit - used))}</strong>
          </p>
        </div>
      )}

      <dl className="wallet-pane-stats">
        <div>
          <dt>Tiền vào {monthName}</dt>
          <dd className={flow.inflow > 0 ? 'is-positive' : undefined}>{flow.inflow > 0 ? '+' : ''}{formatCurrency(flow.inflow)}</dd>
        </div>
        <div>
          <dt>Tiền ra {monthName}</dt>
          <dd>{flow.outflow > 0 ? '−' : ''}{formatCurrency(flow.outflow)}</dd>
        </div>
        <div>
          <dt>Lần cuối dùng</dt>
          <dd className="wallet-pane-stat-text">{lastUsedText(lastTxDate)}</dd>
        </div>
      </dl>

      {series.changes >= MIN_BALANCE_CHANGES && (
        <WalletBalanceChart points={series.points} title={`Số dư ${BALANCE_DAYS} ngày qua`} />
      )}

      <div className="wallet-pane-section-head">
        <h3>Giao dịch của ví này</h3>
        <button type="button" className="wallet-pane-link" onClick={() => onOpenHistory(wallet)}>
          <span>Xem toàn bộ lịch sử</span>
          <Icon name="chevronRight" width="12" height="12" {...iconProps} strokeWidth="2.5" />
        </button>
      </div>
      {recent.length > 0 ? (
        <WalletTxnList transactions={recent} walletId={wallet.id} walletMap={walletMap} onOpen={onOpenTxn} />
      ) : (
        <div className="wallet-pane-empty">
          <p>Ví này chưa có giao dịch nào.</p>
          <button type="button" className="wallet-pane-btn" onClick={() => openAddTxnModal({ type: 'expense', walletId: wallet.id })}>
            <Icon name="plus" width="15" height="15" {...iconProps} strokeWidth="2.5" />
            <span>Thêm giao dịch đầu tiên</span>
          </button>
        </div>
      )}
    </section>
  );
}
