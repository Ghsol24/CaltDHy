import React, { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { BREAKPOINTS, useIsMobile } from '../../hooks/useMediaQuery';
import { SparkleOutlineIcon } from '../../utils/categoryIcons';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { ALERT_TIERS, countAlertTiers } from '../../utils/planAlerts';
import { Icon } from '../../components/ui/AppIcons';
import './plan-attention.css';

const ChevronRight = ({ className }) => (
  <Icon name="chevronRight" className={className} width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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

function LeadSummary({ alert, copy, label }) {
  if (!alert) return null;
  if (alert.kind === 'budget') {
    const name = label(alert.category);
    const percent = formatPercent(alert.percent);
    if (alert.overAmount > 0) {
      const [itemName, mid, amount, tail] = copy.leadBudgetOver(name, formatCurrency(alert.overAmount), percent);
      return <><strong>{itemName}</strong>{mid}<strong className="plan-attention-emphasis">{amount}</strong>{tail}</>;
    }
    const [itemName, mid, pct, tail] = copy.leadBudgetNear(name, percent);
    return <><strong>{itemName}</strong>{mid}<strong className="plan-attention-emphasis">{pct}</strong>{tail}</>;
  }
  if (alert.reason === 'overdue') {
    const [itemName, mid, amount, tail] = copy.leadRecurringOverdue(alert.name, formatCurrency(alert.amount));
    return <><strong>{itemName}</strong>{mid}<strong className="plan-attention-emphasis">{amount}</strong>{tail}</>;
  }
  const [itemName, mid, amount, tail] = copy.leadRecurringDue(alert.name, badgeText(alert, copy), formatCurrency(alert.amount));
  return <><strong>{itemName}</strong>{mid}<strong>{amount}</strong>{tail}</>;
}

/**
 * Compact actionable "Cần chú ý" strip (Phương án 1 — Focus & Breathe):
 * Collapses the 4-card alert wall and bottom suggestion banner into a single calm row
 * that highlights the most severe item and expands on demand (inline on desktop, sheet on mobile).
 */
export function PlanAttentionBar({ alerts, hasPlanData, copy, label, onOpen }) {
  const isMobile = useIsMobile(BREAKPOINTS.phone);
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const counts = countAlertTiers(alerts);
  const topTier = ALERT_TIERS.find((tier) => counts[tier] > 0) || 'calm';
  const leadAlert = alerts[0] || null;
  const actionLabel = leadAlert?.kind === 'recurring' ? copy.reviewRecurring : copy.adjustBudgets;

  const open = (alert) => {
    setSheetOpen(false);
    setExpanded(false);
    onOpen(alert.targetTab);
  };

  if (alerts.length === 0) {
    return (
      <section className="plan-attention is-calm" aria-label={copy.alertsRegion} data-testid="plan-attention">
        <div className="plan-attention-strip">
          <div className="plan-attention-lead">
            <span className="plan-attention-calm-icon" aria-hidden="true">
              <SparkleOutlineIcon size={16} />
            </span>
            <p className="plan-attention-empty">
              <strong>{hasPlanData ? copy.noAlerts : copy.noPlanData}</strong>
              <span className="plan-attention-sep" aria-hidden="true">·</span>
              <span>{hasPlanData ? copy.noAlertsDetail : copy.noPlanDataDetail}</span>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`plan-attention is-${topTier}`} aria-label={copy.alertsRegion} data-testid="plan-attention">
      <div className="plan-attention-strip">
        <div className="plan-attention-lead">
          <span className={`plan-attention-dot is-${topTier}`} aria-hidden="true" />
          <p className="plan-attention-copy">
            <strong className="plan-attention-headline">
              <span className="plan-attention-count">{alerts.length}</span>{' '}
              <span>{copy.attentionLead}</span>
            </strong>
            <span className="plan-attention-sep" aria-hidden="true">·</span>
            <span className="plan-attention-lead-detail">
              <LeadSummary alert={leadAlert} copy={copy} label={label} />
            </span>
          </p>
        </div>

        <div className="plan-attention-controls">
          {isMobile ? (
            <button
              type="button"
              className="plan-attention-more"
              aria-haspopup="dialog"
              onClick={() => setSheetOpen(true)}
            >
              <span>{copy.allAlerts(alerts.length)}</span>
              <ChevronRight />
            </button>
          ) : (
            <button
              type="button"
              className="plan-attention-more"
              aria-expanded={expanded}
              aria-controls="plan-alert-list"
              onClick={() => setExpanded((value) => !value)}
            >
              <span>{expanded ? copy.collapse : copy.showAlerts(alerts.length)}</span>
              <Icon
                name={expanded ? 'chevronUpAlt' : 'chevronDownAlt'}
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </button>
          )}

          {leadAlert && (
            <button
              type="button"
              className="plan-attention-action"
              onClick={() => open(leadAlert)}
            >
              <span>{actionLabel}</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop expandable flat list: quiet hairline rows on demand */}
      {!isMobile && expanded && (
        <ul className="plan-attention-drawer-list" id="plan-alert-list" aria-label={copy.alertCount(alerts.length)}>
          {alerts.map((alert) => (
            <li key={alert.id}>
              <button
                type="button"
                className={`plan-alert-card plan-alert-row is-${alert.tier}`}
                onClick={() => open(alert)}
              >
                <span className={`plan-attention-dot is-${alert.tier}`} aria-hidden="true" />
                <span className={`plan-alert-badge is-${alert.tier}`}>{badgeText(alert, copy)}</span>
                <strong className="plan-alert-title">{alertTitle(alert, copy, label)}</strong>
                <span className="plan-alert-metric"><AlertMetric alert={alert} copy={copy} /></span>
                <ChevronRight className="plan-alert-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet
        open={isMobile && sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={copy.alertsTitle(alerts.length)}
        testId="plan-attention-sheet"
      >
        {ALERT_TIERS.filter((tier) => counts[tier] > 0).map((tier) => (
          <section key={tier} className={`plan-attention-group is-${tier}`}>
            <h3>{copy.tierHeadings[tier]} ({counts[tier]})</h3>
            <ul>
              {alerts.filter((alert) => alert.tier === tier).map((alert) => (
                <li key={alert.id}>
                  <button type="button" className="plan-attention-row" onClick={() => open(alert)}>
                    <span className={`plan-attention-dot is-${tier}`} aria-hidden="true" />
                    <span className="plan-attention-row-text">
                      <strong>{alertTitle(alert, copy, label)}</strong>
                      <span>
                        <span className="plan-attention-row-badge">{badgeText(alert, copy)}</span>
                        {' · '}
                        <AlertMetric alert={alert} copy={copy} />
                      </span>
                    </span>
                    <ChevronRight />
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
