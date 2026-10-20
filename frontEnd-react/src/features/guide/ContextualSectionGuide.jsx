import React, { useState, useEffect } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  SparkleOutlineIcon,
  AlertTriangleOutlineIcon,
  ZapOutlineIcon,
  ChartOutlineIcon,
  RefreshOutlineIcon,
  TrendOutlineIcon,
  CloseOutlineIcon
} from '../../components/ui/AppIcons';
import { WalletOutlineIcon } from '../../components/ui/WalletOutlineIcon';
import { useTranslation } from '../../i18n/useTranslation';
import { getGuideContent } from './guideContent';

const renderPointIcon = (iconKey) => {
  switch (iconKey) {
    case 'sparkle': return <SparkleOutlineIcon size={16} />;
    case 'alert': return <AlertTriangleOutlineIcon size={16} />;
    case 'zap': return <ZapOutlineIcon size={16} />;
    case 'wallet': return <WalletOutlineIcon size={16} />;
    case 'budget': return <ChartOutlineIcon size={16} />;
    case 'recurring': return <RefreshOutlineIcon size={16} />;
    case 'trend': return <TrendOutlineIcon size={16} />;
    case 'chart': return <ChartOutlineIcon size={16} />;
    default: return <SparkleOutlineIcon size={16} />;
  }
};

export function ContextualSectionGuide() {
  const { lang, intlLocale } = useTranslation();
  const copy = getGuideContent(lang);
  const activeView = useSpendingStore((s) => s.activeView);
  const openHelpModal = useSpendingStore((s) => s.openHelpModal);
  const user = useAuthStore((state) => state.user);
  const [currentGuide, setCurrentGuide] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const userId = user?.id || user?.email || 'guest';

  useEffect(() => {
    const tab = getGuideContent(lang).tabs.find((item) => item.id === activeView);
    if (!tab) {
      setCurrentGuide(null);
      setIsExpanded(false);
      return;
    }

    const storageKey = `caltdhy_guide_seen_${userId}_${activeView}`;
    const hasSeen = localStorage.getItem(storageKey);

    if (!hasSeen) {
      setCurrentGuide({
        badge: tab.title, title: tab.title,
        points: tab.sections.slice(0, 3).map((section) => ({
          icon: 'sparkle', title: section.title, desc: section.body.split('. ')[0].replace(/\.$/, '') + '.'
        }))
      });
      setIsExpanded(false);
    } else {
      setCurrentGuide(null);
      setIsExpanded(false);
    }
  }, [activeView, userId, lang]);

  const handleDismiss = () => {
    if (activeView) {
      const storageKey = `caltdhy_guide_seen_${userId}_${activeView}`;
      try {
        localStorage.setItem(storageKey, 'true');
      } catch {
        // ignore storage errors
      }
    }
    setCurrentGuide(null);
  };

  const handleOpenMasterGuide = () => {
    handleDismiss();
    openHelpModal();
  };

  if (!currentGuide) return null;

  if (!isExpanded) {
    return (
      <div className="floating-guide-widget is-collapsed">
        <button
          type="button"
          className="floating-guide-disclosure-btn"
          aria-expanded="false"
          aria-controls="contextual-section-guide"
          onClick={() => setIsExpanded(true)}
        >
          <SparkleOutlineIcon size={16} />
          <span>{copy.hint} {currentGuide.badge.toLocaleLowerCase(intlLocale)}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="floating-guide-widget">
      <aside id="contextual-section-guide" className="floating-guide-card" aria-label={copy.title}>
        {/* Header */}
        <div className="floating-guide-header">
          <div className="floating-guide-title-box">
            <span className="floating-guide-badge">{currentGuide.badge}</span>
            <h4 className="floating-guide-title">{currentGuide.title}</h4>
          </div>
          <button
            type="button"
            className="floating-guide-close-btn"
            onClick={handleDismiss}
            aria-label={copy.close}
            title="Đóng"
          >
            <CloseOutlineIcon size={16} />
          </button>
        </div>


        {/* 3 Key Points */}
        <div className="floating-guide-points">
          {currentGuide.points.map((pt, idx) => (
            <div key={idx} className="floating-point-row">
              <span className="floating-point-icon" aria-hidden="true">{renderPointIcon(pt.icon)}</span>
              <div className="floating-point-text">
                <strong>{pt.title}:</strong> <span>{pt.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="floating-guide-footer">
          <button
            type="button"
            className="floating-guide-more-btn"
            onClick={handleOpenMasterGuide}
          >
            {copy.more} ↗
          </button>
          <button
            type="button"
            className="floating-guide-ack-btn"
            onClick={handleDismiss}
          >
            {copy.understood}
          </button>
        </div>
      </aside>
    </div>
  );
}
