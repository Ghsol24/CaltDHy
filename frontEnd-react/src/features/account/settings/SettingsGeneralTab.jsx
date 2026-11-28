import React, { useEffect } from 'react';
import { LOCALE_META, SUPPORTED_LOCALES } from '../../../i18n/translations';
import { formatDate, formatNumber } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';
import { useCurrencyStore } from '../../../stores/useCurrencyStore';

// "Nguồn: X · Cập nhật: Y" với X là liên kết tới nhà cung cấp khi có (điều khoản nguồn yêu cầu ghi nguồn).
function ExchangeRateMeta({ exchangeRate, lang, t }) {
  const asOf = formatDate(exchangeRate.asOf, 'short', { locale: lang });
  const marker = '\u0000';
  const [before, after = ''] = t('settings.exchangeRateMeta', { source: marker, asOf }).split(marker);
  const source = exchangeRate.sourceUrl
    ? <a href={exchangeRate.sourceUrl} target="_blank" rel="noopener noreferrer">{exchangeRate.source}</a>
    : exchangeRate.source;
  return <>{before}{source}{after}</>;
}

export function SettingsGeneralTab({ activeTab, displayCurrency, exchangeRate, setDisplayCurrency, setLang, usdAvailable }) {
  const { lang, t } = useTranslation();
  const rateStatus = useCurrencyStore((state) => state.rateStatus);
  const loadExchangeRate = useCurrencyStore((state) => state.loadExchangeRate);
  const isGeneral = activeTab === 'general';
  useEffect(() => {
    if (isGeneral) void loadExchangeRate();
  }, [isGeneral, loadExchangeRate]);
  return (isGeneral && (
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
        <div id="usd-rate-unavailable" className="settings-info-note" role="note" aria-live="polite">
          {t(rateStatus === 'loading' ? 'settings.exchangeRateLoading' : 'settings.usdUnavailable')}
        </div>
      ) : (
        <div className="settings-info-note" role="note">
          {t('settings.exchangeRate', { rate: formatNumber(exchangeRate.vndPerUsd, { locale: lang }) })}<br />
          <ExchangeRateMeta exchangeRate={exchangeRate} lang={lang} t={t} />
        </div>
      )}
    </div>
  )) || null;
}
