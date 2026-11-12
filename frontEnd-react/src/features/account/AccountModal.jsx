import React, { useState, useRef, useEffect, useEffectEvent, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { THEME_OPTIONS } from '../../utils/themes';
import { SettingsThemePicker } from './SettingsThemePicker';
import { getUserErrorMessage } from '../../utils/userErrors';
import { useLangStore } from '../../stores/useLangStore';
import { useCurrencyStore } from '../../stores/useCurrencyStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { spendingService } from '../../services/spendingService';
import { evaluatePasswordStrength, MIN_PASSWORD_LENGTH } from '../../utils/passwordStrength';
import { useTranslation } from '../../i18n/useTranslation';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Dialog } from '../../components/ui/Dialog';
import { Icon, CloseOutlineIcon } from '../../components/ui/AppIcons';
import { SettingsNavIcon } from './settings/SettingsNavIcon';
import { compressImage } from './settings/accountHelpers';
import { ResetDataDialog } from './settings/ResetDataDialog';
import { SettingsGuideTab } from './settings/SettingsGuideTab';
import { SettingsGeneralTab } from './settings/SettingsGeneralTab';
import { SettingsDataTab } from './settings/SettingsDataTab';
import { SettingsSecurityTab } from './settings/SettingsSecurityTab';
import { SettingsNotificationsTab } from './settings/SettingsNotificationsTab';
import { SettingsProfileTab } from './settings/SettingsProfileTab';

const SETTINGS_GROUPS = [
  {
    labelKey: 'settings.account',
    headingKey: 'settings.accountManagementTitle',
    items: [
      { id: 'profile', labelKey: 'settings.profile', icon: 'profile' },
      { id: 'security', labelKey: 'settings.security', icon: 'security' },
      { id: 'data', labelKey: 'settings.dataPrivacy', icon: 'data' }
    ]
  },
  {
    labelKey: 'settings.application',
    headingKey: 'settings.appearanceLanguageTitle',
    items: [
      { id: 'general', labelKey: 'settings.languageRegion', icon: 'general' },
      { id: 'appearance', labelKey: 'settings.appearance', icon: 'appearance' },
      { id: 'notifications', labelKey: 'notify.title', icon: 'notifications' }
    ]
  },
  {
    labelKey: 'settings.support',
    headingKey: 'settings.supportTitle',
    items: [{ id: 'guide', labelKey: 'settings.guide', icon: 'guide' }]
  }
];

const SECTION_TITLE_KEYS = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.labelKey]))
);
const SECTION_GROUP_TITLE_KEYS = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((group) => group.items.map((item) => [item.id, group.headingKey]))
);
const MOBILE_SETTINGS_GROUPS = [{
  labelKey: 'settings.title',
  items: ['general', 'notifications', 'security', 'data', 'guide'].map((id) => (
    SETTINGS_GROUPS.flatMap((group) => group.items).find((item) => item.id === id)
  ))
}];

