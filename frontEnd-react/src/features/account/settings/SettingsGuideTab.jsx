import React from 'react';
import { SettingsNavIcon } from './SettingsNavIcon';

export function SettingsGuideTab({ activeTab, closeSettingsModal, openHelpModal }) {
  return (activeTab === 'guide' && (
    <div className="account-tab-pane">
      <div className="account-tab-intro">
        <h3 className="account-tab-intro-title">Hướng dẫn sử dụng</h3>
      </div>
      <div className="settings-guide-card">
        <SettingsNavIcon type="guide" />
        <div>
          <strong>Hướng dẫn CaltDHy</strong>
        </div>
        <button
          type="button"
          className="btn-account-save"
          onClick={() => {
            closeSettingsModal();
            openHelpModal();
          }}
        >
          Mở hướng dẫn
        </button>
      </div>
    </div>
  )) || null;
}
