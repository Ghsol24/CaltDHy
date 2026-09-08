import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { walletService } from '../../services/walletService';
import { formatCurrency } from '../../utils/formatters';

export function ArchiveWalletModal({ isOpen, onClose, wallet = null, onSuccess = null }) {
  const { wallets, archiveWallet } = useWalletStore();
  const { addToast } = useToastStore();

  const [isLoadingPreflight, setIsLoadingPreflight] = useState(true);
  const [preflightData, setPreflightData] = useState(null);
  const [transferToWalletId, setTransferToWalletId] = useState('');
  const [replacementWalletId, setReplacementWalletId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const modalRef = useRef(null);
  useFocusTrap(modalRef, isOpen);

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
          setErrorMsg(res.message || 'Không thể tải thông tin kiểm tra ví.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err.message || 'Lỗi mạng khi kiểm tra ví.');
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
      setErrorMsg(err.message || 'Không thể lưu trữ ví.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="modal-container archive-wallet-modal" ref={modalRef} style={{ maxWidth: '540px' }}>
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))',
                border: '1px solid var(--color-warning-border, rgba(245, 158, 11, 0.3))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-warning, #d97706)'
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="20" height="5" x="2" y="3" rx="1" />
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                <path d="M10 12h4" />
              </svg>
            </div>
            <div>
              <h3 id="archive-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                Lưu trữ & Đóng ví
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 20px' }}>
          {/* Lỗi chung */}
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))',
                border: '1px solid var(--color-danger-border, rgba(239, 68, 68, 0.3))',
                color: 'var(--color-danger, #ef4444)',
                fontSize: '0.88rem'
              }}
            >
              {errorMsg}
            </div>
          )}

          {isLoadingPreflight ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary, #6b7280)' }}>
              <div className="btn-spinner" style={{ margin: '0 auto 12px auto', width: '24px', height: '24px' }} />
              <div>Đang kiểm tra số dư và các liên kết của ví...</div>
            </div>
          ) : (
            <>
              {/* Cảnh báo nếu là ví mặc định */}
              {isDefaultWallet && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))',
                    border: '1px solid var(--color-danger-border, rgba(239, 68, 68, 0.3))',
                    color: 'var(--color-danger, #ef4444)',
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <strong>Đây là ví mặc định:</strong> Bạn không thể đóng ví mặc định. Vui lòng vào phần chỉnh sửa một ví khác và chọn làm mặc định trước.
                  </div>
                </div>
              )}

              {/* Cảnh báo nếu là ví duy nhất còn lại */}
              {!isDefaultWallet && activeWalletsCount <= 1 && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))',
                    border: '1px solid var(--color-danger-border, rgba(239, 68, 68, 0.3))',
                    color: 'var(--color-danger, #ef4444)',
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <strong>Không thể đóng ví:</strong> Bạn phải duy trì ít nhất một ví hoạt động trong hệ thống.
                  </div>
                </div>
              )}

              {/* ── CARD 1: Trạng thái số dư ── */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--surface-subtle, rgba(0, 0, 0, 0.03))',
                  border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasBalance || hasDebt ? '10px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Số dư hiện tại</span>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: hasDebt
                        ? 'var(--color-danger, #ef4444)'
                        : hasBalance
                        ? 'var(--color-warning, #d97706)'
                        : 'var(--color-success, #10b981)'
                    }}
                  >
                    {formatCurrency(balance)}
                  </div>
                </div>

                {/* TH1: Số dư = 0 */}
                {!hasDebt && !hasBalance && (
                  <div
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--color-success, #10b981)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '6px'
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Số dư ví đã sạch (0 đ). Sẵn sàng để lưu trữ.</span>
                  </div>
                )}

                {/* TH2: Số dư âm (có nợ) */}
                {hasDebt && (
                  <div
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--color-danger, #ef4444)',
                      lineHeight: 1.4,
                      marginTop: '6px'
                    }}
                  >
                    ⚠️ Ví đang có dư nợ. Theo chuẩn kế toán, bạn cần nạp tiền thanh toán hết dư nợ trước khi đóng ví này.
                  </div>
                )}

                {/* TH3: Số dư dương -> Chọn ví nhận */}
                {hasBalance && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-subtle, rgba(0,0,0,0.08))' }}>
                    <label
                      htmlFor="transfer-target-select"
                      style={{ display: 'block', fontSize: '0.84rem', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary, #6b7280)' }}
                    >
                      Chuyển toàn bộ số dư sang ví nhận:
                    </label>
                    <select
                      id="transfer-target-select"
                      className="form-input"
                      value={transferToWalletId}
                      onChange={(e) => setTransferToWalletId(e.target.value)}
                      disabled={isSubmitting}
                      style={{ width: '100%', fontSize: '0.9rem' }}
                    >
                      {availableTargetWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.icon ? `${w.icon} ` : ''}{w.name} {w.isDefault ? '(Mặc định)' : ''}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', marginTop: '4px' }}>
                      * Hệ thống sẽ tự động tạo 1 giao dịch chuyển tiền hợp lệ để tất toán sạch số dư ví.
                    </div>
                  </div>
                )}
              </div>

              {/* ── CARD 2: Trạng thái các khoản trả góp / định kỳ ── */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--surface-subtle, rgba(0, 0, 0, 0.03))',
                  border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasInstallments ? '10px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21h5v-5" />
                    </svg>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Khoản trả góp / định kỳ</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: hasInstallments ? 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))' : 'var(--color-success-bg, rgba(16, 185, 129, 0.12))',
                      color: hasInstallments ? 'var(--color-warning, #d97706)' : 'var(--color-success, #10b981)'
                    }}
                  >
                    {hasInstallments ? `${activeInstallments.length} khoản đang chạy` : 'Không có liên kết'}
                  </span>
                </div>

                {!hasInstallments ? (
                  <div
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--color-success, #10b981)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '6px'
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Không có khoản chi định kỳ nào bị gián đoạn.</span>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0 12px 0' }}>
                      {activeInstallments.map((inst) => (
                        <span
                          key={inst.id}
                          style={{
                            fontSize: '0.78rem',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--surface-card, rgba(0,0,0,0.06))',
                            border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                            color: 'var(--text-primary, #111827)'
                          }}
                        >
                          {inst.name} ({formatCurrency(inst.amount)})
                        </span>
                      ))}
                    </div>

                    <label
                      htmlFor="installment-target-select"
                      style={{ display: 'block', fontSize: '0.84rem', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary, #6b7280)' }}
                    >
                      Chuyển sang ví thanh toán thay thế:
                    </label>
                    <select
                      id="installment-target-select"
                      className="form-input"
                      value={replacementWalletId}
                      onChange={(e) => setReplacementWalletId(e.target.value)}
                      disabled={isSubmitting}
                      style={{ width: '100%', fontSize: '0.9rem' }}
                    >
                      {availableTargetWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.icon ? `${w.icon} ` : ''}{w.name} {w.isDefault ? '(Mặc định)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* ── CARD 3: Cam kết bảo toàn Audit Trail ── */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface, rgba(0,0,0,0.02))',
                  border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary, #6b7280)',
                  lineHeight: 1.45,
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-brand, #078A59)' }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <div>
                  <strong>Bảo toàn lịch sử 100%:</strong> Ví sau khi lưu trữ sẽ ẩn khỏi danh sách chi tiêu mới. Toàn bộ giao dịch và báo cáo quá khứ của ví vẫn được giữ nguyên vẹn và bạn có thể mở lại ví bất kỳ lúc nào.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.08))', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmArchive}
            disabled={!canSubmit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: canSubmit ? 'var(--color-warning, #d97706)' : undefined,
              borderColor: canSubmit ? 'var(--color-warning, #d97706)' : undefined
            }}
          >
            {isSubmitting && <span className="btn-spinner" style={{ width: '14px', height: '14px' }} />}
            <span>Xác nhận Lưu trữ & Đóng ví</span>
          </button>
        </div>
      </div>
    </div>
  );
}
