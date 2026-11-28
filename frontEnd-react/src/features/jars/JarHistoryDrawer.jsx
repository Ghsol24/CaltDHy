import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { NavIcon } from '../../components/ui/NavIcons';
import { Icon } from '../../components/ui/AppIcons';
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

function isOutsideBounds(event, element) {
  const rect = element.getBoundingClientRect();
  return event.clientX < rect.left
    || event.clientX > rect.right
    || event.clientY < rect.top
    || event.clientY > rect.bottom;
}

/**
 * Slide-over Drawer "Lịch sử nạp/rút" dùng phần tử native <dialog> mở bằng showModal().
 * - Trình duyệt tự xử lý top-layer, inert nền sau, Esc và trả focus về nút kích hoạt.
 * - Dùng closedby="any" kèm fallback pointerdown+pointerup ngoài biên cho Safari.
 * - Cuộn trong danh sách được cô lập bằng overscroll-behavior: contain (không khóa body overflow).
 */
export function JarHistoryDrawer({ isOpen, onClose, jars = [] }) {
  const { lang, label, t } = useTranslation();
  const text = (key, values) => jarsManagementText(lang, key, values);
  const id = useId();
  const titleId = `${id}-title`;
  const dialogRef = useRef(null);
  const pressedOutsideRef = useRef(false);

  const [filterType, setFilterType] = useState('all');
  const [selectedJarId, setSelectedJarId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync React open state with native <dialog>.showModal() / .close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
    return undefined;
  }, [isOpen]);

  // Fallback light-dismiss for browsers without <dialog closedby="any"> (e.g. Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return undefined;
    const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;
    if (supportsClosedBy) return undefined;

    const handlePointerDown = (event) => {
      pressedOutsideRef.current = isOutsideBounds(event, dialog);
    };
    const handlePointerUp = (event) => {
      if (pressedOutsideRef.current && isOutsideBounds(event, dialog)) {
        dialog.close();
      }
      pressedOutsideRef.current = false;
    };
    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isOpen]);

  const allActivities = useMemo(() => {
    if (!isOpen) return [];
    return jars.flatMap((jar) => (
      Array.isArray(jar.history) ? jar.history : []
    ).map((activity, index) => ({
      ...activity,
      type: activity.type === 'initial' ? 'deposit' : activity.type,
      jarId: jar.id,
      jarName: jar.name,
      rowKey: `${jar.id}-${activity.id || activity._id || index}`,
      day: activityDay(activity.date),
    }))).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [isOpen, jars]);

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
    if (activity.type === 'deposit' || activity.type === 'withdraw') {
      summary[activity.type] += Number(activity.amount) || 0;
    }
    return summary;
  }, { deposit: 0, withdraw: 0 }), [filteredActivities]);

  const dayGroups = useMemo(() => {
    const groups = new Map();
    filteredActivities.forEach((activity) => {
      if (!groups.has(activity.day)) groups.set(activity.day, []);
      groups.get(activity.day).push(activity);
    });
    return [...groups.entries()];
  }, [filteredActivities]);

  const net = totals.deposit - totals.withdraw;

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onClose?.();
  };

  return (
    <dialog
      ref={dialogRef}
      id="jar-history-drawer"
      className="jar-history-drawer"
      aria-labelledby={titleId}
      data-testid="jar-history-drawer"
      {...({ closedby: 'any' })}
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = '';
        onClose?.();
      }}
    >
      {isOpen && (
      <div className="jar-history-drawer__sheet">
        <header className="jar-history-drawer__header">
          <div className="jar-history-drawer__title-group">
            <span className="jar-history-drawer__icon" aria-hidden="true">
              <NavIcon name="jarHistory" size={18} />
            </span>
            <h1 id={titleId} className="jar-history-drawer__title">{t('nav.history')}</h1>
          </div>
          <button
            type="button"
            className="jar-history-drawer__close"
            onClick={handleClose}
            aria-label={t('common.close')}
            autoFocus
          >
            <Icon name="close" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </header>

        <div className="jm-history jm-history--drawer">
          <div className="jm-history-toolbar">
            <dl className="jm-history-totals" aria-label={text('filteredSummary')}>
              <div>
                <dt>{text('totalDeposit')}</dt>
                <dd className="jm-deposit">+{formatCurrency(totals.deposit, { locale: lang })}</dd>
              </div>
              <div>
                <dt>{text('totalWithdraw')}</dt>
                <dd className="jm-withdraw">−{formatCurrency(totals.withdraw, { locale: lang })}</dd>
              </div>
              <div>
                <dt>{text('net')}</dt>
                <dd>{net > 0 ? '+' : net < 0 ? '−' : ''}{formatCurrency(Math.abs(net), { locale: lang })}</dd>
              </div>
            </dl>

            <div className="jm-history-type-filter" role="group" aria-label={text('filterType')}>
              {['all', 'deposit', 'withdraw'].map((type) => (
                <button
                  type="button"
                  key={type}
                  className={`jm-history-type-button${filterType === type ? ' is-active' : ''}`}
                  aria-pressed={filterType === type}
                  onClick={() => setFilterType(type)}
                >
                  <span>{text(type)}</span>
                  <span className="jm-history-type-count">{counts[type]}</span>
                </button>
              ))}
            </div>

            <div className="jm-history-search-row">
              <CustomSelect
                options={[{ value: 'all', label: text('allJars') }, ...jars.map((jar) => ({ value: jar.id, label: jar.name }))]}
                value={selectedJarId}
                onChange={setSelectedJarId}
                ariaLabel={text('filterJar')}
                className="jm-history-jar-select"
              />
              <label className="jm-history-search input-shell" htmlFor={`${id}-search`}>
                <span className="jm-visually-hidden">{text('search')}</span>
                <Icon name="searchAlt" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" />
                <input
                  id={`${id}-search`}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={text('search')}
                />
              </label>
            </div>
          </div>

          <div className="jm-history-list jm-history-list--scroll">
            {dayGroups.length === 0 ? (
              <p className="jm-history-empty">{text('empty')}</p>
            ) : (
              dayGroups.map(([day, activities]) => (
                <section className="jm-history-day" key={day || 'unknown'} aria-labelledby={`${id}-day-${day || 'unknown'}`}>
                  <h2 id={`${id}-day-${day || 'unknown'}`}>{day ? formatDate(day, 'full', { locale: lang }) : text('unknownDate')}</h2>
                  <ul>
                    {activities.map((activity) => {
                      const isDeposit = activity.type === 'deposit';
                      return (
                        <li className={`jm-history-row ${isDeposit ? 'is-deposit' : 'is-withdraw'}`} key={activity.rowKey}>
                          <span className="jm-history-direction" aria-hidden="true">{isDeposit ? '↙' : '↗'}</span>
                          <div className="jm-history-row-copy">
                            <strong>{activity.jarName}</strong>
                            <span className="jm-history-row-action">{text(isDeposit ? 'depositDirection' : 'withdrawDirection')}</span>
                            {activity.reason && <p>{label(activity.reason)}</p>}
                          </div>
                          <strong className="jm-history-amount">
                            {isDeposit ? '+' : '−'}{formatCurrency(activity.amount, { locale: lang })}
                          </strong>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>

          <p className="jm-history-footer">
            <span className="jm-history-count" role="status">{text('resultCount', { count: filteredActivities.length })}</span>
            <span>{text('historyCap')}</span>
          </p>
        </div>
      </div>
      )}
    </dialog>
  );
}
