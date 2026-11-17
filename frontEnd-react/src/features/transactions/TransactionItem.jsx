import React from 'react';
import { CategoryMark } from '../../components/ui/CategoryMark';
import './transaction-item.css';

/**
 * One transaction row, shared by History and the Home "recent" list: category mark, title,
 * a "category · wallet" meta line, and the amount — two lines on every width. The whole row
 * opens the transaction (`onOpen`); `actions` (edit / delete) are revealed on hover and on
 * focus. A row without `onOpen` is read-only (system-generated).
 */
export function TransactionItem({ actions, amount, ariaLabel, className = '', extra, icon, lockedHint, markName, meta = [], onOpen, title, tone }) {
  const parts = meta.filter(Boolean);
  const body = <>
    <span className={`txn-item__icon is-${tone}`} aria-hidden="true">{icon || <CategoryMark name={markName} size={18} />}</span>
    <span className="txn-item__main">
      <span className="txn-item__title" title={title}>{title}</span>
      <span className="txn-item__meta">
        {parts.map((part, index) => <React.Fragment key={index}>
          {index > 0 && <span aria-hidden="true"> · </span>}<span>{part}</span>
        </React.Fragment>)}
      </span>
      {extra}
    </span>
    <span className="txn-item__side">{amount}{actions}{lockedHint}</span>
  </>;
  const classes = `txn-item${onOpen ? ' is-clickable' : ''}${className ? ` ${className}` : ''}`;
  if (!onOpen) return <div className={classes}>{body}</div>;
  // Buttons cannot nest, so a row that carries its own action buttons is a div with role="button".
  if (actions) {
    return <div className={classes} role="button" tabIndex={0} aria-label={ariaLabel} onClick={onOpen}
      onKeyDown={(event) => {
        // Keys pressed on the edit/delete buttons inside belong to those buttons.
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onOpen();
      }}>{body}</div>;
  }
  return <button type="button" className={classes} aria-label={ariaLabel} onClick={onOpen}>{body}</button>;
}
