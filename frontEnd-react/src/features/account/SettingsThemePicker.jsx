import React from 'react';
import '../../i18n/lazyTranslations';
import { THEME_OPTIONS } from '../../utils/themes';
import { useTranslation } from '../../i18n/useTranslation';

// A miniature of the app in the given theme: side rail, the "available to spend" hero and two
// list rows. Purely illustrative, so it is hidden from assistive technology.
function ThemePreview({ colors }) {
  return (
    <span
      className="theme-card__preview"
      aria-hidden="true"
      style={{
        '--tp-canvas': colors.canvas, '--tp-surface': colors.surface, '--tp-border': colors.border,
        '--tp-text': colors.text, '--tp-muted': colors.muted, '--tp-accent': colors.accent,
      }}
    >
      <span className="theme-preview__rail">
        <i className="theme-preview__dot" />
        <i className="theme-preview__nav is-active" />
        <i className="theme-preview__nav" />
        <i className="theme-preview__nav" />
      </span>
      <span className="theme-preview__main">
        <span className="theme-preview__hero">
          <i className="theme-preview__line theme-preview__line--short" />
          <i className="theme-preview__line theme-preview__line--amount" />
        </span>
        <span className="theme-preview__row"><i className="theme-preview__chip" /><i className="theme-preview__line" /></span>
        <span className="theme-preview__row"><i className="theme-preview__chip" /><i className="theme-preview__line theme-preview__line--mid" /></span>
      </span>
    </span>
  );
}

export function SettingsThemePicker({ theme, onChange, compact = false }) {
  const { t } = useTranslation();

  return (
    <div
      className={`theme-grid settings-theme-grid${compact ? ' settings-theme-grid--compact' : ' settings-theme-grid--preview'}`}
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
          {compact
            ? <span className="theme-card__swatch theme-card__swatch--tone" style={{ '--theme-card__swatch-background': option.swatch }} aria-hidden="true" />
            : <ThemePreview colors={option.preview} />}
          <span className="theme-card__caption">
            <span className="theme-card__name">{t(option.labelKey)}</span>
            {!compact && <span className="theme-card__desc">{t(option.descKey)}</span>}
          </span>
          <svg className="theme-card__check-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="4.5,8 7,10.5 11.5,5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
