import React, { useState, useRef, useEffect, useEffectEvent, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { THEME_OPTIONS } from '../../utils/themes';
import { useLangStore } from '../../stores/useLangStore';
import { useCurrencyStore } from '../../stores/useCurrencyStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useJarStore } from '../../stores/useJarStore';
import { formatDate } from '../../utils/formatters';
import { evaluatePasswordStrength, MIN_PASSWORD_LENGTH } from '../../utils/passwordStrength';
import { useTranslation } from '../../i18n/useTranslation';
import { LOCALE_META, SUPPORTED_LOCALES } from '../../i18n/translations';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  CloseOutlineIcon,
  CheckOutlineIcon,
  AlertTriangleOutlineIcon
} from '../../components/ui/AppIcons';

// Bộ sưu tập avatar preset (biểu tượng tài chính & phong cách cao cấp, tuyệt đối không có khỉ)
const AVATAR_PRESETS = [
  '💼', '🚀', '⚡', '🎯', '👑', '💎', '🏆', '☕',
  '🦁', '🦊', '🐱', '🌲', '🍀', '🛸', '🎮', '💻'
];



const SETTINGS_GROUPS = [
  {
    labelKey: 'settings.account',
    items: [
      { id: 'profile', labelKey: 'settings.profile', icon: 'profile' },
      { id: 'security', labelKey: 'settings.security', icon: 'security' },
      { id: 'data', labelKey: 'settings.dataPrivacy', icon: 'data' }
    ]
  },
  {
    labelKey: 'settings.application',
    items: [
      { id: 'general', labelKey: 'settings.languageRegion', icon: 'general' },
      { id: 'appearance', labelKey: 'settings.appearance', icon: 'appearance' }
    ]
  },
  {
    labelKey: 'settings.support',
    items: [{ id: 'guide', labelKey: 'settings.guide', icon: 'guide' }]
  }
];

const SECTION_TITLE_KEYS = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.labelKey]))
);

