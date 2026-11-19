import React from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Icon } from '../../../components/ui/AppIcons';

export function WalletsPageHeader({ handleCreateNew, handleTransfer, wallets }) {
  return (
    <PageHeader
      icon="wallets"
      className="wallets-v2-header"
      title="Ví & Tài khoản"
      titleClassName="wallets-v2-heading"
      actions={(
        <>
          <button
            type="button"
            className="wallets-btn-transfer-outline"
            onClick={() => handleTransfer(null)}
            disabled={wallets.length < 2}
            title={wallets.length < 2 ? 'Cần ít nhất 2 ví để chuyển tiền' : 'Chuyển tiền giữa các ví'}
          >
            <Icon name="transfer" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <span>Chuyển tiền</span>
          </button>

          <button
            type="button"
            className="wallets-btn-create-primary"
            onClick={handleCreateNew}
          >
            <Icon name="plus" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <span>Thêm ví / tài khoản</span>
          </button>
        </>
      )}
    />
  );
}
