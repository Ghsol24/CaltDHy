import React from 'react';
import { formatDate } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';

export function SettingsDataTab({ activeTab, budgets, copyError, copySuccess, exportError, handleCopyUid, handleExportData, isExporting, setIsResetDialogOpen, setResetConfirmInput, setResetError, transactions, user }) {
  const { t } = useTranslation();
  return (activeTab === 'data' && (
    <div className="account-tab-pane">
      <div className="account-tab-intro">
        <h3 className="account-tab-intro-title">Dữ liệu & riêng tư</h3>
      </div>
  
      {/* Account Metadata */}
      <div className="account-card-panel">
        <div className="account-card-panel-row">
          <span className="account-panel-label">Mã định danh (UID)</span>
          <div className="account-card-panel-row__div--layout">
            <span className="account-panel-val account-panel-val--text">
              {user?.id ? `${user.id.substring(0, 8)}...` : 'N/A'}
            </span>
            <button
              type="button"
              className="btn-pwd-text-toggle btn-pwd-text-toggle--pos"
             
              onClick={handleCopyUid}
            >
              {copySuccess ? 'Đã chép' : 'Sao chép'}
            </button>
          </div>
        </div>
  
        {copyError && <div className="account-feedback-msg error" role="alert">{copyError}</div>}
  
        <div className="account-card-panel-row">
          <span className="account-panel-label">Ngày tham gia</span>
          <span className="account-panel-val">
            {user?.createdAt ? formatDate(user.createdAt) : 'Hôm nay'}
          </span>
        </div>
  
        <div className="account-card-panel-row">
          <span className="account-panel-label">Giao dịch đã lưu</span>
          <span className="account-panel-val">{transactions?.length || 0} giao dịch</span>
        </div>
  
        <div className="account-card-panel-row">
          <span className="account-panel-label">Hạn mức ngân sách</span>
          <span className="account-panel-val">
            {Object.keys(budgets || {}).length} danh mục
          </span>
        </div>
      </div>
  
      {/* Export Data */}
      <div className="account-card-panel">
        <div className="account-card-panel-row">
          <div>
            <div className="account-panel-label">Xuất dữ liệu tài chính</div>
            <div className="account-card-panel-row__div--text">
              Tải xuống bản sao lưu đầy đủ dữ liệu tài chính.
            </div>
          </div>
          <button
            type="button"
            className="btn-avatar-action btn-avatar-preset"
            onClick={handleExportData}
            disabled={isExporting}
          >
            {isExporting ? t('settings.exportPreparing') : 'Xuất JSON'}
          </button>
        </div>
        {exportError && <div className="account-feedback-msg error" role="alert">{exportError}</div>}
      </div>
  
      {/* Danger Zone */}
      <div className="account-danger-card">
        <h4 className="account-danger-title">Vùng nguy hiểm</h4>
        <p className="account-danger-desc">
          <strong>Đặt lại dữ liệu chi tiêu:</strong> Xóa toàn bộ lịch sử giao dịch và ngân sách đã lưu.
          Tài khoản và mật khẩu của bạn vẫn được giữ nguyên để tiếp tục sử dụng.
        </p>
        <button
          type="button"
          className="btn-danger-reset"
          onClick={() => {
            setResetConfirmInput('');
            setResetError('');
            setIsResetDialogOpen(true);
          }}
        >
          Đặt lại dữ liệu chi tiêu
        </button>
      </div>
    </div>
  )) || null;
}
