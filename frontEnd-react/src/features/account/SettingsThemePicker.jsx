import React from 'react';
import { THEME_OPTIONS } from '../../utils/themes';
import { useTranslation } from '../../i18n/useTranslation';

export function SettingsThemePicker({ theme, onChange, compact = false }) {
  const { t } = useTranslation();

  return (
    <div
      className={`theme-grid settings-theme-grid${compact ? ' settings-theme-grid--compact' : ''}`}
      role="group"
      aria-label={t('settings.chooseTheme')}
    >
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="theme-card"
          aria-pressed={theme === option.id}
          aria-label={`${t('settings.appearance')} ${t(option.labelKey)}`}
          onClick={() => onChange(option.id)}
        >
          <span className="theme-card__swatch" style={{ background: option.swatch }} aria-hidden="true" />
          <span className="theme-card__name">{t(option.labelKey)}</span>
          <svg className="theme-card__check-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="4.5,8 7,10.5 11.5,5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
