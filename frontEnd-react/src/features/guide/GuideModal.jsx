import React, { useEffect, useRef, useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { BookOutlineIcon, CloseOutlineIcon } from '../../components/ui/AppIcons';
import { getGuideContent } from './guideContent';

const destinations = {
  wallets: ['plan', 'wallets'], budgets: ['plan', 'budgets'], recurring: ['plan', 'recurring'],
  analytics: ['analytics', 'overview'], cashflow: ['analytics', 'cash-flow'],
  history: ['analytics', 'transactions'], reports: ['analytics', 'reports'],
  jars: ['jars', 'jars'], jarhistory: ['jars', 'history']
};

export function GuideModal() {
  const { lang } = useTranslation();
  const isHelpOpen = useSpendingStore((s) => s.isHelpOpen);
  const closeHelpModal = useSpendingStore((s) => s.closeHelpModal);
  const navigateApp = useSpendingStore((s) => s.navigateTo);
  const [activeTab, setActiveTab] = useState('quickstart');
  const modalRef = useRef(null);
  const bodyRef = useRef(null);
  const tabRefs = useRef({});
  const copy = getGuideContent(lang);
  const selected = copy.tabs.find((tab) => tab.id === activeTab);

  useFocusTrap(modalRef, isHelpOpen);
  useBodyScrollLock(isHelpOpen);

  useEffect(() => {
    if (!isHelpOpen) return undefined;
    setActiveTab('quickstart');
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeHelpModal(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isHelpOpen, closeHelpModal]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const tab = tabRefs.current[activeTab];
    if (tab) {
      // Scroll only the tab strip, preserving the underlying page position.
      const strip = tab.parentElement;
      strip.scrollLeft = Math.max(0, tab.offsetLeft - strip.offsetLeft - 16);
    }
  }, [activeTab, isHelpOpen]);

  if (!isHelpOpen) return null;

  const activate = (action) => {
    closeHelpModal();
    const store = useSpendingStore.getState();
    if (action === 'transaction') store.openAddTxnModal();
    else if (['settings', 'profile', 'data'].includes(action)) store.openSettingsModal(action === 'settings' ? undefined : action);
    else if (destinations[action]) navigateApp(...destinations[action]);
  };

  const changeTabWithKeyboard = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % copy.tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + copy.tabs.length) % copy.tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = copy.tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    const id = copy.tabs[next].id;
    setActiveTab(id);
    tabRefs.current[id]?.focus({ preventScroll: true });
  };

  return <div className="modal-backdrop-overlay" role="presentation"
    onClick={(event) => { if (event.target === event.currentTarget) closeHelpModal(); }}>
    <div ref={modalRef} className="budget-setup-dialog guide-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="budget-dialog-header">
        <div className="budget-dialog-header-lead">
          <div className="budget-dialog-icon-tile guide-header-icon"><BookOutlineIcon size={20} /></div>
          <h2 id="guide-title" className="budget-dialog-title">{copy.title}</h2>
        </div>
        <button type="button" className="budget-dialog-close-btn" onClick={closeHelpModal} aria-label={copy.close}><CloseOutlineIcon size={18} /></button>
      </div>
      <div className="guide-tabs-bar" role="tablist" aria-label={copy.title}>
        {copy.tabs.map((tab, index) => <button key={tab.id} ref={(node) => { tabRefs.current[tab.id] = node; }}
          id={`guide-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id}
          aria-controls="guide-panel" tabIndex={activeTab === tab.id ? 0 : -1}
          className={`guide-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onKeyDown={(event) => changeTabWithKeyboard(event, index)} onClick={() => setActiveTab(tab.id)}>{tab.title}</button>)}
      </div>
      <div ref={bodyRef} className="guide-modal-body">
        <div id="guide-panel" role="tabpanel" aria-labelledby={`guide-tab-${activeTab}`} tabIndex={0} className="guide-tab-pane">
          {activeTab === 'quickstart' && <div className="guide-hero-banner"><h4>{copy.intro}</h4></div>}
          <div className={activeTab === 'quickstart' ? 'guide-steps-grid' : 'guide-tab-pane'}>
            {selected.sections.map((section) => <section className="guide-section-block" key={section.title}>
              <h3>{section.title}</h3><p>{section.body}</p>
              {section.action && <button type="button" className="guide-action-link" onClick={() => activate(section.action)}>{copy.open}</button>}
            </section>)}
          </div>
        </div>
      </div>
      <div className="budget-dialog-footer guide-modal-footer"><button type="button" className="btn-dialog-save" onClick={closeHelpModal}>{copy.done}</button></div>
    </div>
  </div>;
}
