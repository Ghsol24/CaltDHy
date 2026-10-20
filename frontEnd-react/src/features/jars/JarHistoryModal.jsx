import React, { useId, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { JarDialog } from './JarDialog';
import { jarsManagementText } from './jarsManagementCopy';
import './jars-management.css';

function activityDay(date) {
  if (!date) return '';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const part = (name) => parts.find((item) => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function JarHistoryModal({ isOpen, onClose, jars = [] }) {
  const { lang, label } = useTranslation();
  const text = (key, values) => jarsManagementText(lang, key, values);
  const id = useId();
  const [filterType, setFilterType] = useState('all');
  const [selectedJarId, setSelectedJarId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allActivities = useMemo(() => jars.flatMap((jar) => (
    Array.isArray(jar.history) ? jar.history : []
  ).map((activity, index) => ({
    ...activity, type: activity.type === 'initial' ? 'deposit' : activity.type,
    jarId: jar.id, jarName: jar.name, rowKey: `${jar.id}-${activity.id || activity._id || index}`,
    day: activityDay(activity.date),
  }))).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()), [jars]);

  // Counts follow the selected jar and search while keeping every type available.
  const matchingActivities = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(lang);
    return allActivities.filter((activity) => (
      (selectedJarId === 'all' || activity.jarId === selectedJarId)
      && (!query || `${activity.jarName || ''} ${activity.reason || ''}`.toLocaleLowerCase(lang).includes(query))
    ));
  }, [allActivities, selectedJarId, searchQuery, lang]);
  const counts = useMemo(() => matchingActivities.reduce((values, activity) => {
    values.all += 1;
    if (activity.type === 'deposit' || activity.type === 'withdraw') values[activity.type] += 1;
    return values;
  }, { all: 0, deposit: 0, withdraw: 0 }), [matchingActivities]);
  const filteredActivities = useMemo(() => matchingActivities.filter((activity) => (
    filterType === 'all' || activity.type === filterType
  )), [matchingActivities, filterType]);
  const totals = useMemo(() => filteredActivities.reduce((summary, activity) => {
    if (activity.type === 'deposit' || activity.type === 'withdraw') summary[activity.type] += Number(activity.amount) || 0;
    return summary;
  }, { deposit: 0, withdraw: 0 }), [filteredActivities]);
  // Group after filtering: a date heading can never be left empty.
  const dayGroups = useMemo(() => {
    const groups = new Map();
    filteredActivities.forEach((activity) => {
      if (!groups.has(activity.day)) groups.set(activity.day, []);
      groups.get(activity.day).push(activity);
    });
    return [...groups.entries()];
  }, [filteredActivities]);
  const net = totals.deposit - totals.withdraw;

  return (
    <JarDialog isOpen={isOpen} onClose={onClose} title={text('historyTitle')}
      subtitle={text('historyCap')} className="jar-history-management-dialog"
      footer={<><span className="jm-history-count" role="status">{text('resultCount', { count: filteredActivities.length })}</span>
        <button type="button" className="jm-button jm-button-primary" onClick={onClose}>{text('close')}</button></>}>
      <div className="jm-history">
        <div className="jm-history-toolbar">
          <dl className="jm-history-totals" aria-label={text('filteredSummary')}>
            <div><dt>{text('totalDeposit')}</dt><dd className="jm-deposit">+{formatCurrency(totals.deposit, { locale: lang })}</dd></div>
            <div><dt>{text('totalWithdraw')}</dt><dd className="jm-withdraw">−{formatCurrency(totals.withdraw, { locale: lang })}</dd></div>
            <div><dt>{text('net')}</dt><dd>{net > 0 ? '+' : net < 0 ? '−' : ''}{formatCurrency(Math.abs(net), { locale: lang })}</dd></div>
          </dl>
          <div className="jm-history-type-filter" role="group" aria-label={text('filterType')}>
            {['all', 'deposit', 'withdraw'].map((type) => (
              <button type="button" key={type} className={`jm-history-type-button${filterType === type ? ' is-active' : ''}`}
                aria-pressed={filterType === type} onClick={() => setFilterType(type)}>
                <span>{text(type)}</span><span className="jm-history-type-count">{counts[type]}</span>
              </button>
            ))}
          </div>
          <div className="jm-history-search-row">
            <CustomSelect options={[{ value: 'all', label: text('allJars') }, ...jars.map((jar) => ({ value: jar.id, label: jar.name }))]}
              value={selectedJarId} onChange={setSelectedJarId} ariaLabel={text('filterJar')} className="jm-history-jar-select" />
            <label className="jm-history-search" htmlFor={`${id}-search`}>
              <span className="jm-visually-hidden">{text('search')}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
              <input id={`${id}-search`} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={text('search')} />
            </label>
          </div>
        </div>
        <div className="jm-history-list" tabIndex={0} aria-label={text('historyTitle')}>
          {dayGroups.length === 0 ? <p className="jm-history-empty">{text('empty')}</p> : dayGroups.map(([day, activities]) => (
            <section className="jm-history-day" key={day || 'unknown'} aria-labelledby={`${id}-day-${day || 'unknown'}`}>
              <h3 id={`${id}-day-${day || 'unknown'}`}>{day ? formatDate(day, 'full', { locale: lang }) : text('unknownDate')}</h3>
              <ul>
                {activities.map((activity) => {
                  const isDeposit = activity.type === 'deposit';
                  return <li className={`jm-history-row ${isDeposit ? 'is-deposit' : 'is-withdraw'}`} key={activity.rowKey}>
                    <span className="jm-history-direction" aria-hidden="true">{isDeposit ? '↙' : '↗'}</span>
                    <div className="jm-history-row-copy"><strong>{activity.jarName}</strong>
                      <span className="jm-history-row-action">{text(isDeposit ? 'depositDirection' : 'withdrawDirection')}</span>
                      {activity.reason && <p>{label(activity.reason)}</p>}
                    </div>
                    <strong className="jm-history-amount">{isDeposit ? '+' : '−'}{formatCurrency(activity.amount, { locale: lang })}</strong>
                  </li>;
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </JarDialog>
  );
}