function SettingsNavIcon({ type }) {
  const paths = {
    profile: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    security: <><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    data: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5" /><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" /></>,
    general: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></>,
    appearance: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
    guide: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z" /><path d="M8 7h8M8 11h8" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>
  };
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

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
 * Nhận diện thiết bị và trình duyệt hiện tại
 */
function detectCurrentDevice(t) {
  const ua = navigator.userAgent || '';
  let os = t('settings.unknownDevice');
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = t('settings.unknownBrowser');
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';
  else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';

  return t('settings.deviceOn', { browser, os });
}

export function AccountModal() {
  const { t, lang } = useTranslation();
  const { user, updateProfile } = useAuthStore();
  const logout = useAuthStore((state) => state.logout);
  const settingsSection = useSpendingStore((state) => state.settingsSection);
  const setSettingsSection = useSpendingStore((state) => state.setSettingsSection);
  const closeSettingsModal = useSpendingStore((state) => state.closeSettingsModal);
  const openHelpModal = useSpendingStore((state) => state.openHelpModal);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const setLang = useLangStore((state) => state.setLang);
  const displayCurrency = useCurrencyStore((state) => state.displayCurrency);
  const setDisplayCurrency = useCurrencyStore((state) => state.setDisplayCurrency);
  const usdAvailable = useCurrencyStore((state) => state.usdAvailable);
  const exchangeRate = useCurrencyStore((state) => state.exchangeRate);
  const confirm = useConfirmStore((state) => state.confirm);
  const isConfirmOpen = useConfirmStore((state) => state.isOpen);
  const { transactions, budgets, expenseCategories, incomeCategories, resetAllFinancialData } = useTransactionStore();
  const { wallets } = useWalletStore();
  const { jars, installments } = useJarStore();
  const isMobile = useIsMobile(720);
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const resetDialogRef = useRef(null);

  const activeTab = settingsSection || 'general';
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
  useFocusTrap(dialogRef, !isConfirmOpen && !isResetDialogOpen);
  useFocusTrap(resetDialogRef, isResetDialogOpen);

  // Sync state khi user thay đổi từ store
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Dirty state tracking cho tab Profile
  const isProfileDirty = useMemo(() => {
    const origName = user?.name || '';
    const origEmail = user?.email || '';
    const origAvatar = user?.avatar || '';
    return name.trim() !== origName.trim() || email.trim() !== origEmail.trim() || avatar !== origAvatar;
  }, [user, name, email, avatar]);

  const isSecurityDirty = Boolean(currentPassword || newPassword || confirmPassword);

  const discardProfileChanges = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setAvatar(user?.avatar || '');
    setCurrentPassword('');
    setProfileMsg({ type: '', text: '' });
    setShowPresetPicker(false);
  };

  const discardSecurityChanges = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwdMsg({ type: '', text: '' });
    setShowCurrentPwd(false);
    setShowNewPwd(false);
    setShowConfirmPwd(false);
  };

  const confirmDiscardChanges = async () => {
    if (!isProfileDirty && !isSecurityDirty) return true;
    const shouldDiscard = await confirm({
      title: 'Bỏ thay đổi chưa lưu?',
      message: 'Thông tin bạn vừa nhập trong Trung tâm cài đặt chưa được lưu.',
      confirmText: 'Bỏ thay đổi',
      cancelText: 'Tiếp tục chỉnh sửa',
      confirmVariant: 'danger'
    });
    if (shouldDiscard) {
      discardProfileChanges();
      discardSecurityChanges();
    }
    return shouldDiscard;
  };

  const requestCloseSettings = async () => {
    if (!(await confirmDiscardChanges())) return;
    closeSettingsModal();
  };

  const handleSelectSection = async (section) => {
    if (section === activeTab) {
      setShowMobileMenu(false);
      return;
    }
    if (!(await confirmDiscardChanges())) return;
    setSettingsSection(section);
    setShowMobileMenu(false);
  };

  const handleLogout = async () => {
    if (!(await confirmDiscardChanges())) return;
    const confirmed = await confirm({
      title: 'Đăng xuất tài khoản',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc hiện tại không?',
      confirmText: 'Đăng xuất',
      cancelText: 'Hủy',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    closeSettingsModal();
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // The Effect Event sees current draft/reset state without rebinding the listener.
  const handleEscape = useEffectEvent(() => {
    if (useConfirmStore.getState().isOpen) return;
    if (isResetDialogOpen) setIsResetDialogOpen(false);
    else void requestCloseSettings();
  });

  // Escape closes the nested reset dialog first, then the unified Settings Center.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (useConfirmStore.getState().isOpen) return;
      event.preventDefault();
      handleEscape();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        ...(email.trim().toLowerCase() !== user?.email ? { currentPassword } : {}),
        avatar: avatar
      });
      setCurrentPassword('');
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
    discardProfileChanges();
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setPwdMsg({ type: 'error', text: 'Vui lòng nhập mật khẩu hiện tại.' });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 12 ký tự.' });
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

  // Xuất dữ liệu JSON (Sao lưu toàn diện 100% tài sản và danh mục)
  const handleExportData = () => {
    const exportPayload = {
      version: '2.2.0',
      exportDate: new Date().toISOString(),
      user: {
        id: user?.id,
        name: user?.name,
        email: user?.email
      },
      wallets: wallets || [],
      jars: jars || [],
      installments: installments || [],
      transactions: transactions || [],
      budgets: budgets || {},
      categories: {
        expense: expenseCategories || [],
        income: incomeCategories || []
      }
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
      closeSettingsModal();
    } catch (err) {
      setResetError(err.message || 'Không thể đặt lại dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <div
        className="account-modal-overlay settings-center-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isResetDialogOpen) {
            void requestCloseSettings();
          }
        }}
        role="presentation"
      >
        <div
          ref={dialogRef}
          className="account-modal-card settings-center-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-center-title"
        >
          <header className="account-modal-header settings-center-header">
            <div className="account-header-lead">
              {isMobile && !showMobileMenu && (
                <button
                  type="button"
                  className="settings-mobile-back"
                  onClick={() => setShowMobileMenu(true)}
                  aria-label="Quay lại danh sách cài đặt"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
              )}
              <div className="account-header-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.38.4.73.73 1 .3.25.7.4 1.1.4H21v4h-.1a1.7 1.7 0 0 0-1.5.6Z" />
                </svg>
              </div>
              <div className="account-header-titles">
                <h2 id="settings-center-title" className="account-header-title">
                  {isMobile && !showMobileMenu ? t(SECTION_TITLE_KEYS[activeTab]) : t('settings.title')}
                </h2>
                <p className="account-header-desc">
                  {isMobile && showMobileMenu ? 'Tài khoản và tùy chỉnh ứng dụng' : 'Quản lý tài khoản và trải nghiệm CaltDHy'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="account-modal-close-btn"
              onClick={() => void requestCloseSettings()}
              aria-label="Đóng trung tâm cài đặt"
            >
              <CloseOutlineIcon size={18} />
            </button>
          </header>

          <div className={`settings-center-layout ${showMobileMenu ? 'show-mobile-menu' : ''}`}>
            <aside className="settings-center-sidebar" aria-label="Điều hướng cài đặt">
              <div className="settings-user-summary">
                <div className="settings-user-avatar" aria-hidden="true">
                  {user?.avatar ? (
                    user.avatar.startsWith('data:image') || user.avatar.startsWith('http')
                      ? <img src={user.avatar} alt="" />
                      : <span>{user.avatar}</span>
                  ) : <span>{userInitials}</span>}
                </div>
                <div>
                  <strong>{user?.name || 'Người dùng'}</strong>
                  <span>{user?.email || ''}</span>
                </div>
              </div>

              <nav className="settings-center-nav">
                {SETTINGS_GROUPS.map((group) => (
                  <div className="settings-nav-group" key={group.labelKey}>
                    <p>{t(group.labelKey)}</p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
                        aria-current={activeTab === item.id ? 'page' : undefined}
                        onClick={() => void handleSelectSection(item.id)}
                      >
                        <SettingsNavIcon type={item.icon} />
                        <span>{t(item.labelKey)}</span>
                        <span className="settings-nav-chevron" aria-hidden="true">›</span>
                      </button>
                    ))}
                  </div>
                ))}
              </nav>

              <div className="settings-sidebar-footer">
                <button type="button" className="settings-nav-item settings-nav-logout" onClick={() => void handleLogout()}>
                  <SettingsNavIcon type="logout" />
                  <span>{t('settings.logout')}</span>
                </button>
              </div>
            </aside>

            <main className="account-modal-body settings-center-content" aria-live="polite">
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
                    <span className="account-verified-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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
                      <div className="account-panel-val" style={{ marginTop: 2 }}>{detectCurrentDevice(t)}</div>
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

            {activeTab === 'general' && (
              <div className="account-tab-pane">
                <div className="account-tab-intro">
                  <h3 className="account-tab-intro-title">{t('settings.languageRegion')}</h3>
                  <p className="account-tab-intro-sub">{t('settings.localeIntro')}</p>
                </div>

                <div className="settings-preference-list">
                  <div className="settings-preference-row">
                    <div>
                      <strong>{t('settings.language')}</strong>
                      <span>{t('settings.interfaceLanguage')}</span>
                    </div>
                    <div className="settings-segmented-control" role="group" aria-label={t('settings.language')}>
                      {SUPPORTED_LOCALES.map((locale) => (
                        <button key={locale} type="button" className={lang === locale ? 'active' : ''}
                          aria-pressed={lang === locale} onClick={() => setLang(locale)}>
                          {LOCALE_META[locale].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="settings-preference-row">
                    <div>
                      <strong>{t('settings.displayCurrency')}</strong>
                      <span>{t('settings.displayCurrencyHint')}</span>
                    </div>
                    <div className="settings-segmented-control" role="group" aria-label={t('settings.displayCurrency')}>
                      {['VND', 'USD'].map((currency) => (
                        <button key={currency} type="button" className={displayCurrency === currency ? 'active' : ''}
                          aria-pressed={displayCurrency === currency} disabled={currency === 'USD' && !usdAvailable}
                          aria-describedby={currency === 'USD' && !usdAvailable ? 'usd-rate-unavailable' : undefined}
                          onClick={() => setDisplayCurrency(currency)}>{currency}</button>
                      ))}
                    </div>
                  </div>
                  <div className="settings-preference-row">
                    <div>
                      <strong>{t('settings.timeZone')}</strong>
                      <span>{t('settings.timeZoneHint')}</span>
                    </div>
                    <span className="settings-readonly-value">{Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'}</span>
                  </div>
                </div>

                {!usdAvailable ? (
                  <div id="usd-rate-unavailable" className="settings-info-note" role="note">{t('settings.usdUnavailable')}</div>
                ) : (
                  <div className="settings-info-note" role="note">
                    {t('settings.exchangeRate', { rate: exchangeRate.vndPerUsd })}<br />
                    {t('settings.exchangeRateMeta', { source: exchangeRate.source, asOf: formatDate(exchangeRate.asOf, 'short', { locale: lang }) })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="account-tab-pane">
                <div className="account-tab-intro">
                  <h3 className="account-tab-intro-title">{t('settings.appearance')}</h3>
                  <p className="account-tab-intro-sub">Chọn chủ đề màu phù hợp; thay đổi được áp dụng ngay lập tức</p>
                </div>
                <div className="theme-grid settings-theme-grid" role="group" aria-label="Chọn giao diện">
                  {THEME_OPTIONS.map((option) => {
                    const isActive = theme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className="theme-card"
                        aria-pressed={isActive}
                        aria-label={`${t('settings.appearance')} ${t(option.labelKey)}`}
                        onClick={() => setTheme(option.id)}
                      >
                        <span className="theme-card__swatch" style={{ background: option.swatch }} />
                        <span className="theme-card__name">{t(option.labelKey)}</span>
                        <svg className="theme-card__check-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                          <polyline points="4.5,8 7,10.5 11.5,5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'guide' && (
              <div className="account-tab-pane">
                <div className="account-tab-intro">
                  <h3 className="account-tab-intro-title">Hướng dẫn sử dụng</h3>
                  <p className="account-tab-intro-sub">Xem lại cách sử dụng các khu vực chính của CaltDHy</p>
                </div>
                <div className="settings-guide-card">
                  <SettingsNavIcon type="guide" />
                  <div>
                    <strong>Hướng dẫn CaltDHy</strong>
                    <span>Tổng quan Trang chủ, Kế hoạch, Phân tích và Hũ chi tiêu.</span>
                  </div>
                  <button
                    type="button"
                    className="btn-account-save"
                    onClick={() => {
                      closeSettingsModal();
                      openHelpModal();
                    }}
                  >
                    Mở hướng dẫn
                  </button>
                </div>
              </div>
            )}
            </main>
          </div>
        </div>
      </div>

      {/* ── Secondary Dialog: Confirmation Reset Financial Data ── */}
      {isResetDialogOpen && (
        <div className="account-reset-dialog-overlay" role="presentation">
          <div
            ref={resetDialogRef}
            className="account-reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Xác nhận đặt lại dữ liệu"
          >
            <h3 className="account-reset-title">
              <AlertTriangleOutlineIcon size={18} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Xác nhận đặt lại dữ liệu chi tiêu
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
