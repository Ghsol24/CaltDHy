import React from 'react';
import { Button } from '../../../components/ui/Button';
import { CheckOutlineIcon } from '../../../components/ui/AppIcons';
import { AVATAR_PRESETS } from './avatarPresets';

export function SettingsProfileTab({ activeTab, avatar, currentPassword, email, fileInputRef, handleCancelProfile, handleFileChange, handleSaveProfile, isProfileDirty, isProfileSaving, name, profileMsg, setAvatar, setCurrentPassword, setEmail, setName, setShowPresetPicker, showPresetPicker, user, userInitials }) {
  return (activeTab === 'profile' && (
    <form onSubmit={handleSaveProfile} className="account-tab-pane">
      <div className="account-tab-intro">
        <h3 className="account-tab-intro-title">Hồ sơ cá nhân</h3>
      </div>
  
      {/* Avatar Section */}
      <div className="account-avatar-card">
        <div className="account-avatar-preview-box" aria-label="Xem trước ảnh đại diện">
          {avatar ? (
            avatar.startsWith('data:image') || avatar.startsWith('http') ? (
              <img src={avatar} alt="Avatar" className="account-avatar-img" />
            ) : (
              <span className="account-avatar-emoji">{avatar}</span>
            )
          ) : (
            <span>{userInitials}</span>
          )}
        </div>
  
        <div className="account-avatar-controls">
          <div className="account-avatar-actions-row">
            <button
              type="button"
              className="btn-avatar-action btn-avatar-upload"
              onClick={() => fileInputRef.current?.click()}
            >
              Tải ảnh lên
            </button>
            <button
              type="button"
              className="btn-avatar-action btn-avatar-preset"
              onClick={() => setShowPresetPicker((prev) => !prev)}
            >
              Chọn avatar
            </button>
            {avatar && (
              <button
                type="button"
                className="btn-avatar-action btn-avatar-remove"
                onClick={() => setAvatar('')}
              >
                Xóa ảnh
              </button>
            )}
          </div>
          <p className="account-avatar-hint">Định dạng JPG, PNG hoặc WebP. Tối đa 1MB.</p>
        </div>
        <input className="account-avatar-card__input--layout"
          type="file"
          ref={fileInputRef}
          accept="image/jpeg, image/png, image/webp"
         
          onChange={handleFileChange}
        />
      </div>
  
      {/* Preset Avatar Popover Grid */}
      {showPresetPicker && (
        <div className="account-preset-picker">
          <p className="account-preset-title">Chọn biểu tượng đại diện</p>
          <div className="account-preset-grid">
            {AVATAR_PRESETS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="account-preset-btn"
                onClick={() => {
                  setAvatar(emoji);
                  setShowPresetPicker(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
  
      {/* Form Fields */}
      <div className="account-form-group">
        <label htmlFor="acc-display-name" className="account-label">
          Tên hiển thị
        </label>
        <div className="account-input-box">
          <input
            id="acc-display-name"
            className="account-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên hiển thị"
            required
            maxLength={50}
          />
        </div>
      </div>
  
      <div className="account-form-group">
        <label htmlFor="acc-email" className="account-label">
          <span>Địa chỉ Email</span>
          <span className="account-verified-badge account-verified-badge--layout">
            {user?.emailVerified ? <><CheckOutlineIcon size={12} /> Đã xác minh</> : 'Chưa xác minh'}
          </span>
        </label>
        <div className="account-input-box">
          <input
            id="acc-email"
            className="account-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>
      </div>
  
      {email.trim().toLowerCase() !== user?.email && (
        <div className="account-form-group">
          <label htmlFor="acc-email-password" className="account-label">Mật khẩu hiện tại để đổi email</label>
          <div className="account-input-box">
            <input id="acc-email-password" className="account-input" type="password"
              autoComplete="current-password" value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)} required />
          </div>
        </div>
      )}
      {/* Inline Message */}
      {profileMsg.text && (
        <div className={`account-feedback-msg ${profileMsg.type}`} role={profileMsg.type === 'error' ? 'alert' : 'status'}>
          {profileMsg.text}
        </div>
      )}
  
      {/* Footer Actions */}
      <div className="account-footer-actions">
        <Button variant="secondary" size="lg" onClick={handleCancelProfile} disabled={!isProfileDirty || isProfileSaving}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={!isProfileDirty} loading={isProfileSaving}>
          {isProfileSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  )) || null;
}
