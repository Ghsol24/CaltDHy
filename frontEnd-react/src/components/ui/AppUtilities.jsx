import React, { useState, useRef } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLangStore } from '../../stores/useLangStore';
import { useTranslation } from '../../i18n/useTranslation';
import { GuideModal } from '../../features/guide/GuideModal';
import { ContextualSectionGuide } from '../../features/guide/ContextualSectionGuide';

const THEME_OPTIONS = [
  { id: 'dark', labelKey: 'darkTheme', swatch: 'linear-gradient(135deg, #2563EB 0%, #090A0F 100%)' },
  { id: 'light', labelKey: 'lightTheme', swatch: 'linear-gradient(135deg, #6366F1 0%, #FAFAFB 100%)' },
  { id: 'cream', labelKey: 'creamTheme', swatch: 'linear-gradient(135deg, #C0531E 0%, #F5EDE0 100%)' },
  { id: 'green', labelKey: 'greenTheme', swatch: 'linear-gradient(135deg, #059669 0%, #EEF8F3 100%)' },
];

function ModalOverlayShell({ title, subtitle, onClose, children }) {
  const { t } = useTranslation();
  return (
    <div
      className="modal-backdrop-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="budget-setup-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: '440px' }}
      >
        <div className="budget-dialog-header">
          <div className="budget-dialog-header-lead">
            <div className="budget-dialog-icon-tile">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              </svg>
            </div>
            <div className="budget-dialog-titles">
              <h2 className="budget-dialog-title">{title}</h2>
              {subtitle && <p className="budget-dialog-desc">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            className="budget-dialog-close-btn"
            onClick={onClose}
            aria-label="Đóng cài đặt"
          >
            ✕
          </button>
        </div>

        <div className="budget-dialog-content" style={{ padding: '20px 24px' }}>
          {children}
        </div>

        <div className="budget-dialog-footer">
          <button type="button" className="btn-dialog-save" onClick={onClose}>
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppUtilities() {
  const spending = useSpendingStore();
  const { theme, setTheme } = useThemeStore();
  const { lang, setLang } = useLangStore();
  const { t } = useTranslation();
  const { user, updateProfile } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [currency, setCurrency] = useState(
    () => localStorage.getItem('caltdhy_curr') || 'VND'
  );
  const [backupStatus, setBackupStatus] = useState('');
  const importFileInputRef = useRef(null);

  const handleSetCurrency = (code) => {
    setCurrency(code);
    try {
      localStorage.setItem('caltdhy_curr', code);
    } catch {
      // ignore
    }
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackupStatus(t('importDeveloping'));
    setTimeout(() => setBackupStatus(''), 4000);
    event.target.value = '';
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      await updateProfile({ name, email });
      setMessage(t('saveProfileSuccess'));
    } catch (error) {
      setMessage(error.message || 'Không thể cập nhật tài khoản.');
    }
  };

  return (
    <>
      {/* ── Settings Modal: Language, Theme, Currency, Budgets, Backup ── */}
      {spending.isSettingsOpen && (
        <ModalOverlayShell
          title={t('settings')}
          onClose={spending.closeSettingsModal}
        >
          {/* 1. Ngôn ngữ / Language */}
          <div className="settings-group">
            <p className="settings-group__label">{t('language')}</p>
            <div className="lang-switch" role="group" aria-label="Language selection">
              {['en', 'vi', 'zh'].map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`lang-btn ${lang === code ? 'lang-btn--active' : ''}`}
                  onClick={() => setLang(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Giao diện / Appearance */}
          <div className="settings-group">
            <p className="settings-group__label">{t('appearance')}</p>
            <div className="theme-grid" role="group" aria-label="Theme selection">
              {THEME_OPTIONS.map((opt) => {
                const isActive = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="theme-card"
                    aria-pressed={isActive ? 'true' : 'false'}
                    aria-label={t(opt.labelKey)}
                    onClick={() => setTheme(opt.id)}
                  >
                    <span className="theme-card__swatch" style={{ background: opt.swatch }} />
                    <span className="theme-card__name">{t(opt.labelKey)}</span>
                    <svg className="theme-card__check-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <polyline points="4.5,8 7,10.5 11.5,5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Đơn vị tiền tệ / Currency */}
          <div className="settings-group">
            <p className="settings-group__label">{t('currency')}</p>
            <div className="lang-switch" role="group" aria-label="Currency selection">
              {['VND', 'USD', 'CNY'].map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`lang-btn ${currency === code ? 'lang-btn--active' : ''}`}
                  onClick={() => handleSetCurrency(code)}
                >
                  {code}
                </button>
              ))}
            </div>
            <p className="settings-info settings-rate-info">
              {t('rateInfo')}
            </p>
          </div>

          {/* 4. Nút tắt: Thiết lập ngân sách */}
          <div className="settings-group">
            <button
              type="button"
              className="btn-set-budgets btn-set-budgets--full"
              onClick={() => {
                spending.closeSettingsModal();
                spending.setActiveView('plan');
                spending.setPlanSubTab('budgets');
              }}
            >
              {t('setBudgets')}
            </button>
          </div>

          {/* 5. Sao lưu & Khôi phục — CHỈ CÒN IMPORT, đã bỏ EXPORT */}
          <div className="settings-group settings-group--last">
            <div className="settings-group__label-row">
              <p className="settings-group__label">{t('backupRestore')}</p>
              <div className="info-btn" tabIndex={0} role="button" aria-label="Hướng dẫn khôi phục dữ liệu">
                ?
                <div className="info-tooltip">
                  <p className="info-tooltip__title">{t('settingsTooltipTitle')}</p>
                  <p className="info-tooltip__body">
                    {t('settingsTooltipBody')}
                  </p>
                </div>
              </div>
            </div>
            <div className="settings-backup-row">
              <button
                type="button"
                className="btn-set-budgets btn-set-budgets--full btn-backup btn-backup--import"
                onClick={() => importFileInputRef.current?.click()}
              >
                {t('importBackup')}
              </button>
            </div>
            {backupStatus && (
              <p style={{ fontSize: '12px', color: 'var(--color-brand-700, #008B57)', marginTop: '8px', marginBottom: 0, fontWeight: 600 }}>
                {backupStatus}
              </p>
            )}
            <input
              type="file"
              ref={importFileInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
        </ModalOverlayShell>
      )}

      {/* ── Account Modal ── */}
      {spending.isAccountOpen && (
        <ModalOverlayShell
          title={t('accountInfo')}
          subtitle="Quản lý thông tin hồ sơ và định danh người dùng."
          onClose={spending.closeAccountModal}
        >
          <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-secondary, #607086)' }}>
                {t('displayName')}
              </label>
              <input
                className="finput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên hiển thị"
                required
                style={{
                  height: '40px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #E3ECE7)',
                  padding: '0 12px',
                  background: 'var(--color-surface-muted, #F7FAF8)',
                  color: 'var(--color-text, #101B36)',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-secondary, #607086)' }}>
                {t('emailAddress')}
              </label>
              <input
                className="finput"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                style={{
                  height: '40px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #E3ECE7)',
                  padding: '0 12px',
                  background: 'var(--color-surface-muted, #F7FAF8)',
                  color: 'var(--color-text, #101B36)',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-setup-budget-primary"
              style={{ height: '40px', marginTop: '6px' }}
            >
              {t('saveProfile')}
            </button>
            {message && (
              <p style={{ color: 'var(--color-brand-700, #008B57)', fontSize: '12.5px', margin: 0, fontWeight: 600 }}>
                {message}
              </p>
            )}
          </form>
        </ModalOverlayShell>
      )}

      {/* ── Contextual Per-Section First-time Guide ── */}
      <ContextualSectionGuide />

      {/* ── Master Guide Modal (5 Comprehensive Tabs) ── */}
      <GuideModal />
    </>
  );
}


