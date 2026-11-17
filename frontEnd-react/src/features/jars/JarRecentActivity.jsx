import React, { useId, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { NavIcon } from '../../components/ui/NavIcons';
import { getJarActivityCopy } from './jarActivityCopy';
import { jarsManagementText } from './jarsManagementCopy';
import './jar-activity.css';

import { Icon } from '../../components/ui/AppIcons';
/** Jar deposits/withdrawals, newest first; optionally narrowed to one calendar day. */
export function JarRecentActivity({ id, events, selectedDay, onClearDay, onViewAll, limit = 6, compact = false }) {
  const { lang } = useTranslation();
  const copy = getJarActivityCopy(lang);
  const titleId = useId();
  const shortDay = selectedDay ? `${selectedDay.slice(8, 10)}/${selectedDay.slice(5, 7)}` : '';
  // Lọc nhanh Tất cả / Nạp / Rút ngay tại khối (JHS-03); cùng một lựa chọn áp lên cả danh sách và ngày đang chọn.
  const [typeFilter, setTypeFilter] = useState('all');
  const byDay = selectedDay ? events.filter((event) => event.day === selectedDay) : events;
  const scoped = typeFilter === 'all' ? byDay : byDay.filter((event) => event.type === typeFilter);
  const shown = scoped.slice(0, limit);
  const hidden = scoped.length - shown.length;

  return (
    <section id={id} className={`jar-activity-card${compact ? ' is-compact' : ''}`} aria-labelledby={titleId}>
      <header className="jar-activity-header">
        <h2 id={titleId} className="jar-activity-title"><NavIcon name="jarHistory" size={18} />{copy.activityTitle}</h2>
        <button type="button" className="jar-activity-view-all" onClick={onViewAll}>
          {copy.viewAll}<span aria-hidden="true">→</span>
        </button>
      </header>

      {events.length > 0 && <div className="jar-activity-type-filter" role="group" aria-label={jarsManagementText(lang, 'filterType')}>
        {[['all', 'all'], ['deposit', 'deposit'], ['withdraw', 'withdraw']].map(([value, key]) => (
          <button
            key={value}
            type="button"
            className="jar-activity-type-chip"
            aria-pressed={typeFilter === value}
            onClick={() => setTypeFilter(value)}
          >
            {jarsManagementText(lang, key)}
          </button>
        ))}
      </div>}

      {selectedDay && (
        <div className="jar-activity-filter">
          <button type="button" className="jar-activity-day-chip" aria-label={copy.clearDay(shortDay)} onClick={onClearDay}>
            <span>{copy.dayChip(shortDay)}</span>
            <Icon name="closeAlt" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </div>
      )}

      <div aria-live="polite">
        {shown.length === 0 ? (
          <p className="jar-activity-empty">{selectedDay ? copy.emptyDay(shortDay) : typeFilter === 'all' ? copy.empty : jarsManagementText(lang, 'empty')}</p>
        ) : (
          <ul className="jar-activity-list">
            {shown.map((event) => {
              const deposit = event.type === 'deposit';
              return (
                <li key={event.id} className="jar-activity-row">
                  <span className={`jar-activity-icon is-${event.type}`} aria-hidden="true">{deposit ? '+' : '−'}</span>
                  <div className="jar-activity-text">
                    {/* Dòng chính là tên hũ (cắt ở cuối, đủ chữ ở title); thao tác đã có icon +/−, người dùng đọc màn hình nghe qua phần ẩn. */}
                    <span className="jar-activity-desc" title={deposit ? copy.depositInto(event.jarName) : copy.withdrawFrom(event.jarName)}>
                      <span className="u-sr-only">{jarsManagementText(lang, deposit ? 'depositDirection' : 'withdrawDirection')}{' '}</span>
                      {event.jarName}
                    </span>
                    <span className="jar-activity-meta">
                      {formatDate(event.date, 'short', { locale: lang })}{event.reason ? ` · ${event.reason}` : ''}
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
