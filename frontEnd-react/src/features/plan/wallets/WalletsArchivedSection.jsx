import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { WALLET_TYPE_LABELS } from './walletLabels';
import { formatCurrency } from '../../../utils/formatters';
import { Button } from '../../../components/ui/Button';
import { useTranslation } from '../../../i18n/useTranslation';

export function WalletsArchivedSection({ archivedWallets, handleUnarchive, isArchivedSectionExpanded, setIsArchivedSectionExpanded, unarchivingId }) {
  const { t } = useTranslation();
  return (archivedWallets && archivedWallets.length > 0 && (
    <div
      className="wallet-archived-section wallet-archived-section--box"
     
    >
      <button className="wallet-archived-section__button--box"
        type="button"
        onClick={() => setIsArchivedSectionExpanded((prev) => !prev)}
       
        aria-expanded={isArchivedSectionExpanded}
      >
        <div className="wallet-archived-section__div--layout">
          <div className="wallet-archived-section__div--box"
           
          >
            <Icon name="archive" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </div>
          <div className="wallet-archived-section__div--text">
            <strong className="wallet-archived-section__strong--text">Ví đã lưu trữ ({archivedWallets.length})</strong>
            <div className="wallet-archived-section__div--text2">
              Các ví đã đóng không còn sử dụng nhưng vẫn bảo toàn lịch sử giao dịch
            </div>
          </div>
        </div>
        <Icon name="chevronDown" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`wallets-archive-chevron${isArchivedSectionExpanded ? ' is-expanded' : ''}`} />
      </button>
  
      {isArchivedSectionExpanded && (
        <div className="wallet-archived-section__div--layout2"
         
        >
          {archivedWallets.map((aw) => (
            <div className="wallet-archived-section__div--box2"
              key={aw.id}
             
            >
              <div className="wallet-archived-section__div--layout3">
                <span className="wallet-archived-section__span--layout">
                  <WalletOutlineIcon type={aw.type} size={22} color="currentColor" />
                </span>
                <div>
                  <div className="wallet-archived-section__div--layout4">
                    <strong className="wallet-archived-section__strong--text2">{aw.name}</strong>
                    <span className="wallet-archived-section__span--text"
                     
                    >
                      Đã lưu trữ
                    </span>
                  </div>
                  <div className="wallet-archived-section__div--text3">
                    {t('wallet.archivedBalance', { type: WALLET_TYPE_LABELS[aw.type] || aw.type, amount: formatCurrency(0) })}
                  </div>
                </div>
              </div>
  
              <Button
                size="sm"
                onClick={() => handleUnarchive(aw)}
                disabled={Boolean(unarchivingId)}
                loading={unarchivingId === aw.id}
              >
                {unarchivingId !== aw.id && <Icon name="refreshCw" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />}
                <span>Mở lại ví</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )) || null;
}
