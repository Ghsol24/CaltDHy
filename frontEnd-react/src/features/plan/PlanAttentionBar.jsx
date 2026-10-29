import React, { useLayoutEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { SparkleOutlineIcon } from '../../utils/categoryIcons';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { ALERT_TIERS, countAlertTiers } from '../../utils/planAlerts';
import './plan-attention.css';

const MIN_CARD_WIDTH = 240;
const CARD_GAP = 12;
const MOBILE_VISIBLE = 2;

const Chevron = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
);

function badgeText(alert, copy) {
  const badge = copy.badges[alert.reason];
  return typeof badge === 'function' ? badge(alert.diffDays) : badge;
}

function alertTitle(alert, copy, label) {
  return alert.kind === 'budget' ? copy.budgetTitle(label(alert.category)) : alert.name;
}

function AlertMetric({ alert, copy }) {
  if (alert.kind === 'recurring') {
    return <>{formatCurrency(alert.amount)}{alert.reason === 'overdue' && alert.dueText ? ` · ${alert.dueText}` : ''}</>;
  }
  const percent = formatPercent(alert.percent);
  if (alert.overAmount > 0) {
    const [before, amount, after] = copy.overBy(formatCurrency(alert.overAmount), percent);
    return <>{before}<strong>{amount}</strong>{after}</>;
  }
  return copy.usedOfLimit(percent);
}

/** How many equal-width cards fit on one row of the list. */
function useColumnCount(listRef, enabled) {
  const [columns, setColumns] = useState(3);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!enabled || !list) return undefined;
    const measure = () => {
      const width = list.clientWidth;
      if (width > 0) setColumns(Math.max(1, Math.floor((width + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, enabled]);
  return columns;
}

/**
 * "Cần chú ý": severity-tiered alert cards. Desktop shows one full row of cards and
 * expands in place; mobile shows the two most severe and opens the rest in a sheet.
 */
export function PlanAttentionBar({ alerts, hasPlanData, copy, label, onOpen }) {
  const isMobile = useMediaQuery('(max-width: 600px)');
  const listRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const columns = useColumnCount(listRef, !isMobile && alerts.length > 0);
  const counts = countAlertTiers(alerts);
  const topTier = ALERT_TIERS.find((tier) => counts[tier] > 0) || 'calm';
  const collapsedCount = isMobile ? MOBILE_VISIBLE : columns;
  const visible = !isMobile && expanded ? alerts : alerts.slice(0, collapsedCount);
  const hiddenCount = alerts.length - collapsedCount;
  const summary = ALERT_TIERS.filter((tier) => counts[tier] > 0)
    .map((tier) => `${counts[tier]} ${copy.tiers[tier]}`).join(' · ');

  const open = (alert) => {
    setSheetOpen(false);
    onOpen(alert.targetTab);
  };

  return (
    <section className={`plan-attention is-${topTier}`} aria-label={copy.alertsRegion} data-testid="plan-attention">
      <div className="plan-attention-head">
        <span className="plan-attention-bell" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <div className="plan-attention-heading">
          <h3>
            {copy.attention}
            {alerts.length > 0 && <span className="plan-attention-count" aria-hidden="true">{alerts.length}</span>}
          </h3>
          <span className="plan-attention-summary">
            {alerts.length > 0 ? summary : hasPlanData ? copy.noAlerts : copy.noPlanData}
          </span>
        </div>
      </div>

      {alerts.length > 0 ? (
        <ul ref={listRef} className="plan-attention-list" id="plan-alert-list" aria-label={copy.alertCount(alerts.length)}>
          {visible.map((alert) => (
            <li key={alert.id}>
              <button type="button" className={`plan-alert-card is-${alert.tier}`} onClick={() => open(alert)}>
                <span className={`plan-alert-badge is-${alert.tier}`}>{badgeText(alert, copy)}</span>
                <strong className="plan-alert-title">{alertTitle(alert, copy, label)}</strong>
                <span className="plan-alert-metric"><AlertMetric alert={alert} copy={copy} /></span>
                <Chevron className="plan-alert-chevron" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="plan-attention-empty">
          <SparkleOutlineIcon size={16} />
          <span>{hasPlanData ? copy.noAlertsDetail : copy.noPlanDataDetail}</span>
        </p>
      )}

      {hiddenCount > 0 && (isMobile ? (
        <button type="button" className="plan-attention-more" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
          {copy.allAlerts(alerts.length)}<Chevron />
        </button>
      ) : (
        <button type="button" className="plan-attention-more" aria-expanded={expanded} aria-controls="plan-alert-list"
          onClick={() => setExpanded((value) => !value)}>
          {expanded ? copy.collapse : copy.moreAlerts(hiddenCount)}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
          </svg>
        </button>
      ))}

      <BottomSheet open={isMobile && sheetOpen} onClose={() => setSheetOpen(false)} title={copy.alertsTitle(alerts.length)}
        testId="plan-attention-sheet">
        {ALERT_TIERS.filter((tier) => counts[tier] > 0).map((tier) => (
          <section key={tier} className={`plan-attention-group is-${tier}`}>
            <h4>{copy.tierHeadings[tier]} ({counts[tier]})</h4>
            <ul>
              {alerts.filter((alert) => alert.tier === tier).map((alert) => (
                <li key={alert.id}>
                  <button type="button" className="plan-attention-row" onClick={() => open(alert)}>
                    <span className={`plan-attention-dot is-${tier}`} aria-hidden="true" />
                    <span className="plan-attention-row-text">
                      <strong>{alertTitle(alert, copy, label)}</strong>
                      <span><span className="plan-attention-row-badge">{badgeText(alert, copy)}</span> · <AlertMetric alert={alert} copy={copy} /></span>
                    </span>
                    <Chevron />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </BottomSheet>
    </section>
  );
}
