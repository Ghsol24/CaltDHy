import React from 'react';
import { Button } from '../../../components/ui/Button';
import { detectCurrentDevice } from './accountHelpers';
import { useTranslation } from '../../../i18n/useTranslation';

export function SettingsSecurityTab({ activeTab, confirmPassword, currentPassword, handleChangePassword, isPwdSaving, newPassword, pwdMsg, pwdStrength, setConfirmPassword, setCurrentPassword, setNewPassword, setShowConfirmPwd, setShowCurrentPwd, setShowNewPwd, showConfirmPwd, showCurrentPwd, showNewPwd }) {
  const { t } = useTranslation();
  return (activeTab === 'security' && (
    <div className="account-tab-pane">
      <div className="account-tab-intro">
        <h3 className="account-tab-intro-title">Bảo mật tài khoản</h3>
      </div>
  
      {/* Change Password Form */}
      <form onSubmit={handleChangePassword} className="account-card-panel account-card-panel--layout">
        <div className="account-card-panel__div--layout">
          <span className="account-panel-label account-panel-label--text">
            Đổi mật khẩu
          </span>
          <span className="account-card-panel__span--text">
            Mật khẩu cần ít nhất 12 ký tự để bảo vệ tài khoản an toàn
          </span>
        </div>
  
        <div className="account-form-group">
          <label htmlFor="acc-current-password" className="account-label">Mật khẩu hiện tại</label>
          <div className="account-input-box">
            <input
              id="acc-current-password"
              className="account-input has-toggle"
              type={showCurrentPwd ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
            <button
              type="button"
              className="btn-pwd-text-toggle"
              onClick={() => setShowCurrentPwd((prev) => !prev)}
            >
              {showCurrentPwd ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </div>
  
        <div className="account-form-group">
          <label htmlFor="acc-new-password" className="account-label">Mật khẩu mới</label>
          <div className="account-input-box">
            <input
              id="acc-new-password"
              className="account-input has-toggle"
              type={showNewPwd ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
            <button
              type="button"
              className="btn-pwd-text-toggle"
              onClick={() => setShowNewPwd((prev) => !prev)}
            >
              {showNewPwd ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
  
          {/* Password Strength Meter */}
          {newPassword && (
            <div className="account-strength-bar">
              <div className="account-strength-segments">
                <div className={`account-strength-seg ${pwdStrength.score >= 1 ? pwdStrength.level : ''}`} />
                <div className={`account-strength-seg ${pwdStrength.score >= 2 ? pwdStrength.level : ''}`} />
                <div className={`account-strength-seg ${pwdStrength.score >= 3 ? pwdStrength.level : ''}`} />
              </div>
              <span className={`account-strength-text ${pwdStrength.level}`}>
                {t(`account.passwordStrength.${pwdStrength.level}`)}
              </span>
            </div>
          )}
        </div>
  
        <div className="account-form-group">
          <label htmlFor="acc-confirm-password" className="account-label">Xác nhận mật khẩu mới</label>
          <div className="account-input-box">
            <input
              id="acc-confirm-password"
              className="account-input has-toggle"
              type={showConfirmPwd ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
            <button
              type="button"
              className="btn-pwd-text-toggle"
              onClick={() => setShowConfirmPwd((prev) => !prev)}
            >
              {showConfirmPwd ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </div>
  
        {pwdMsg.text && (
          <div className={`account-feedback-msg ${pwdMsg.type}`} role={pwdMsg.type === 'error' ? 'alert' : 'status'}>
            {pwdMsg.text}
          </div>
        )}
  
        <div className="account-card-panel__div--layout2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!currentPassword || !newPassword || !confirmPassword}
            loading={isPwdSaving}
          >
            {isPwdSaving ? 'Đang đổi...' : 'Cập nhật mật khẩu'}
          </Button>
        </div>
      </form>
  
      {/* Sessions Section */}
      <div className="account-card-panel">
        <div className="account-card-panel-row">
          <div>
            <div className="account-panel-label">Phiên đăng nhập hiện tại</div>
            <div className="account-panel-val account-panel-val--box">{detectCurrentDevice(t)}</div>
          </div>
          <span className="account-session-badge">Đang hoạt động</span>
        </div>
        <p className="account-card-panel__p--text">
          Hệ thống tự động vô hiệu hóa các phiên đăng nhập cũ trên thiết bị khác mỗi khi bạn thay đổi mật khẩu.
        </p>
      </div>
    </div>
  )) || null;
}
