import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Icon } from '../../components/ui/AppIcons';
import { NavIcon } from '../../components/ui/NavIcons';

// Thẻ "Bắt đầu trong 3 bước" — trạng thái từng bước và việc ẩn nằm ở useHomeOnboarding.js.
const STEP_META = {
  wallet: { icon: 'wallets', titleKey: 'home.onboarding.walletTitle', hintKey: 'home.onboarding.walletHint' },
  budget: { icon: 'budgets', titleKey: 'home.onboarding.budgetTitle', hintKey: 'home.onboarding.budgetHint' },
  transaction: { icon: 'transactions', titleKey: 'home.onboarding.transactionTitle', hintKey: 'home.onboarding.transactionHint' },
};

export function HomeOnboardingCard({ steps, doneCount, onDismiss }) {
  const { t } = useTranslation();
  const navigateTo = useSpendingStore((state) => state.navigateTo);
  const openAddTxnModal = useSpendingStore((state) => state.openAddTxnModal);

  const open = (id) => {
    if (id === 'wallet') navigateTo('plan', 'wallets');
    else if (id === 'budget') navigateTo('plan', 'budgets');
    else openAddTxnModal();
  };

  return (
    <section className="home-onboarding" aria-labelledby="home-onboarding-title">
      <div className="home-onboarding__head">
        <div className="home-onboarding__heading">
          <h2 id="home-onboarding-title">{t('home.onboarding.title')}</h2>
          <p>{t('home.onboarding.subtitle')}</p>
        </div>
        <button
          type="button"
          className="home-onboarding__hide"
          onClick={onDismiss}
          aria-label={t('home.onboarding.hideLabel')}
        >
          {t('home.onboarding.hide')}
        </button>
      </div>

      <div className="home-onboarding__progress">
        <span className="home-onboarding__progress-text">
          {t('home.onboarding.progress', { done: doneCount, total: steps.length })}
        </span>
        <span className="home-onboarding__track" aria-hidden="true">
          <span
            className="home-onboarding__fill"
            style={{ '--home-onboarding-fill': `${Math.round((doneCount / steps.length) * 100)}%` }}
          />
        </span>
      </div>

      <ol className="home-onboarding__steps">
        {steps.map((step, index) => {
          const meta = STEP_META[step.id];
          const marker = (
            <span className="home-onboarding__marker" aria-hidden="true">
              {step.done ? (
                <Icon name="check" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                index + 1
              )}
            </span>
          );
          const text = (
            <span className="home-onboarding__text">
              <span className="home-onboarding__step-title">{t(meta.titleKey)}</span>
              <span className="home-onboarding__step-hint">
                {step.done ? t('home.onboarding.done') : t(meta.hintKey)}
              </span>
            </span>
          );
          return (
            <li key={step.id} className={`home-onboarding__step${step.done ? ' is-done' : ''}`}>
              {step.done ? (
                <div className="home-onboarding__row">
                  {marker}
                  {text}
                </div>
              ) : (
                <button type="button" className="home-onboarding__row" onClick={() => open(step.id)}>
                  {marker}
                  {text}
                  <span className="home-onboarding__icon" aria-hidden="true">
                    <NavIcon name={meta.icon} size={16} />
                  </span>
                  <Icon name="chevronRight" className="home-onboarding__chevron" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
