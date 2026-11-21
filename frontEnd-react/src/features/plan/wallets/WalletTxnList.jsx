import React from 'react';
import { TransactionItem } from '../../transactions/TransactionItem';
import { isLockedTransaction } from '../../transactions/useDeleteTransaction';
import { Icon } from '../../../components/ui/AppIcons';
import { formatCurrency, formatRelativeDate } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';
import { walletDelta } from './walletDetailData';

/**
 * Danh sách giao dịch gọn trong khung chi tiết ví (đợt 15d), cùng dòng với "Giao dịch gần đây"
 * ở Trang chủ. Có `walletId`: số tiền mang dấu theo ví đó (chuyển đi là −, nhận về là +).
 * Không có: số tiền như ở Lịch sử (chuyển giữa các ví không mang dấu).
 */
export function WalletTxnList({ transactions, walletId, walletMap, onOpen }) {
  const { t, label } = useTranslation();
  const nameOf = (id, fallback) => walletMap[id]?.name || fallback;

  return (
    <div className="wallet-pane-txns">
      {transactions.map((tx, index) => {
        const isTransfer = tx.type === 'transfer';
        const isLocked = isLockedTransaction(tx);
        const fromName = nameOf(tx.walletId, 'Ví nguồn');
        const toName = nameOf(tx.toWalletId, 'Ví đích');

        let signed;
        if (walletId) signed = walletDelta(tx, walletId);
        else if (tx.type === 'income') signed = Number(tx.amount) || 0;
        else if (tx.type === 'expense') signed = -((Number(tx.amount) || 0) + (Number(tx.fee) || 0));
        else signed = null;

        const amountText = signed === null
          ? `⇄ ${formatCurrency(tx.amount)}`
          : `${signed >= 0 ? '+' : '−'}${formatCurrency(Math.abs(signed))}`;
        const tone = isTransfer ? 'transfer' : tx.type === 'income' ? 'income' : 'expense';

        let direction = null;
        if (isTransfer) {
          if (!walletId) direction = `${fromName} → ${toName}`;
          else direction = tx.walletId === walletId ? `Chuyển đến ${toName}` : `Nhận từ ${fromName}`;
        }
        const title = tx.desc || direction || label(tx.category);
        const meta = isTransfer
          ? [tx.desc ? direction : label(tx.category || 'Chuyển tiền'), formatRelativeDate(tx.date)]
          : [label(tx.category), walletId ? null : nameOf(tx.walletId, t('home.cash')), formatRelativeDate(tx.date)];

        return (
          <TransactionItem
            key={tx.id || index}
            markName={isTransfer ? 'transfer' : tx.category}
            tone={tone}
            title={title}
            meta={meta}
            amount={<span className={`txn-item__amount is-${tone}`}>{amountText}</span>}
            onOpen={isLocked ? undefined : () => onOpen(tx)}
            ariaLabel={t('home.transactionAria', { name: title, amount: amountText })}
            lockedHint={isLocked && (tx.jarId || tx.installmentId) ? (
              <span className="txn-item__locked wallet-pane-locked" title={t(tx.jarId ? 'home.jarLocked' : 'home.recurringLocked')}>
                <Icon name="lock" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <span>{t(tx.jarId ? 'nav.jarShort' : 'nav.recurring')}</span>
              </span>
            ) : undefined}
          />
        );
      })}
    </div>
  );
}
