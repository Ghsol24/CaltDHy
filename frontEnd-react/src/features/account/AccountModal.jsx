import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { formatDate } from '../../utils/formatters';

// Bộ sưu tập avatar preset (biểu tượng tài chính & phong cách cao cấp, tuyệt đối không có khỉ)
const AVATAR_PRESETS = [
  '💼', '🚀', '⚡', '🎯', '👑', '💎', '🏆', '☕',
  '🦁', '🦊', '🐱', '🌲', '🍀', '🛸', '🎮', '💻'
];

/**
 * Helper nén ảnh client-side qua HTML Canvas
 * Giữ kích thước tối đa 400x400 và chất lượng 0.8 để đảm bảo Base64 < 300KB
 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Không thể tải dữ liệu ảnh.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Đánh giá độ mạnh mật khẩu (Password Strength Meter)
 */
function evaluatePasswordStrength(pwd) {
  if (!pwd) return { score: 0, level: 'none', label: '' };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score <= 2) return { score: 1, level: 'weak', label: 'Yếu' };
  if (score <= 4) return { score: 2, level: 'fair', label: 'Khá' };
  return { score: 3, level: 'strong', label: 'Mạnh' };
}

/**
 * Nhận diện thiết bị và trình duyệt hiện tại
 */
function detectCurrentDevice() {
  const ua = navigator.userAgent || '';
  let os = 'Thiết bị';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Trình duyệt';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';
  else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';

  return `${browser} trên ${os}`;
}

