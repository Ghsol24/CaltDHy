import React, { useEffect, useState } from 'react';
import '../../../i18n/lazyTranslations';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useToastStore } from '../../../stores/useToastStore';
import { getUserErrorMessage } from '../../../utils/userErrors';
import { formatDate } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  currentPushEndpoint, disablePushOnThisDevice, enablePushOnThisDevice, pushSupport, savePushCopy,
} from '../../../utils/pushClient';

const HOURS = Array.from({ length: 18 }, (_, index) => index + 6); // 06:00 – 23:00
const hourLabel = (hour) => `${String(hour).padStart(2, '0')}:00`;

function Switch({ checked, disabled, label, onChange, describedBy }) {
  return (
    <div className="settings-segmented-control" role="group" aria-label={label} aria-describedby={describedBy}>
      {[true, false].map((value) => (
        <SwitchButton key={String(value)} value={value} checked={checked} disabled={disabled} onChange={onChange} />
      ))}
    </div>
  );
}

function SwitchButton({ value, checked, disabled, onChange }) {
  const { t } = useTranslation();
  return (
    <button type="button" className={checked === value ? 'active' : ''} aria-pressed={checked === value}
      disabled={disabled === true || (value && disabled === 'on-only')} onClick={() => checked !== value && onChange(value)}>
      {t(value ? 'settings.on' : 'settings.off')}
    </button>
  );
}

export function SettingsNotificationsTab({ activeTab }) {
  const { lang, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updatePreferences = useAuthStore((state) => state.updatePreferences);
  const addToast = useToastStore((state) => state.addToast);
  const [saving, setSaving] = useState('');
  const [support, setSupport] = useState(() => pushSupport());
  const [deviceOn, setDeviceOn] = useState(false);
  const [pushNote, setPushNote] = useState('');

  const isActive = activeTab === 'notifications';
  useEffect(() => {
    if (!isActive) return undefined;
    let cancelled = false;
    setSupport(pushSupport());
    currentPushEndpoint().then((endpoint) => { if (!cancelled) setDeviceOn(Boolean(endpoint)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isActive]);

  if (!isActive) return null;

  const settings = user?.preferences?.notifications || {};
  const daily = settings.dailyReminder || { enabled: false, hour: 21 };
  const emailVerified = user?.emailVerified === true;
  const pausedUntil = settings.emailPausedUntil;
  const pushCopy = { title: t('notify.pushTitle'), body: t('notify.pushBody') };

  const save = async (key, notifications) => {
    if (saving) return false;
    setSaving(key);
    // Lưu kèm ngôn ngữ đang dùng để email nhắc gửi đúng ngôn ngữ đó.
    try { await updatePreferences({ notifications: { ...notifications, locale: lang } }); return true; }
    catch (error) { addToast({ type: 'error', message: getUserErrorMessage(error, 'error.save') }); return false; }
    finally { setSaving(''); }
  };

  const setDaily = async (enabled) => {
    setPushNote('');
    if (!enabled) {
      setSaving('daily');
      try { await disablePushOnThisDevice(); setDeviceOn(false); }
      catch { /* turning the account switch off below still stops the reminder */ }
      finally { setSaving(''); }
      await save('daily', { dailyReminder: { enabled: false, hour: daily.hour } });
      return;
    }
    setSaving('daily');
    let outcome;
    try { outcome = await enablePushOnThisDevice(pushCopy); }
    catch (error) { addToast({ type: 'error', message: getUserErrorMessage(error, 'error.save') }); outcome = 'error'; }
    finally { setSaving(''); }
    setSupport(pushSupport());
    if (outcome !== 'enabled') {
      if (outcome === 'unconfigured' || outcome === 'unavailable') setPushNote(t('notify.pushUnavailable'));
      if (outcome === 'dismissed') setPushNote(t('notify.pushDismissed'));
      return;
    }
    setDeviceOn(true);
    await save('daily', { dailyReminder: { enabled: true, hour: daily.hour } });
  };

  const setHour = async (hour) => {
    if (await save('hour', { dailyReminder: { enabled: daily.enabled, hour } })) await savePushCopy(pushCopy);
  };

  const pushBlocked = support !== 'ready';
  const pushHint = support === 'denied' ? t('notify.pushDenied')
    : support === 'needs-install' ? t('notify.pushNeedsInstall')
      : support === 'unsupported' ? t('notify.pushUnsupported')
        : daily.enabled && !deviceOn ? t('notify.pushOtherDevice')
          : t('notify.dailyHint');
  const dailyOnHere = daily.enabled && deviceOn;

  return (
    <div className="account-tab-pane">
      <div className="account-tab-intro">
        <h3 className="account-tab-intro-title">{t('notify.title')}</h3>
        <p className="settings-theme-hint">{t('notify.intro')}</p>
      </div>

      <h4 className="settings-notify-heading">{t('notify.deviceHeading')}</h4>
      <div className="settings-preference-list">
        <div className="settings-preference-row">
          <div>
            <strong>{t('notify.daily')}</strong>
            <span id="notify-daily-hint" role={pushBlocked ? 'note' : undefined}>{pushHint}</span>
          </div>
          <Switch label={t('notify.daily')} describedBy="notify-daily-hint" checked={dailyOnHere}
            disabled={saving ? true : pushBlocked ? 'on-only' : false} onChange={setDaily} />
        </div>
        <div className="settings-preference-row">
          <div>
            <strong><label htmlFor="notify-daily-hour">{t('notify.dailyTime')}</label></strong>
            <span>{t('notify.dailyTimeHint')}</span>
          </div>
          <select id="notify-daily-hour" className="settings-notify-select" value={daily.hour}
            disabled={Boolean(saving) || !daily.enabled} onChange={(event) => setHour(Number(event.target.value))}>
            {HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
          </select>
        </div>
      </div>
      {pushNote && <div className="settings-info-note" role="status">{pushNote}</div>}

      <h4 className="settings-notify-heading">{t('notify.emailHeading')}</h4>
      <div className="settings-preference-list">
        <div className="settings-preference-row">
          <div>
            <strong>{t('notify.dueEmail')}</strong>
            <span>{t('notify.dueEmailHint')}</span>
          </div>
          <Switch label={t('notify.dueEmail')} checked={settings.dueEmail === true}
            disabled={saving ? true : emailVerified ? false : 'on-only'} onChange={(value) => save('due', { dueEmail: value })} />
        </div>
        <div className="settings-preference-row">
          <div>
            <strong>{t('notify.inactivityEmail')}</strong>
            <span>{t('notify.inactivityEmailHint')}</span>
          </div>
          <Switch label={t('notify.inactivityEmail')} checked={settings.inactivityEmail === true}
            disabled={saving ? true : emailVerified ? false : 'on-only'} onChange={(value) => save('inactive', { inactivityEmail: value })} />
        </div>
      </div>
      {!emailVerified && <div className="settings-info-note" role="note">{t('notify.emailUnverified')}</div>}
      {pausedUntil && (
        <div className="settings-info-note settings-notify-paused" role="status">
          <span>{t('notify.emailPaused', { date: formatDate(pausedUntil, 'short', { locale: lang }) })}</span>
          <button type="button" className="btn-avatar-action btn-avatar-preset" disabled={Boolean(saving)}
            onClick={() => save('resume', { emailPausedUntil: null })}>{t('notify.emailResume')}</button>
        </div>
      )}
    </div>
  );
}
