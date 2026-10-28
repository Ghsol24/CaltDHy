import React, { useId } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { HistoryOutlineIcon } from '../../components/ui/AppIcons';
import { getJarActivityCopy } from './jarActivityCopy';
import './jar-activity.css';

/** Jar deposits/withdrawals, newest first; optionally narrowed to one calendar day. */
export function JarRecentActivity({ id, events, selectedDay, onClearDay, onViewAll, limit = 6, compact = false }) {
  const { lang } = useTranslation();
  const copy = getJarActivityCopy(lang);
  const titleId = useId();
  const shortDay = selectedDay ? `${selectedDay.slice(8, 10)}/${selectedDay.slice(5, 7)}` : '';
  const scoped = selectedDay ? events.filter((event) => event.day === selectedDay) : events;
  const shown = scoped.slice(0, limit);
  const hidden = scoped.length - shown.length;

  return (
    <section id={id} className={`jar-activity-card${compact ? ' is-compact' : ''}`} aria-labelledby={titleId}>
      <header className="jar-activity-header">
        <h2 id={titleId} className="jar-activity-title"><HistoryOutlineIcon size={18} />{copy.activityTitle}</h2>
        <button type="button" className="jar-activity-view-all" onClick={onViewAll}>
          {copy.viewAll}<span aria-hidden="true">→</span>
        </button>
      </header>

      {selectedDay && (
        <div className="jar-activity-filter">
          <button type="button" className="jar-activity-day-chip" aria-label={copy.clearDay(shortDay)} onClick={onClearDay}>
            <span>{copy.dayChip(shortDay)}</span>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div aria-live="polite">
        {shown.length === 0 ? (
          <p className="jar-activity-empty">{selectedDay ? copy.emptyDay(shortDay) : copy.empty}</p>
        ) : (
          <ul className="jar-activity-list">
            {shown.map((event) => {
              const deposit = event.type === 'deposit';
              return (
                <li key={event.id} className="jar-activity-row">
                  <span className={`jar-activity-icon is-${event.type}`} aria-hidden="true">{deposit ? '+' : '−'}</span>
                  <div className="jar-activity-text">
                    <span className="jar-activity-desc">{deposit ? copy.depositInto(event.jarName) : copy.withdrawFrom(event.jarName)}</span>
                    <span className="jar-activity-meta">
                      {formatDate(event.date, 'full', { locale: lang })}{event.reason ? ` · ${event.reason}` : ''}
                    </span>
                  </div>
                  <strong className={`jar-activity-amount is-${event.type}`}>
                    {deposit ? '+' : '−'}{formatCurrency(event.amount, { locale: lang })}
                  </strong>
                </li>
              );
            })}
          </ul>
        )}
        {selectedDay && hidden > 0 && <p className="jar-activity-more">{copy.moreOnDay(hidden)}</p>}
      </div>
    </section>
  );
}