export function AccountModal() {
  const { user, updateProfile } = useAuthStore();
  const spending = useSpendingStore();
  const { transactions, budgets, resetAllFinancialData } = useTransactionStore();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'data'

  // Tab 1: Profile states
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Tab 2: Security & Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [isPwdSaving, setIsPwdSaving] = useState(false);

  // Tab 3: Data & Danger Zone states
  const [copySuccess, setCopySuccess] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  // Sync state khi user thay đổi từ store
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Đóng modal khi bấm Escape (trừ khi đang mở dialog reset)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isResetDialogOpen) {
          setIsResetDialogOpen(false);
        } else {
          spending.closeAccountModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isResetDialogOpen, spending]);

  // Dirty state tracking cho tab Profile
  const isProfileDirty = useMemo(() => {
    const origName = user?.name || '';
    const origEmail = user?.email || '';
    const origAvatar = user?.avatar || '';
    return name.trim() !== origName.trim() || email.trim() !== origEmail.trim() || avatar !== origAvatar;
  }, [user, name, email, avatar]);

  // Password strength
  const pwdStrength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword]);

  // Initials cho avatar fallback
  const userInitials = useMemo(() => {
    const displayName = name || user?.name || 'User';
    return displayName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'U';
  }, [name, user]);

  // Xử lý chọn file ảnh từ máy
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileMsg({ type: 'error', text: 'Vui lòng chọn định dạng ảnh JPG, PNG hoặc WebP.' });
      return;
    }

    try {
      const compressedBase64 = await compressImage(file);
      setAvatar(compressedBase64);
      setShowPresetPicker(false);
      setProfileMsg({ type: '', text: '' });
    } catch {
      setProfileMsg({ type: 'error', text: 'Không thể xử lý file ảnh. Vui lòng thử lại.' });
    } finally {
      e.target.value = '';
    }
  };

  // Lưu thông tin hồ sơ
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileMsg({ type: 'error', text: 'Tên hiển thị không được để trống.' });
      return;
    }

    setIsProfileSaving(true);
    setProfileMsg({ type: '', text: '' });

    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim(),
        avatar: avatar
      });
      setProfileMsg({ type: 'success', text: 'Hồ sơ đã được lưu thành công!' });
      setTimeout(() => setProfileMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Không thể lưu hồ sơ.' });
    } finally {
      setIsProfileSaving(false);
    }
  };

  // Hủy thay đổi hồ sơ
  const handleCancelProfile = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setAvatar(user?.avatar || '');
    setProfileMsg({ type: '', text: '' });
    setShowPresetPicker(false);
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setPwdMsg({ type: 'error', text: 'Vui lòng nhập mật khẩu hiện tại.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Xác nhận mật khẩu mới không trùng khớp.' });
      return;
    }

    setIsPwdSaving(true);
    setPwdMsg({ type: '', text: '' });

    try {
      await updateProfile({
        currentPassword,
        newPassword
      });
      setPwdMsg({
        type: 'success',
        text: 'Đổi mật khẩu thành công! Các phiên đăng nhập trên thiết bị khác đã được kết thúc.'
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdMsg({ type: '', text: '' }), 6000);
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.message || 'Không thể đổi mật khẩu.' });
    } finally {
      setIsPwdSaving(false);
    }
  };

  // Sao chép UID
  const handleCopyUid = () => {
    const uid = user?.id || '';
    if (!uid) return;
    navigator.clipboard.writeText(uid);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Xuất dữ liệu JSON
  const handleExportData = () => {
    const exportPayload = {
      exportDate: new Date().toISOString(),
      user: {
        id: user?.id,
        name: user?.name,
        email: user?.email
      },
      transactions: transactions || [],
      budgets: budgets || {}
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `caltdhy_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Xác nhận Reset dữ liệu chi tiêu
  const handleConfirmResetData = async () => {
    if (resetConfirmInput.trim() !== 'RESET') return;

    setIsResetting(true);
    setResetError('');

    try {
      await resetAllFinancialData();
      setIsResetDialogOpen(false);
      setResetConfirmInput('');
      spending.closeAccountModal();
    } catch (err) {
      setResetError(err.message || 'Không thể đặt lại dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <div
        className="account-modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isResetDialogOpen) {
            spending.closeAccountModal();
          }
        }}
        role="presentation"
      >
        <div
          className="account-modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="Quản lý tài khoản"
        >
          {/* ── Fixed Header ── */}
          <div className="account-modal-header">
            <div className="account-header-lead">
              <div className="account-header-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="account-header-titles">
                <h2 className="account-header-title">Quản lý tài khoản</h2>
                <p className="account-header-desc">Quản lý thông tin hiển thị, bảo mật và dữ liệu</p>
              </div>
            </div>
            <button
              type="button"
              className="account-modal-close-btn"
              onClick={spending.closeAccountModal}
              aria-label="Đóng quản lý tài khoản"
            >
              ✕
            </button>
          </div>

          {/* ── Fixed Navigation Tabs ── */}
          <nav className="account-nav-tabs" role="tablist" aria-label="Các mục tài khoản">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'profile'}
              className={`account-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Hồ sơ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'security'}
              className={`account-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              Bảo mật
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'data'}
              className={`account-tab-btn ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              Dữ liệu & riêng tư
            </button>
          </nav>

          {/* ── Scrollable Body ── */}
          <div className="account-modal-body">
            {/* ── TAB 1: HỒ SƠ ── */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="account-tab-pane">
                <div className="account-tab-intro">
                  <h3 className="account-tab-intro-title">Hồ sơ cá nhân</h3>
                  <p className="account-tab-intro-sub">Quản lý thông tin hiển thị và ảnh đại diện trên tài khoản</p>
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
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg, image/png, image/webp"
                    style={{ display: 'none' }}
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
                    <span className="account-verified-badge">✓ Đã xác minh</span>
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

                {/* Inline Message */}
                {profileMsg.text && (
                  <div className={`account-feedback-msg ${profileMsg.type}`}>
                    {profileMsg.text}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="account-footer-actions">
                  <button
                    type="button"
                    className="btn-account-cancel"
                    onClick={handleCancelProfile}
                    disabled={!isProfileDirty || isProfileSaving}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn-account-save"
                    disabled={!isProfileDirty || isProfileSaving}
                  >
                    {isProfileSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            )}

            {/* ── TAB 2: BẢO MẬT ── */}
            {activeTab === 'security' && (
              <div className="account-tab-pane">
                <div className="account-tab-intro">
                  <h3 className="account-tab-intro-title">Bảo mật tài khoản</h3>
                  <p className="account-tab-intro-sub">Bảo vệ tài khoản và quản lý thông tin phiên đăng nhập</p>
                </div>

                {/* Change Password Form */}
                <form onSubmit={handleChangePassword} className="account-card-panel" style={{ gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="account-panel-label" style={{ fontSize: '13.5px', color: 'var(--text-primary, #173126)' }}>
                      Đổi mật khẩu
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #7E9287)' }}>
                      Mật khẩu cần ít nhất 6 ký tự để bảo vệ tài khoản an toàn
                    </span>
                  </div>

                  <div className="account-form-group">
                    <label className="account-label">Mật khẩu hiện tại</label>
                    <div className="account-input-box">
                      <input
                        className="account-input has-toggle"
                        type={showCurrentPwd ? 'text' : 'password'}
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
                    <label className="account-label">Mật khẩu mới</label>
                    <div className="account-input-box">
                      <input
                        className="account-input has-toggle"
                        type={showNewPwd ? 'text' : 'password'}
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
                          {pwdStrength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="account-form-group">
                    <label className="account-label">Xác nhận mật khẩu mới</label>
                    <div className="account-input-box">
                      <input
                        className="account-input has-toggle"
                        type={showConfirmPwd ? 'text' : 'password'}
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
                    <div className={`account-feedback-msg ${pwdMsg.type}`}>
                      {pwdMsg.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      type="submit"
                      className="btn-account-save"
                      disabled={isPwdSaving || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {isPwdSaving ? 'Đang đổi...' : 'Cập nhật mật khẩu'}
                    </button>
                  </div>
                </form>

                {/* Sessions Section */}
                <div className="account-card-panel">
                  <div className="account-card-panel-row">
                    <div>
                      <div className="account-panel-label">Phiên đăng nhập hiện tại</div>
                      <div className="account-panel-val" style={{ marginTop: 2 }}>{detectCurrentDevice()}</div>
                    </div>
                    <span className="account-session-badge">Đang hoạt động</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted, #7E9287)', lineHeight: 1.4 }}>
                    Hệ thống tự động vô hiệu hóa các phiên đăng nhập cũ trên thiết bị khác mỗi khi bạn thay đổi mật khẩu.
                  </p>
                </div>
              </div>
            )}

            {/* ── TAB 3: DỮ LIỆU & RIÊNG TƯ ── */}
            {activeTab === 'data' && (
              <div className="account-tab-pane">
                <div className="account-tab-intro">
                  <h3 className="account-tab-intro-title">Dữ liệu & riêng tư</h3>
                  <p className="account-tab-intro-sub">Xem tóm tắt thông số và quản lý dữ liệu chi tiêu</p>
                </div>

                {/* Account Metadata */}
                <div className="account-card-panel">
                  <div className="account-card-panel-row">
                    <span className="account-panel-label">Mã định danh (UID)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="account-panel-val" style={{ fontFamily: 'var(--font-mono)' }}>
                        {user?.id ? `${user.id.substring(0, 8)}...` : 'N/A'}
                      </span>
                      <button
                        type="button"
                        className="btn-pwd-text-toggle"
                        style={{ position: 'static' }}
                        onClick={handleCopyUid}
                      >
                        {copySuccess ? 'Đã chép' : 'Sao chép'}
                      </button>
                    </div>
                  </div>

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
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #7E9287)', marginTop: 2 }}>
                        Tải xuống file JSON sao lưu đầy đủ giao dịch và ngân sách.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-avatar-action btn-avatar-preset"
                      onClick={handleExportData}
                    >
                      Xuất JSON
                    </button>
                  </div>
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
            )}
          </div>
        </div>
      </div>

      {/* ── Secondary Dialog: Confirmation Reset Financial Data ── */}
      {isResetDialogOpen && (
        <div className="account-reset-dialog-overlay" role="presentation">
          <div
            className="account-reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Xác nhận đặt lại dữ liệu"
          >
            <h3 className="account-reset-title">
              ⚠️ Xác nhận đặt lại dữ liệu chi tiêu
            </h3>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary, #173126)' }}>
              Thao tác này sẽ <strong>xóa vĩnh viễn</strong>:
            </p>

            <ul className="account-reset-list">
              <li>Toàn bộ {transactions?.length || 0} giao dịch đã ghi nhận</li>
              <li>Tất cả cấu hình hạn mức ngân sách tháng</li>
              <li>Lịch sử thống kê và phân tích dòng tiền</li>
            </ul>

            <p style={{ margin: 0, fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
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
              <div className="account-feedback-msg error">
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
          </div>
        </div>
      )}
    </>
  );
}
