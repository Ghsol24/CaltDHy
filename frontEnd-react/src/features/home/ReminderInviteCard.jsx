import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Icon } from '../../components/ui/AppIcons';

/**
 * Asked once, and only after the user has recorded something: the moment a reminder has a point.
 * It is the app's own question; the browser's permission prompt only appears later, if the user
 * turns the daily reminder on in Settings, so a "no" here costs nothing.
 */
export function ReminderInviteCard() {
  const { t } = useTranslation();
  const settings = useAuthStore((state) => state.user?.preferences?.notifications);
  const updatePreferences = useAuthStore((state) => state.updatePreferences);
  const openSettingsModal = useSpendingStore((state) => state.openSettingsModal);
  const hasRecorded = useTransactionStore((state) => state.transactions.some((txn) => !txn.systemGenerated));
  const [hidden, setHidden] = useState(false);

  const alreadyOn = settings?.dueEmail || settings?.inactivityEmail || settings?.dailyReminder?.enabled;
  if (hidden || !settings || settings.promptDismissed || alreadyOn || !hasRecorded) return null;

  const answer = (openSettings) => {
    setHidden(true);
    updatePreferences({ notifications: { promptDismissed: true } }).catch(() => {});
    if (openSettings) openSettingsModal('notifications');
  };

  return (
    <section className="home-reminder-invite" aria-labelledby="home-reminder-invite-title">
      <span className="home-reminder-invite__icon" aria-hidden="true">
        <Icon name="clock" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </span>
      <div className="home-reminder-invite__text">
        <h3 id="home-reminder-invite-title">{t('notify.inviteTitle')}</h3>
        <p>{t('notify.inviteBody')}</p>
      </div>
      <div className="home-reminder-invite__actions">
        <button type="button" className="home-reminder-invite__later" onClick={() => answer(false)}>{t('notify.inviteLater')}</button>
        <button type="button" className="home-reminder-invite__accept" onClick={() => answer(true)}>{t('notify.inviteAccept')}</button>
      </div>
    </section>
  );
}
