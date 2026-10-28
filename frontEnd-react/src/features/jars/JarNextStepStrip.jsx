import React from 'react';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { BulbOutlineIcon, RefreshOutlineIcon } from '../../components/ui/AppIcons';
import './jar-activity.css';

/**
 * One-line "next milestone" nudge that replaces the large "Bước tiếp theo"
 * card: it keeps the deposit shortcut and "Gợi ý khác" without taking a
 * whole column of the page.
 */
export function JarNextStepStrip({ suggestion, copy, percent, splitText, canSwitch, onSwitch, onDeposit, onEditTarget, onCreate }) {
  if (!suggestion) return null;
  const { kind, jar } = suggestion;
  const isMilestone = kind === 'milestone';
  const title = isMilestone
    ? `${jar.name} · ${copy.milestone(formatPercent(suggestion.nextMilestone))}`
    : kind === 'complete' ? `${jar.name} · ${copy.completeTitle}`
      : kind === 'no-target' ? `${jar.name} · ${copy.noTargetTitle}` : copy.emptyTitle;
  const detail = isMilestone
    ? `${copy.amountNeeded} ${formatCurrency(suggestion.amount)}${splitText ? ` · ${splitText}` : ''}`
    : kind === 'complete' ? copy.completeText : kind === 'no-target' ? copy.noTargetText : copy.emptyText;
  const cta = isMilestone ? copy.deposit(formatCurrency(suggestion.amount))
    : kind === 'no-target' ? copy.editTarget : kind === 'complete' ? copy.createNext : copy.createFirst;
  const act = () => {
    if (isMilestone) onDeposit(jar, suggestion.amount);
    else if (kind === 'no-target') onEditTarget(jar);
    else onCreate();
  };
  const showRing = suggestion.target > 0;

  return (
    <section className="jar-next-strip" aria-labelledby="jar-next-strip-title" data-suggestion-kind={kind}
      data-suggestion-amount={isMilestone ? suggestion.amount : undefined}>
      <div className="jar-next-strip-lead">
        {showRing ? (
          <div className="jar-next-strip-ring" role="progressbar" aria-label={copy.progressLabel(jar.name)}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle className="jar-next-strip-ring-track" cx="20" cy="20" r="16" />
              <circle className="jar-next-strip-ring-fill" cx="20" cy="20" r="16" pathLength="100"
                strokeDasharray={`${Math.max(0, Math.min(100, percent))} 100`} />
            </svg>
            <span>{formatPercent(percent)}</span>
          </div>
        ) : (
          <span className="jar-next-strip-icon" aria-hidden="true"><BulbOutlineIcon size={18} /></span>
        )}
        <div className="jar-next-strip-text">
          <h3 id="jar-next-strip-title"><span className="jar-next-strip-kicker">{copy.nextStep}</span>{title}</h3>
          <p>{detail}</p>
        </div>
      </div>
      <div className="jar-next-strip-actions">
        {canSwitch && (
          <button type="button" className="jar-next-strip-switch" onClick={onSwitch}>
            {copy.another}<RefreshOutlineIcon size={13} />
          </button>
        )}
        <button type="button" className="jar-next-strip-cta" onClick={act}>{cta}</button>
      </div>
    </section>
  );
}
