import React from 'react';
import { Button } from '../../../components/ui/Button';
import { BrandMark } from '../../../components/ui/BrandMark';
import { Icon } from '../../../components/ui/AppIcons';
import { useTranslation } from '../../../i18n/useTranslation';

const GUIDE_BRAND_COPY = {
  vi: {
    subtitle: 'Tài chính cá nhân',
    pwaBadge: 'PWA sẵn sàng cài đặt',
  },
  en: {
    subtitle: 'Personal finance',
    pwaBadge: 'Installable PWA ready',
  },
  'zh-CN': {
    subtitle: '个人财务管理',
    pwaBadge: '支持 PWA 安装',
  },
};

export function SettingsGuideTab({ activeTab, closeSettingsModal, openHelpModal }) {
  const { lang } = useTranslation();
  const brandCopy = GUIDE_BRAND_COPY[lang] || (String(lang).startsWith('zh') ? GUIDE_BRAND_COPY['zh-CN'] : GUIDE_BRAND_COPY.vi);

  return (activeTab === 'guide' && (
    <div className="account-tab-pane">
      <div className="account-tab-intro">
        <h3 className="account-tab-intro-title">Hướng dẫn sử dụng</h3>
      </div>
      <div className="settings-guide-card">
        <BrandMark variant="full" className="settings-guide-card__brand" />
        <div className="settings-guide-card__info">
          <div className="settings-guide-card__title-row">
            <strong>Hướng dẫn CaltDHy</strong>
            <span className="settings-guide-card__pwa-pill">
              <Icon name="checkPath" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
              <span>{brandCopy.pwaBadge}</span>
            </span>
          </div>
          {typeof __APP_VERSION__ === 'string' && (
            <p className="settings-guide-card__version">{`Phiên bản ${__APP_VERSION__} · ${brandCopy.subtitle}`}</p>
          )}
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
