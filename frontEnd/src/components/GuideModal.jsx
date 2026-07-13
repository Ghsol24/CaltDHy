/* ============================================================
   CaltDHy — components/GuideModal.jsx
   Modal Hướng Dẫn Sử Dụng.
   ============================================================ */

import { useState } from 'react';

const TABS = [
  { key: 'overview', label: '📊 Tổng Quan' },
  { key: 'txn', label: '💳 Giao Dịch' },
  { key: 'budget', label: '🎯 Ngân Sách' },
  { key: 'analytics', label: '📈 Phân Tích' },
  { key: 'settings', label: '⚙️ Cài Đặt' },
  { key: 'tips', label: '💡 Mẹo Hay' }
];

export default function GuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  return (
    <div className="guide-overlay open" id="guideModal" role="dialog" aria-modal="true" aria-labelledby="guide-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="guide-panel">
        <button className="guide-close" onClick={onClose} aria-label="Đóng hướng dẫn">✕</button>

        <div className="guide-panel__screw gp-screw--tl" aria-hidden="true"></div>
        <div className="guide-panel__screw gp-screw--tr" aria-hidden="true"></div>
        <div className="guide-panel__screw gp-screw--bl" aria-hidden="true"></div>
        <div className="guide-panel__screw gp-screw--br" aria-hidden="true"></div>

        <div className="guide-header">
          <div className="guide-header__left">
            <div className="guide-header__badge">DOCS v2.0</div>
            <h2 className="guide-title" id="guide-title">
              <span className="guide-title__logo">Calt<span className="guide-title__accent">D</span>Hy</span>
              <span className="guide-title__sub"> — Hướng Dẫn Sử Dụng</span>
            </h2>
          </div>
        </div>

        <div className="guide-vents" aria-hidden="true">
          <div className="guide-vent"></div>
          <div className="guide-vent"></div>
          <div className="guide-vent"></div>
          <div className="guide-vent"></div>
          <div className="guide-vent"></div>
        </div>

        <nav className="guide-tabs" role="tablist" aria-label="Các mục hướng dẫn">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`guide-tab${activeTab === tab.key ? ' active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="guide-body">
          {/* ── TAB: OVERVIEW ── */}
          {activeTab === 'overview' && (
            <section className="guide-section active" role="tabpanel">
              <div className="guide-hero">
                <div className="guide-hero__icon" aria-hidden="true">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <p className="guide-hero__tagline">Hệ thống quản lý tài chính cá nhân — <strong>đơn giản, nhanh chóng, hiệu quả</strong></p>
              </div>

              <div className="guide-cards-grid">
                <div className="guide-card">
                  <div className="guide-card__icon">📊</div>
                  <div className="guide-card__content">
                    <h3 className="guide-card__title">Dashboard</h3>
                    <p className="guide-card__desc">Xem tổng quan số dư, thu nhập và chi tiêu theo tháng ngay trên màn hình chính.</p>
                  </div>
                </div>
                <div className="guide-card">
                  <div className="guide-card__icon">⚡</div>
                  <div className="guide-card__content">
                    <h3 className="guide-card__title">Quick Log</h3>
                    <p className="guide-card__desc">Bấm nút ✏️ góc phải dưới để ghi giao dịch nhanh chỉ trong 3 giây.</p>
                  </div>
                </div>
                <div className="guide-card">
                  <div className="guide-card__icon">🎯</div>
                  <div className="guide-card__content">
                    <h3 className="guide-card__title">Ngân Sách</h3>
                    <p className="guide-card__desc">Đặt ngân sách theo danh mục, theo dõi mức độ chi tiêu bằng thanh tiến độ màu sắc.</p>
                  </div>
                </div>
                <div className="guide-card">
                  <div className="guide-card__icon">📈</div>
                  <div className="guide-card__content">
                    <h3 className="guide-card__title">Phân Tích</h3>
                    <p className="guide-card__desc">Biểu đồ dòng tiền theo thời gian, phân tích xu hướng thu chi theo tháng.</p>
                  </div>
                </div>
                <div className="guide-card">
                  <div className="guide-card__icon">💾</div>
                  <div className="guide-card__content">
                    <h3 className="guide-card__title">Sao Lưu</h3>
                    <p className="guide-card__desc">Xuất/nhập dữ liệu dưới dạng JSON để bảo toàn dữ liệu khi đổi thiết bị.</p>
                  </div>
                </div>
                <div className="guide-card">
                  <div className="guide-card__icon">🌐</div>
                  <div className="guide-card__content">
                    <h3 className="guide-card__title">Đa Ngôn Ngữ</h3>
                    <p className="guide-card__desc">Hỗ trợ tiếng Việt (VI), tiếng Anh (EN) và tiếng Trung (ZH).</p>
                  </div>
                </div>
              </div>

              <div className="guide-note guide-note--info">
                <span className="guide-note__icon">ℹ️</span>
                <span>CaltDHy hoạt động <strong>offline hoàn toàn</strong> — dữ liệu lưu trong trình duyệt của bạn, không cần internet sau lần đăng nhập đầu tiên.</span>
              </div>
            </section>
          )}

          {/* ── TAB: GIAO DỊCH ── */}
          {activeTab === 'txn' && (
            <section className="guide-section active" role="tabpanel">
              <h3 className="guide-section-title">💳 Quản Lý Giao Dịch</h3>
              <div className="guide-step-list">
                <div className="guide-step">
                  <div className="guide-step__num">01</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Thêm Giao Dịch Mới</h4>
                    <p className="guide-step__desc">Bấm nút <span className="guide-kbd">+ ADD TRANSACTION</span> ở cột trái, hoặc dùng <span className="guide-kbd">✏️ FAB</span> (nút bút chì góc phải màn hình) để mở Quick Log nhanh hơn.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">02</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Chọn Loại Giao Dịch</h4>
                    <p className="guide-step__desc">Chọn <span className="guide-badge guide-badge--expense">EXPENSE</span> cho chi tiêu hoặc <span className="guide-badge guide-badge--income">INCOME</span> cho thu nhập. Màu sắc sẽ thay đổi để phân biệt.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">03</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Nhập Số Tiền</h4>
                    <p className="guide-step__desc">Hỗ trợ nhập biểu thức toán học! Ví dụ: <code className="guide-code">50000+20000</code> sẽ tự động tính thành <code className="guide-code">70,000 ₫</code>.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">04</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Chọn Danh Mục & Ngày</h4>
                    <p className="guide-step__desc">Chọn danh mục phù hợp (Food, Transport, Shopping...) và ngày giao dịch. Ngày mặc định là hôm nay.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">05</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Xóa / Hoàn Tác</h4>
                    <p className="guide-step__desc">Bấm <span className="guide-kbd">✕</span> trên mỗi giao dịch để xóa. Một thông báo <strong>UNDO</strong> sẽ xuất hiện trong 5 giây để hoàn tác nếu nhỡ tay.</p>
                  </div>
                </div>
              </div>

              <div className="guide-note guide-note--tip">
                <span className="guide-note__icon">💡</span>
                <span><strong>Mẹo nhanh:</strong> Nút <span className="guide-kbd">+</span> trên thẻ <em>Total Balance</em> mở màn hình nạp tiền số (numpad) để ghi thu nhập nhanh.</span>
              </div>
            </section>
          )}

          {/* ── TAB: BUDGET ── */}
          {activeTab === 'budget' && (
            <section className="guide-section active" role="tabpanel">
              <h3 className="guide-section-title">🎯 Quản Lý Ngân Sách (Envelope Method)</h3>
              <p className="guide-para">CaltDHy sử dụng phương pháp <strong>Envelope Budgeting</strong> — phân chia ngân sách theo từng "phong bì" danh mục cụ thể.</p>
              <div className="guide-step-list">
                <div className="guide-step">
                  <div className="guide-step__num">01</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Thiết Lập Ngân Sách</h4>
                    <p className="guide-step__desc">Bấm <span className="guide-kbd">SET BUDGETS</span> ở khu vực phong bì ngân sách. Bạn có thể đặt hạn mức chi tiêu cho từng danh mục riêng lẻ.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">02</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Thanh Tiến Độ Trực Quan</h4>
                    <p className="guide-step__desc">Mỗi danh mục ngân sách hiển thị một thanh tiến độ màu sắc để báo động mức độ chi tiêu (Xanh: OK, Vàng: Sắp chạm hạn mức, Đỏ: Đã vượt ngân sách).</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">03</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Kéo Thả Sắp Xếp</h4>
                    <p className="guide-step__desc">Bạn có thể kéo thả các thẻ ngân sách để thay đổi thứ tự ưu tiên hiển thị theo thói quen sử dụng cá nhân.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── TAB: ANALYTICS ── */}
          {activeTab === 'analytics' && (
            <section className="guide-section active" role="tabpanel">
              <h3 className="guide-section-title">📈 Phân Tích & Biểu Đồ</h3>
              <p className="guide-para">Chuyển sang tab <span className="guide-kbd">ANALYTICS</span> ở thanh menu trên cùng để truy cập hệ thống báo cáo thông minh.</p>
              <div className="guide-step-list">
                <div className="guide-step">
                  <div className="guide-step__num">01</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Biểu Đồ Dòng Tiền (Cash Flow)</h4>
                    <p className="guide-step__desc">So sánh tương quan giữa tổng thu và tổng chi theo thời gian để đánh giá sức khỏe tài chính.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">02</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Daily Spending</h4>
                    <p className="guide-step__desc">Theo dõi mức chi tiêu chi tiết hàng ngày để phát hiện những ngày có đột biến chi tiêu.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">03</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Đường Trung Bình (Average Line)</h4>
                    <p className="guide-step__desc">Mỗi biểu đồ cột chi tiêu hàng ngày có một đường nét đứt biểu thị mức chi tiêu trung bình để bạn dễ so sánh.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── TAB: SETTINGS ── */}
          {activeTab === 'settings' && (
            <section className="guide-section active" role="tabpanel">
              <h3 className="guide-section-title">⚙️ Cấu Hình & Sao Lưu</h3>
              <p className="guide-para">Bấm biểu tượng bánh răng ở góc phải trên để mở bảng điều khiển cấu hình ứng dụng.</p>
              <div className="guide-step-list">
                <div className="guide-step">
                  <div className="guide-step__num">01</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Thay Đổi Chủ Đề (Theme)</h4>
                    <p className="guide-step__desc">Hỗ trợ 4 chủ đề cao cấp: Cyberpunk Dark, Clean Light, Creamy Retro, và Forest Green.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">02</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Xuất Dữ Liệu (Backup JSON)</h4>
                    <p className="guide-step__desc">Xuất toàn bộ giao dịch và ngân sách thành tệp tin JSON tải về máy để lưu trữ dự phòng.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">03</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Nhập Dữ Liệu (Restore)</h4>
                    <p className="guide-step__desc">Tải tệp JSON sao lưu đã xuất trước đó lên để phục hồi nguyên vẹn dữ liệu.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── TAB: TIPS ── */}
          {activeTab === 'tips' && (
            <section className="guide-section active" role="tabpanel">
              <h3 className="guide-section-title">💡 Mẹo Sử Dụng Tiết Kiệm Thời Gian</h3>
              <div className="guide-step-list">
                <div className="guide-step">
                  <div className="guide-step__num">★</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Phím Tắt Nhanh</h4>
                    <p className="guide-step__desc">Chỉ cần nhấn phím <kbd className="guide-kbd">L</kbd> trên bàn phím để mở nhanh Quick Log ở bất kỳ đâu!</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">★</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Tính Toán Trực Tiếp</h4>
                    <p className="guide-step__desc">Bạn có thể sử dụng các phép toán nhân chia cộng trừ cơ bản như <code className="guide-code">50k * 3</code> ngay tại trường nhập tiền của biểu mẫu để tự động quy đổi.</p>
                  </div>
                </div>
                <div className="guide-step">
                  <div className="guide-step__num">★</div>
                  <div className="guide-step__content">
                    <h4 className="guide-step__title">Tránh Lỗi Trình Duyệt</h4>
                    <p className="guide-step__desc">Nếu ứng dụng hiển thị sai định dạng hoặc không thể tải biểu đồ, hãy nhấn tổ hợp phím <kbd className="guide-kbd">Ctrl+Shift+R</kbd> (hoặc <kbd className="guide-kbd">Cmd+Shift+R</kbd> trên Mac) để xóa bộ nhớ đệm và tải lại phiên bản mới nhất.</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