export function AccountModal() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuthStore();
  const logout = useAuthStore((state) => state.logout);
  const settingsSection = useSpendingStore((state) => state.settingsSection);
  const isSettingsHome = useSpendingStore((state) => state.isSettingsHome);
  const showSettingsHome = useSpendingStore((state) => state.showSettingsHome);
  const settingsNavigationRequest = useSpendingStore((state) => state.settingsNavigationRequest);
  const consumeSettingsNavigationRequest = useSpendingStore((state) => state.consumeSettingsNavigationRequest);
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
  const { transactions, budgets, resetAllFinancialData } = useTransactionStore();
  const isMobile = useIsMobile(720);
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const contentRef = useRef(null);
  const lastSectionTriggerRef = useRef(null);
  const profileTriggerRef = useRef(null);

  const activeTab = settingsSection || 'general';
  const showMobileMenu = isMobile && isSettingsHome;
  const [themeMessage, setThemeMessage] = useState('');

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
  const [copyError, setCopyError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  // Each mobile screen change keeps focus on a visible control or its heading.
  useEffect(() => {
    if (!isMobile) return;
    if (showMobileMenu) {
      const trigger = lastSectionTriggerRef.current;
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
      else profileTriggerRef.current?.focus();
    } else {
      headingRef.current?.focus();
      if (contentRef.current) contentRef.current.scrollTop = 0;
    }
  }, [isMobile, showMobileMenu, activeTab]);

  const handleSelectTheme = (nextTheme) => {
    setTheme(nextTheme);
    const option = THEME_OPTIONS.find(({ id }) => id === nextTheme);
    setThemeMessage(t('settings.themeApplied', { theme: t(option.labelKey) }));
  };

  // Only profile fields replace this draft; unrelated preference updates do not.
  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setAvatar(user?.avatar || '');
  }, [user?.id, user?.name, user?.email, user?.avatar]);

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

  const handleSelectSection = async (section, trigger) => {
    if (section === activeTab) {
      lastSectionTriggerRef.current = trigger;
      setSettingsSection(section);
      return;
    }
    if (!(await confirmDiscardChanges())) return;
    lastSectionTriggerRef.current = trigger;
    setSettingsSection(section);
  };

  const handleExternalSettingsNavigation = useEffectEvent(async (request) => {
    consumeSettingsNavigationRequest(request);
    // An external trigger must not replace a nested confirmation or interrupt a save.
    if (useConfirmStore.getState().isOpen || isResetDialogOpen || isProfileSaving || isPwdSaving || isResetting) return;
    if (request.section === 'home' && isMobile) {
      showSettingsHome();
      return;
    }
    await handleSelectSection(request.section === 'home' ? 'general' : request.section);
  });

  useEffect(() => {
    if (settingsNavigationRequest) void handleExternalSettingsNavigation(settingsNavigationRequest);
  }, [settingsNavigationRequest]);

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

  // Escape closes the nested reset dialog first (its own Dialog sits on top of
  // the focus-trap stack), then the Settings Center.

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
      setProfileMsg({ type: 'error', text: getUserErrorMessage(err, 'error.save') });
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
      setPwdMsg({ type: 'error', text: getUserErrorMessage(err, 'error.save') });
    } finally {
      setIsPwdSaving(false);
    }
  };

  // Sao chép UID
  const handleCopyUid = async () => {
    const uid = user?.id || '';
    if (!uid) return;
    setCopyError('');
    setCopySuccess(false);
    try {
      await navigator.clipboard.writeText(uid);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (error) {
      setCopyError(getUserErrorMessage(error, 'settings.copyFailed'));
    }
  };

  const handleExportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError('');
    try {
      const response = await spendingService.exportFinancialData();
      if (!response.data || typeof response.data !== 'object') {
        throw new Error(t('settings.exportFailed'));
      }
      const json = JSON.stringify(response.data, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `caltdhy_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(getUserErrorMessage(error, 'settings.exportFailed'));
    } finally {
      setIsExporting(false);
    }
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
      setResetError(getUserErrorMessage(err));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Dialog
        isOpen
        onClose={() => { void requestCloseSettings(); }}
        portal={false}
        overlayClassName="account-modal-overlay settings-center-overlay"
        className="account-modal-card settings-center-dialog"
        labelledBy="settings-center-title"
      >
          <header className="account-modal-header settings-center-header">
            <div className="account-header-lead">
              {isMobile && !showMobileMenu && (
                <button
                  type="button"
                  className="settings-mobile-back"
                  onClick={showSettingsHome}
                  aria-label={t('settings.backToSettings')}
                >
                  <Icon name="chevronLeftAlt" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </button>
              )}
              <div className="account-header-icon" aria-hidden="true">
                <Icon name="gearAlt" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </div>
              <div className="account-header-titles">
                <h2 ref={headingRef} tabIndex={-1} id="settings-center-title" className="account-header-title">
                  {isMobile && !showMobileMenu ? t(SECTION_TITLE_KEYS[activeTab]) : t('settings.title')}
                </h2>
                <p className="account-header-desc">
                  {t(SECTION_GROUP_TITLE_KEYS[activeTab] || 'settings.appearanceLanguageTitle')}
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
          <span className="u-sr-only" role="status">{themeMessage}</span>

          <div className={`settings-center-layout ${showMobileMenu ? 'show-mobile-menu' : ''}`}>
            <aside className="settings-center-sidebar" aria-label="Điều hướng cài đặt">
              <button
                ref={profileTriggerRef}
                type="button"
                className="settings-user-summary"
                aria-label={t('settings.viewEditProfile')}
                onClick={(event) => void handleSelectSection('profile', event.currentTarget)}
              >
                <span className="settings-user-avatar" aria-hidden="true">
                  {user?.avatar ? (
                    user.avatar.startsWith('data:image') || user.avatar.startsWith('http')
                      ? <img src={user.avatar} alt="" />
                      : <span>{user.avatar}</span>
                  ) : <span>{userInitials}</span>}
                </span>
                <span className="settings-user-details">
                  <strong>{user?.name || 'Người dùng'}</strong>
                  <span className="settings-user-email">{user?.email || ''}</span>
                  <span className="settings-user-profile-hint">{t('settings.viewEditProfile')}</span>
                </span>
                <Icon name="chevronRightAlt" className="settings-user-chevron" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </button>

              {isMobile && (
                <section className="settings-home-appearance" aria-labelledby="settings-home-appearance-title">
                  <div className="settings-home-section-heading">
                    <h3 id="settings-home-appearance-title">{t('settings.appearance')}</h3>
                    <span>{t(THEME_OPTIONS.find(({ id }) => id === theme)?.labelKey)}</span>
                  </div>
                  <SettingsThemePicker theme={theme} onChange={handleSelectTheme} compact />
                </section>
              )}

              <nav className="settings-center-nav">
                {(isMobile ? MOBILE_SETTINGS_GROUPS : SETTINGS_GROUPS).map((group) => (
                  <div className="settings-nav-group" key={group.labelKey}>
                    <p>{t(group.labelKey)}</p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`settings-nav-item ${!showMobileMenu && activeTab === item.id ? 'active' : ''}`}
                        aria-current={!showMobileMenu && activeTab === item.id ? 'page' : undefined}
                        onClick={(event) => void handleSelectSection(item.id, event.currentTarget)}
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

            <div ref={contentRef} className="account-modal-body settings-center-content">
            {/* ── TAB 1: HỒ SƠ ── */}
            {<SettingsProfileTab activeTab={activeTab} avatar={avatar} currentPassword={currentPassword} email={email} fileInputRef={fileInputRef} handleCancelProfile={handleCancelProfile} handleFileChange={handleFileChange} handleSaveProfile={handleSaveProfile} isProfileDirty={isProfileDirty} isProfileSaving={isProfileSaving} name={name} profileMsg={profileMsg} setAvatar={setAvatar} setCurrentPassword={setCurrentPassword} setEmail={setEmail} setName={setName} setShowPresetPicker={setShowPresetPicker} showPresetPicker={showPresetPicker} user={user} userInitials={userInitials} />}

            {/* ── TAB 2: BẢO MẬT ── */}
            {<SettingsSecurityTab activeTab={activeTab} confirmPassword={confirmPassword} currentPassword={currentPassword} handleChangePassword={handleChangePassword} isPwdSaving={isPwdSaving} newPassword={newPassword} pwdMsg={pwdMsg} pwdStrength={pwdStrength} setConfirmPassword={setConfirmPassword} setCurrentPassword={setCurrentPassword} setNewPassword={setNewPassword} setShowConfirmPwd={setShowConfirmPwd} setShowCurrentPwd={setShowCurrentPwd} setShowNewPwd={setShowNewPwd} showConfirmPwd={showConfirmPwd} showCurrentPwd={showCurrentPwd} showNewPwd={showNewPwd} />}

            {/* ── TAB 3: DỮ LIỆU & RIÊNG TƯ ── */}
            {<SettingsDataTab activeTab={activeTab} budgets={budgets} copyError={copyError} copySuccess={copySuccess} exportError={exportError} handleCopyUid={handleCopyUid} handleExportData={handleExportData} isExporting={isExporting} setIsResetDialogOpen={setIsResetDialogOpen} setResetConfirmInput={setResetConfirmInput} setResetError={setResetError} transactions={transactions} user={user} />}

            {<SettingsGeneralTab activeTab={activeTab} displayCurrency={displayCurrency} exchangeRate={exchangeRate} setDisplayCurrency={setDisplayCurrency} setLang={setLang} usdAvailable={usdAvailable} />}

            <SettingsNotificationsTab activeTab={activeTab} />

            {activeTab === 'appearance' && (
              <div className="account-tab-pane">
                <div className="account-tab-intro">
                  <h3 className="account-tab-intro-title">{t('settings.appearance')}</h3>
                  <p className="settings-theme-hint">{t('settings.themeHint')}</p>
                </div>
                <SettingsThemePicker theme={theme} onChange={handleSelectTheme} />
              </div>
            )}

            {<SettingsGuideTab activeTab={activeTab} closeSettingsModal={closeSettingsModal} openHelpModal={openHelpModal} />}
            </div>
          </div>
      </Dialog>

      {/* ── Secondary Dialog: Confirmation Reset Financial Data ── */}
      <ResetDataDialog handleConfirmResetData={handleConfirmResetData} isResetDialogOpen={isResetDialogOpen} isResetting={isResetting} resetConfirmInput={resetConfirmInput} resetError={resetError} setIsResetDialogOpen={setIsResetDialogOpen} setResetConfirmInput={setResetConfirmInput} transactions={transactions} />
    </>
  );
}
