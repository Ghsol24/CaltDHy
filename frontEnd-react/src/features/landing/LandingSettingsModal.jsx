import React, { useRef } from 'react';
import { THEME_OPTIONS } from '../../utils/themes';
import { translate } from '../../i18n/translations';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { switchThemeWithTransition } from '../../utils/themeTransition';
import { LandingIcon } from './LandingIcons';

const LANGUAGES = [
  { id: 'vi', code: 'VI', label: 'Tiếng Việt' },
  { id: 'en', code: 'EN', label: 'English' },
  { id: 'zh-CN', code: 'ZH', label: '简体中文' },
];

export function LandingSettingsModal({ isOpen, onClose, lang, setLang, theme, setTheme, copy }) {
  const cardRef = useRef(null);
  useFocusTrap(cardRef, isOpen, { onEscape: onClose });
  useBodyScrollLock(isOpen);

  return (
    <div
      className={`idx-modal-overlay ${isOpen ? 'open' : ''}`}
      id="idxSettingsModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idx-settings-title"
      aria-hidden={!isOpen}
      onClick={(event) => {
        if (event.target.id === 'idxSettingsModal') onClose();
      }}
    >
      <div ref={cardRef} className="idx-modal-card">
        <div className="idx-modal-head">
          <h2 className="idx-modal-title" id="idx-settings-title">
            {copy.settingsModal.title}
          </h2>
          <button
            type="button"
            className="idx-close-btn"
            onClick={onClose}
            aria-label={translate(lang, 'common.close')}
          >
            <LandingIcon name="close" size={16} />
          </button>
        </div>

        <div className="idx-group">
          <p className="idx-group-label">{copy.settingsModal.langLabel}</p>
          <div className="idx-lang-row" role="group" aria-label={copy.settingsModal.langLabel}>
            {LANGUAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`idx-lang-btn ${lang === item.id ? 'active' : ''}`}
                aria-pressed={lang === item.id}
                onClick={() => setLang(item.id)}
              >
                <span className="idx-lang-code">{item.code}</span>
                <span className="idx-lang-name">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="idx-group">
          <p className="idx-group-label">{copy.settingsModal.themeLabel}</p>
          <div className="idx-theme-row" role="group" aria-label={copy.settingsModal.themeLabel}>
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`idx-theme-btn ${theme === option.id ? 'active' : ''}`}
                aria-pressed={theme === option.id}
                onClick={(event) => switchThemeWithTransition(option.id, setTheme, event)}
              >
                <span
                  className="idx-theme-swatch"
                  style={{ background: option.swatch }}
                  aria-hidden="true"
                />
                <span>{translate(lang, option.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="idx-done-btn" onClick={onClose}>
          {copy.settingsModal.done}
        </button>
      </div>
    </div>
  );
}
