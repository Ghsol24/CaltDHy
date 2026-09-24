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

const SECTION_GUIDE_DATA = {
  home: {
    badge: 'TRANG CHỦ',
    title: 'Nắm bắt Dòng tiền & Sức khỏe',
    subtitle: 'Theo dõi tiền khả dụng và các cảnh báo chi tiêu tự động.',
    points: [
      {
        icon: 'sparkle',
        title: 'Tiền có thể chi còn lại',
        desc: 'Số tiền được tiêu tự do sau khi trừ chi phí thiết yếu & hũ mục tiêu.'
      },
      {
        icon: 'alert',
        title: 'Cảnh báo thông minh',
        desc: 'Tự động báo khi danh mục chạm mức 75% hoặc vượt 100% ngân sách.'
      },
      {
        icon: 'zap',
        title: 'Ghi nhanh thu chi',
        desc: 'Bấm nút "+ Thêm giao dịch" ở góc phải để ghi nhận phát sinh tức thì.'
      }
    ]
  },
  plan: {
    badge: 'KẾ HOẠCH',
    title: 'Quản lý Ví, Ngân sách & Định kỳ',
    subtitle: '3 trụ cột để chủ động kiểm soát tài chính hàng tháng.',
    points: [
      {
        icon: 'wallet',
        title: 'Ví & Tài khoản',
        desc: 'Khai báo các nguồn tiền. Chuyển khoản giữa các ví không bị tính trùng thu chi.'
      },
      {
        icon: 'budget',
        title: 'Hạn mức ngân sách',
        desc: 'Đặt số tiền tối đa cho từng danh mục để tránh bội chi.'
      },
      {
        icon: 'recurring',
        title: 'Khoản định kỳ',
        desc: 'Quản lý hóa đơn cố định và bấm thanh toán nhanh khi đến hạn.'
      }
    ]
  },
  analytics: {
    badge: 'PHÂN TÍCH',
    title: 'Thấu hiểu Cơ cấu Dòng tiền',
    subtitle: 'Biểu đồ trực quan giúp bạn tối ưu chi phí và tăng tỷ lệ tiết kiệm.',
    points: [
      {
        icon: 'trend',
        title: '4 Chỉ số KPI',
        desc: 'Theo dõi Tổng thu, Tổng chi, Tiết kiệm ròng và Tỷ lệ tiết kiệm (mục tiêu ≥ 20%).'
      },
      {
        icon: 'chart',
        title: 'Biểu đồ cơ cấu',
        desc: 'Biết chính xác khoản mục nào đang chiếm nhiều chi phí nhất.'
      },
      {
        icon: 'trend',
        title: 'Xu hướng thu chi',
        desc: 'So sánh dòng tiền qua từng tháng hoặc từng ngày để thấy rõ chu kỳ.'
      }
    ]
  }
};

export function ContextualSectionGuide() {
  const { intlLocale } = useTranslation();
  const activeView = useSpendingStore((s) => s.activeView);
  const openHelpModal = useSpendingStore((s) => s.openHelpModal);
  const user = useAuthStore((state) => state.user);
  const [currentGuide, setCurrentGuide] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const userId = user?.id || user?.email || 'guest';

  useEffect(() => {
    if (!activeView || !SECTION_GUIDE_DATA[activeView]) {
      setCurrentGuide(null);
      setIsExpanded(false);
      return;
    }

    const storageKey = `caltdhy_guide_seen_${userId}_${activeView}`;
    const hasSeen = localStorage.getItem(storageKey);

    if (!hasSeen) {
      setCurrentGuide(SECTION_GUIDE_DATA[activeView]);
      setIsExpanded(false);
    } else {
      setCurrentGuide(null);
      setIsExpanded(false);
    }
  }, [activeView, userId]);

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
          <span>Gợi ý cho {currentGuide.badge.toLocaleLowerCase(intlLocale)}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="floating-guide-widget">
      <aside id="contextual-section-guide" className="floating-guide-card" aria-label="Hướng dẫn nhanh">
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
            aria-label="Đóng hướng dẫn"
            title="Đóng"
          >
            <CloseOutlineIcon size={16} />
          </button>
        </div>

        <p className="floating-guide-subtitle">{currentGuide.subtitle}</p>

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
            Sổ tay đầy đủ ↗
          </button>
          <button
            type="button"
            className="floating-guide-ack-btn"
            onClick={handleDismiss}
          >
            Đã hiểu
          </button>
        </div>
      </aside>
    </div>
  );
}
