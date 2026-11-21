import React, { useMemo } from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { formatCurrency, getLocalMonthString } from '../../../utils/formatters';
import { WalletBalanceChart } from './WalletBalanceChart';
import { WalletTxnList } from './WalletTxnList';
import {
  BALANCE_DAYS, MIN_BALANCE_CHANGES, RECENT_TXN_LIMIT, allWalletsMonthFlow, newestFirst, totalBalanceSeries,
} from './walletDetailData';

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };

/**
 * Khung bên phải khi chọn "Tất cả ví" (mặc định, đợt 15d): thu / chi tháng này của mọi ví,
 * đường tổng số dư 90 ngày và hoạt động gần đây của mọi loại giao dịch. Số dư từng ví đã có
 * ở cột trái nên không lặp lại ở đây.
 */
export function WalletsOverviewPane({ wallets, transactions, walletMap, includedCount, onOpenFullHistory, onOpenTxn }) {
  const month = getLocalMonthString();
  const monthName = `tháng ${Number(month.slice(5))}`;
  const flow = useMemo(() => allWalletsMonthFlow(transactions, month), [transactions, month]);
  const series = useMemo(() => totalBalanceSeries(transactions, wallets), [transactions, wallets]);
  const recent = useMemo(() => newestFirst(transactions).slice(0, RECENT_TXN_LIMIT), [transactions]);
  const excludedCount = wallets.length - includedCount;

  return (
    <section className="wallet-pane" aria-labelledby="wallet-pane-title">
      <header className="wallet-pane-head">
        <div className="wallet-pane-titles">
          <p className="wallet-pane-kicker">
            {`${includedCount} ví tính vào tổng${excludedCount > 0 ? ` · ${excludedCount} ví không tính` : ''}`}
          </p>
          <h2 id="wallet-pane-title" className="wallet-pane-title">Tất cả ví</h2>
        </div>
      </header>

      <dl className="wallet-pane-stats">
        <div>
          <dt>Thu {monthName}</dt>
          <dd className={flow.income > 0 ? 'is-positive' : undefined}>{flow.income > 0 ? '+' : ''}{formatCurrency(flow.income)}</dd>
        </div>
        <div>
          <dt>Chi {monthName}</dt>
          <dd>{flow.expense > 0 ? '−' : ''}{formatCurrency(flow.expense)}</dd>
        </div>
        <div>
          <dt>Chuyển giữa các ví</dt>
          <dd>
            {formatCurrency(flow.transferAmount)}
            <span className="wallet-pane-stat-sub">{flow.transferCount} lần</span>
          </dd>
        </div>
      </dl>

      {series.changes >= MIN_BALANCE_CHANGES && (
        <WalletBalanceChart points={series.points} title={`Tổng số dư ${BALANCE_DAYS} ngày qua`} />
      )}

      <div className="wallet-pane-section-head">
        <h3>Hoạt động gần đây</h3>
        <button type="button" className="wallet-pane-link" onClick={onOpenFullHistory}>
          <span>Xem toàn bộ lịch sử</span>
          <Icon name="chevronRight" width="12" height="12" {...iconProps} strokeWidth="2.5" />
        </button>
      </div>
      {recent.length > 0 ? (
        <WalletTxnList transactions={recent} walletMap={walletMap} onOpen={onOpenTxn} />
      ) : (
        <div className="wallet-pane-empty"><p>Chưa có giao dịch nào.</p></div>
      )}
    </section>
  );
}
