import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLangStore } from '../../stores/useLangStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useTranslation } from '../../i18n/useTranslation';
import { GuideModal } from '../../features/guide/GuideModal';
import { ContextualSectionGuide } from '../../features/guide/ContextualSectionGuide';
import { AccountModal } from '../../features/account/AccountModal';

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
  const isSettingsOpen = useSpendingStore((s) => s.isSettingsOpen);
  const closeSettingsModal = useSpendingStore((s) => s.closeSettingsModal);
  const openHelpModal = useSpendingStore((s) => s.openHelpModal);
  const isAccountOpen = useSpendingStore((s) => s.isAccountOpen);
  const { theme, setTheme } = useThemeStore();
  const { lang, setLang } = useLangStore();
  const { t } = useTranslation();
  const { logout } = useAuthStore();
  const { confirm } = useConfirmStore();
  const navigate = useNavigate();

  const [currency, setCurrency] = useState(
    () => localStorage.getItem('caltdhy_curr') || 'VND'
  );

  const handleSetCurrency = (code) => {
    setCurrency(code);
    try {
      localStorage.setItem('caltdhy_curr', code);
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: t('logoutConfirmTitle'),
      message: t('logoutConfirmMessage'),
      confirmText: t('logout'),
      cancelText: t('done') === 'DONE' ? 'Cancel' : 'Hủy',
      confirmVariant: 'danger'
    });
    if (confirmed) {
      closeSettingsModal();
      logout();
      navigate('/login');
    }
  };

  return (
    <>
      {/* ── Settings Modal: Language, Theme, Currency, Budgets, Backup ── */}
      {isSettingsOpen && (
        <ModalOverlayShell
          title={t('settings')}
          onClose={closeSettingsModal}
        >
          {/* 1. Ngôn ngữ / Language */}
          <div className="settings-group">
            <p className="settings-group__label">{t('language')}</p>
            <div className="lang-switch" role="group" aria-label="Language selection">
              {['en', 'vi', 'zh'].map((code) => {
                const isDisabled = code !== 'vi';
                const isActive = lang === code;
                return (
                  <div key={code} className="lang-btn-wrap">
                    <button
                      type="button"
                      disabled={isDisabled}
                      className={`lang-btn ${isActive ? 'lang-btn--active' : ''} ${isDisabled ? 'lang-btn--disabled' : ''}`}
                      onClick={() => !isDisabled && setLang(code)}
                      title={isDisabled ? 'updating' : undefined}
                      aria-disabled={isDisabled}
                    >
                      {code.toUpperCase()}
                    </button>
                    {isDisabled && (
                      <span className="lang-btn-tooltip" role="tooltip">
                        updating
                      </span>
                    )}
                  </div>
                );
              })}
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

          {/* 4. Hướng dẫn sử dụng */}
          <div className="settings-group">
            <button
              type="button"
              className="btn-settings-action btn-settings-action--guide"
              onClick={() => {
                closeSettingsModal();
                openHelpModal();
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{t('userGuide')}</span>
            </button>
          </div>

          {/* 5. Đăng xuất tài khoản */}
          <div className="settings-group settings-group--last">
            <button
              type="button"
              className="btn-settings-action btn-settings-action--danger"
              onClick={handleLogout}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>{t('logout')}</span>
            </button>
          </div>
        </ModalOverlayShell>
      )}

      {/* ── Account Management Modal (3 Tabs: Profile, Security, Data & Privacy) ── */}
      {isAccountOpen && <AccountModal />}

      {/* ── Contextual Per-Section First-time Guide ── */}
      <ContextualSectionGuide />

      {/* ── Master Guide Modal (5 Comprehensive Tabs) ── */}
      <GuideModal />
    </>
  );
}


