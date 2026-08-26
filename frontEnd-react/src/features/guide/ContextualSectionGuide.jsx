import React, { useState, useEffect } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useAuthStore } from '../../stores/useAuthStore';

const SECTION_GUIDE_DATA = {
  home: {
    badge: 'TRANG CHỦ',
    title: 'Nắm bắt Dòng tiền & Sức khỏe',
    subtitle: 'Theo dõi tiền khả dụng và các cảnh báo chi tiêu tự động.',
    points: [
      {
        icon: '💎',
        title: 'Tiền có thể chi còn lại',
        desc: 'Số tiền được tiêu tự do sau khi trừ chi phí thiết yếu & hũ mục tiêu.'
      },
      {
        icon: '⚠️',
        title: 'Cảnh báo thông minh',
        desc: 'Tự động báo khi danh mục chạm mức 75% hoặc vượt 100% ngân sách.'
      },
      {
        icon: '⚡',
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
        icon: '💳',
        title: 'Ví & Tài khoản',
        desc: 'Khai báo các nguồn tiền. Chuyển khoản giữa các ví không bị tính trùng thu chi.'
      },
      {
        icon: '📊',
        title: 'Hạn mức ngân sách',
        desc: 'Đặt số tiền tối đa cho từng danh mục để tránh bội chi.'
      },
      {
        icon: '🔄',
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
        icon: '📈',
        title: '4 Chỉ số KPI',
        desc: 'Theo dõi Tổng thu, Tổng chi, Tiết kiệm ròng và Tỷ lệ tiết kiệm (mục tiêu ≥ 20%).'
      },
      {
        icon: '🍩',
        title: 'Biểu đồ cơ cấu',
        desc: 'Biết chính xác khoản mục nào đang chiếm nhiều chi phí nhất.'
      },
      {
        icon: '📊',
        title: 'Xu hướng thu chi',
        desc: 'So sánh dòng tiền qua từng tháng hoặc từng ngày để thấy rõ chu kỳ.'
      }
    ]
  },
  jars: {
    badge: 'HŨ CHI TIÊU',
    title: 'Phương pháp Quản lý 6 Hũ',
    subtitle: 'Chia thu nhập thành 6 hũ tài chính để tự do và đạt mục tiêu.',
    points: [
      {
        icon: '🏺',
        title: 'Quy tắc 6 Hũ',
        desc: 'Thiết yếu 55%, Tiết kiệm 10%, Đầu tư 10%, Giáo dục 10%, Hưởng thụ 10%, Cho đi 5%.'
      },
      {
        icon: '📥',
        title: 'Nạp & Rút tiền hũ',
        desc: 'Nạp tiền khi có thu nhập và rút tiền từ đúng hũ khi phát sinh nhu cầu.'
      },
      {
        icon: '🎯',
        title: 'Mục tiêu có hạn chót',
        desc: 'Theo dõi tiến độ % và thời gian để duy trì động lực tích lũy.'
      }
    ]
  }
};

export function ContextualSectionGuide() {
  const { activeView, openHelpModal } = useSpendingStore();
  const { user } = useAuthStore();
  const [currentGuide, setCurrentGuide] = useState(null);

  const userId = user?.id || user?.email || 'guest';

  useEffect(() => {
    if (!activeView || !SECTION_GUIDE_DATA[activeView]) {
      setCurrentGuide(null);
      return;
    }

    const storageKey = `caltdhy_guide_seen_${userId}_${activeView}`;
    const hasSeen = localStorage.getItem(storageKey);

    if (!hasSeen) {
      setCurrentGuide(SECTION_GUIDE_DATA[activeView]);
    } else {
      setCurrentGuide(null);
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

  return (
    <div className="floating-guide-widget" role="complementary" aria-label="Hướng dẫn nhanh">
      <div className="floating-guide-card">
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
            ✕
          </button>
        </div>

        <p className="floating-guide-subtitle">{currentGuide.subtitle}</p>

        {/* 3 Key Points */}
        <div className="floating-guide-points">
          {currentGuide.points.map((pt, idx) => (
            <div key={idx} className="floating-point-row">
              <span className="floating-point-icon" aria-hidden="true">{pt.icon}</span>
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
      </div>
    </div>
  );
}
