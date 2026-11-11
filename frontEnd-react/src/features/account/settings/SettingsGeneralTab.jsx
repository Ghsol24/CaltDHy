import React from 'react';
import { LOCALE_META, SUPPORTED_LOCALES } from '../../../i18n/translations';
import { formatDate } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';

export function SettingsGeneralTab({ activeTab, displayCurrency, exchangeRate, setDisplayCurrency, setLang, usdAvailable }) {
  const { lang, t } = useTranslation();
  return (activeTab === 'general' && (
    <div className="account-tab-pane">
      <div className="account-tab-intro">
        <h3 className="account-tab-intro-title">{t('settings.languageRegion')}</h3>
      </div>
  
      <div className="settings-preference-list">
        <div className="settings-preference-row">
          <div>
            <strong>{t('settings.language')}</strong>
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
  )) || null;
}
