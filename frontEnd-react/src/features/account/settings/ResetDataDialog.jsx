import React from 'react';
import { Dialog } from '../../../components/ui/Dialog';
import { AlertTriangleOutlineIcon } from '../../../components/ui/AppIcons';

export function ResetDataDialog({ handleConfirmResetData, isResetDialogOpen, isResetting, resetConfirmInput, resetError, setIsResetDialogOpen, setResetConfirmInput, transactions }) {
  return (
    <Dialog
      isOpen={isResetDialogOpen}
      onClose={() => setIsResetDialogOpen(false)}
      busy={isResetting}
      closeOnBackdrop={false}
      portal={false}
      overlayClassName="account-reset-dialog-overlay"
      className="account-reset-dialog"
      label="Xác nhận đặt lại dữ liệu"
      panelProps={{ role: 'alertdialog' }}
    >
          <h3 className="account-reset-title">
            <AlertTriangleOutlineIcon size={18} />
            Xác nhận đặt lại dữ liệu chi tiêu
          </h3>
    
          <p className="account-reset-dialog__p--box">
            Thao tác này sẽ <strong>xóa vĩnh viễn</strong>:
          </p>
    
          <ul className="account-reset-list">
            <li>Toàn bộ {transactions?.length || 0} giao dịch đã ghi nhận</li>
            <li>Tất cả cấu hình hạn mức ngân sách tháng</li>
            <li>Lịch sử thống kê và phân tích dòng tiền</li>
          </ul>
    
          <p className="account-danger-note">
            Hành động này không thể hoàn tác! Tài khoản đăng nhập của bạn sẽ không bị ảnh hưởng.
          </p>
    
          <div className="account-reset-confirm-box">
            <label htmlFor="reset-keyword-input">
              Nhập chính xác chữ <strong>RESET</strong> để mở khóa:
            </label>
            <input
              id="reset-keyword-input"
              className="account-reset-input"
              value={resetConfirmInput}
              onChange={(e) => setResetConfirmInput(e.target.value)}
              placeholder="RESET"
              autoFocus
            />
          </div>
    
          {resetError && (
            <div className="account-feedback-msg error" role="alert">
              {resetError}
            </div>
          )}
    
          <div className="account-reset-actions">
            <button
              type="button"
              className="btn-account-cancel"
              onClick={() => setIsResetDialogOpen(false)}
              disabled={isResetting}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              className="btn-confirm-reset-delete"
              disabled={resetConfirmInput.trim() !== 'RESET' || isResetting}
              onClick={handleConfirmResetData}
            >
              {isResetting ? 'Đang xóa...' : 'Xóa sạch dữ liệu'}
            </button>
          </div>
    </Dialog>
  );
}
