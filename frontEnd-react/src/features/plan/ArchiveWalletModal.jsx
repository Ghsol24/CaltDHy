import { getUserErrorMessage } from '../../utils/userErrors';
import React, { useState, useEffect, useMemo } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { Dialog } from '../../components/ui/Dialog';
import { walletService } from '../../services/walletService';
import { formatCurrency } from '../../utils/formatters';
import { Icon, AlertTriangleOutlineIcon } from '../../components/ui/AppIcons';
import { CustomWalletDropdown } from '../../components/ui/CustomWalletDropdown';
import { useTranslation } from '../../i18n/useTranslation';

import { Button } from '../../components/ui/Button';
export function ArchiveWalletModal({ isOpen, onClose, wallet = null, onSuccess = null, returnFocusRef }) {
  const { t } = useTranslation();
  const { wallets, archiveWallet } = useWalletStore();
  const { addToast } = useToastStore();

  const [isLoadingPreflight, setIsLoadingPreflight] = useState(true);
  const [preflightData, setPreflightData] = useState(null);
  const [transferToWalletId, setTransferToWalletId] = useState('');
  const [replacementWalletId, setReplacementWalletId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');


  // Lọc các ví khả dụng khác (không phải ví đang đóng)
  const availableTargetWallets = useMemo(() => {
    if (!wallet) return [];
    return wallets.filter((w) => w.id !== wallet.id && !w.archived);
  }, [wallets, wallet]);

  // Khi mở Modal: Gọi API pre-archive để kiểm tra số dư và installment
  useEffect(() => {
    if (!isOpen || !wallet) {
      setPreflightData(null);
      setErrorMsg('');
      return;
    }

    let isMounted = true;
    setIsLoadingPreflight(true);
    setErrorMsg('');

    // Thiết lập ví đích mặc định (ưu tiên ví default hoặc ví đầu tiên)
    const defaultFallback = availableTargetWallets.find((w) => w.isDefault) || availableTargetWallets[0];
    const fallbackId = defaultFallback ? defaultFallback.id : '';
    setTransferToWalletId(fallbackId);
    setReplacementWalletId(fallbackId);

    walletService
      .getPreArchiveInfo(wallet.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setPreflightData(res.data);
        } else {
          setErrorMsg(getUserErrorMessage(res, 'error.load'));
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(getUserErrorMessage(err, 'error.load'));
      })
      .finally(() => {
        if (isMounted) setIsLoadingPreflight(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, wallet, availableTargetWallets]);

  if (!isOpen || !wallet) return null;

  const balance = preflightData?.balance ?? (wallet.currentBalance || 0);
  const activeInstallments = preflightData?.activeInstallments || [];
  const isDefaultWallet = preflightData?.isDefault ?? wallet.isDefault;
  const activeWalletsCount = preflightData?.activeWalletsCount ?? wallets.length;

  const hasDebt = balance < 0;
  const hasBalance = balance > 0;
  const hasInstallments = activeInstallments.length > 0;

  const canSubmit =
    !isLoadingPreflight &&
    !isSubmitting &&
    !isDefaultWallet &&
    activeWalletsCount > 1 &&
    !hasDebt &&
    (!hasBalance || Boolean(transferToWalletId)) &&
    (!hasInstallments || Boolean(replacementWalletId));

  const handleConfirmArchive = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await archiveWallet(wallet.id, {
        transferToWalletId: hasBalance ? transferToWalletId : undefined,
        replacementWalletId: hasInstallments ? replacementWalletId : undefined
      });

      addToast({
        type: 'success',
        message: `Đã đóng và lưu trữ ví "${wallet.name}".`,
        duration: 4000
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(getUserErrorMessage(err, 'error.save'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      busy={isSubmitting}
      overlayClassName="modal-overlay open"
      className="modal-container archive-wallet-modal"
      labelledBy="archive-modal-title"
      panelProps={{ style: { maxWidth: '540px' } }}
    >
        {/* Header */}
        <div className="modal-header modal-header--box">
          <div className="modal-header__div--layout">
            <div className="modal-header__div--box"
             
            >
              <Icon name="archive" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </div>
            <div>
              <h3 className="modal-header__h3--text" id="archive-modal-title">
                Lưu trữ & Đóng ví
              </h3>
              <div className="modal-header__div--text">
                Ví: <strong>{wallet.name}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng cửa sổ"
          >
            <Icon name="close" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body modal-body--layout">
          {/* Lỗi chung */}
          {errorMsg && (
            <div className="modal-body__div--box"
             
            >
              {errorMsg}
            </div>
          )}

          {isLoadingPreflight ? (
            <div className="modal-body__div--box2">
              <div className="btn-spinner btn-spinner--box" />
              <div>Đang kiểm tra số dư và các liên kết của ví...</div>
            </div>
          ) : (
            <>
              {/* Cảnh báo nếu là ví mặc định */}
              {isDefaultWallet && (
                <div className="modal-body__div--box3"
                 
                >
                  <Icon name="alertCircle" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="archive-wallet-lead-icon" />
                  <div>
                    <strong>Đây là ví mặc định:</strong> Bạn không thể đóng ví mặc định. Vui lòng vào phần chỉnh sửa một ví khác và chọn làm mặc định trước.
                  </div>
                </div>
              )}

              {/* Cảnh báo nếu là ví duy nhất còn lại */}
              {!isDefaultWallet && activeWalletsCount <= 1 && (
                <div className="modal-body__div--box3"
                 
                >
                  <Icon name="alertCircle" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="archive-wallet-lead-icon" />
                  <div>
                    <strong>Không thể đóng ví:</strong> Bạn phải duy trì ít nhất một ví hoạt động trong hệ thống.
                  </div>
                </div>
              )}

              {/* ── CARD 1: Trạng thái số dư ── */}
              <div className="modal-body__div--box4"
               
              >
                <div className="modal-body__div--layout" style={{ '--modal-body__div-margin-bottom': hasBalance || hasDebt ? '10px' : '0' }}>
                  <div className="modal-body__div--layout2">
                    <Icon name="creditCard" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span className="modal-body__span--text">Số dư hiện tại</span>
                  </div>
                  <div className="modal-body__div--text"
                    style={{ '--modal-body__div-color': hasDebt
                        ? 'var(--color-danger, #ef4444)'
                        : hasBalance
                        ? 'var(--color-warning, #d97706)'
                        : 'var(--color-success, #10b981)' }}
                  >
                    {formatCurrency(balance)}
                  </div>
                </div>

                {/* TH1: Số dư = 0 */}
                {!hasDebt && !hasBalance && (
                  <div className="modal-body__div--layout3"
                   
                  >
                    <Icon name="check" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <span>{t('wallet.readyToArchive', { amount: formatCurrency(0) })}</span>
                  </div>
                )}

                {/* TH2: Số dư âm (có nợ) */}
                {hasDebt && (
                  <div className="modal-body__div--layout4"
                   
                  >
                    <AlertTriangleOutlineIcon size={16} color="currentColor" />
                    <span>Ví đang có dư nợ. Theo chuẩn kế toán, bạn cần nạp tiền thanh toán hết dư nợ trước khi đóng ví này.</span>
                  </div>
                )}

                {/* TH3: Số dư dương -> Chọn ví nhận */}
                {hasBalance && (
                  <div className="modal-body__div--box5">
                    <label className="modal-body__label--text"
                      htmlFor="transfer-target-select"
                     
                    >
                      Chuyển toàn bộ số dư sang ví nhận:
                    </label>
                    <CustomWalletDropdown
                      id="transfer-target-select"
                      wallets={availableTargetWallets}
                      value={transferToWalletId}
                      onChange={setTransferToWalletId}
                      disabled={isSubmitting}
                      placeholder="Chọn ví nhận số dư..."
                    />
                    <div className="modal-body__div--text2">
                      * Hệ thống sẽ tự động tạo 1 giao dịch chuyển tiền hợp lệ để tất toán sạch số dư ví.
                    </div>
                  </div>
                )}
              </div>

              {/* ── CARD 2: Trạng thái các khoản trả góp / định kỳ ── */}
              <div className="modal-body__div--box4"
               
              >
                <div className="modal-body__div--layout" style={{ '--modal-body__div-margin-bottom': hasInstallments ? '10px' : '0' }}>
                  <div className="modal-body__div--layout2">
                    <Icon name="rotateCcw" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span className="modal-body__span--text">Khoản trả góp / định kỳ</span>
                  </div>
                  <span className="modal-body__span--text2"
                    style={{ '--modal-body__span-background-color': hasInstallments ? 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))' : 'var(--color-success-bg, rgba(16, 185, 129, 0.12))', '--modal-body__span-color': hasInstallments ? 'var(--color-warning, #d97706)' : 'var(--color-success, #10b981)' }}
                  >
                    {hasInstallments ? `${activeInstallments.length} khoản đang chạy` : 'Không có liên kết'}
                  </span>
                </div>

                {!hasInstallments ? (
                  <div className="modal-body__div--layout3"
                   
                  >
                    <Icon name="check" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <span>Không có khoản chi định kỳ nào bị gián đoạn.</span>
                  </div>
                ) : (
                  <div>
                    <div className="modal-body__div--layout5">
                      {activeInstallments.map((inst) => (
                        <span className="modal-body__span--box"
                          key={inst.id}
                         
                        >
                          {inst.name} ({formatCurrency(inst.amount)})
                        </span>
                      ))}
                    </div>

                    <label className="modal-body__label--text"
                      htmlFor="installment-target-select"
                     
                    >
                      Chuyển sang ví thanh toán thay thế:
                    </label>
                    <CustomWalletDropdown
                      id="installment-target-select"
                      wallets={availableTargetWallets}
                      value={replacementWalletId}
                      onChange={setReplacementWalletId}
                      disabled={isSubmitting}
                      placeholder="Chọn ví thay thế..."
                    />
                  </div>
                )}
              </div>

              {/* ── CARD 3: Cam kết bảo toàn Audit Trail ── */}
              <div className="modal-body__div--box6"
               
              >
                <Icon name="shieldCheckAlt" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="archive-wallet-lead-icon archive-wallet-lead-icon--brand" />
                <div>
                  <strong>Bảo toàn lịch sử 100%:</strong> Ví sau khi lưu trữ sẽ ẩn khỏi danh sách chi tiêu mới. Toàn bộ giao dịch và báo cáo quá khứ của ví vẫn được giữ nguyên vẹn và bạn có thể mở lại ví bất kỳ lúc nào.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer modal-footer--layout">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button variant="warning" onClick={handleConfirmArchive} disabled={!canSubmit} loading={isSubmitting}>
            <span>Xác nhận Lưu trữ & Đóng ví</span>
          </Button>
        </div>
    </Dialog>
  );
}
