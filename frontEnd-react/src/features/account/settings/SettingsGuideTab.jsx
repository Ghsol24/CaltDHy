import React from 'react';
import { Button } from '../../../components/ui/Button';
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
        <Button
          variant="primary"
          size="lg"
          className="settings-guide-card__action"
          onClick={() => {
            closeSettingsModal();
            openHelpModal();
          }}
        >
          Mở hướng dẫn
        </Button>
      </div>
    </div>
  )) || null;
}
