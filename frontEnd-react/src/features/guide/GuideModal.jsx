import React, { useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';

export function GuideModal() {
  const isHelpOpen = useSpendingStore((s) => s.isHelpOpen);
  const closeHelpModal = useSpendingStore((s) => s.closeHelpModal);
  const setActiveView = useSpendingStore((s) => s.setActiveView);
  const setPlanSubTab = useSpendingStore((s) => s.setPlanSubTab);
  const setAnalyticsSubTab = useSpendingStore((s) => s.setAnalyticsSubTab);
  const setJarsSubTab = useSpendingStore((s) => s.setJarsSubTab);
  const [activeTab, setActiveTab] = useState('quickstart'); // 'quickstart' | 'home' | 'plan' | 'analytics' | 'jars'

  if (!isHelpOpen) return null;

  const navigateTo = (view, subTab) => {
    closeHelpModal();
    setActiveView(view);
    if (view === 'plan' && subTab) setPlanSubTab(subTab);
    if (view === 'analytics' && subTab) setAnalyticsSubTab(subTab);
    if (view === 'jars' && subTab) setJarsSubTab(subTab);
  };

  return (
    <div
      className="modal-backdrop-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeHelpModal();
      }}
      role="presentation"
    >
      <div
        className="budget-setup-dialog guide-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Sổ tay hướng dẫn CaltDHy"
      >
        {/* Header */}
        <div className="budget-dialog-header">
          <div className="budget-dialog-header-lead">
            <div className="budget-dialog-icon-tile guide-header-icon">
              📖
            </div>
            <div className="budget-dialog-titles">
              <h2 className="budget-dialog-title">Hướng dẫn sử dụng CaltDHy</h2>
              <p className="budget-dialog-desc">Làm chủ tài chính cá nhân với phương pháp quản lý dòng tiền chuẩn mực.</p>
            </div>
          </div>
          <button
            type="button"
            className="budget-dialog-close-btn"
            onClick={closeHelpModal}
            aria-label="Đóng hướng dẫn"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="guide-tabs-bar" role="tablist">
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === 'quickstart' ? 'active' : ''}`}
            onClick={() => setActiveTab('quickstart')}
          >
            🚀 Bắt đầu nhanh
          </button>
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            🏠 Trang chủ
          </button>
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            📋 Kế hoạch
          </button>
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Phân tích
          </button>
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === 'jars' ? 'active' : ''}`}
            onClick={() => setActiveTab('jars')}
          >
            🏺 6 Hũ chi tiêu
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="guide-modal-body">
          {/* ── TAB 1: BẮT ĐẦU NHANH ── */}
          {activeTab === 'quickstart' && (
            <div className="guide-tab-pane">
              <div className="guide-hero-banner">
                <h4>Quy trình 4 bước làm chủ tài chính hàng tháng</h4>
                <p>Thực hiện lần lượt 4 bước sau để CaltDHy tự động hóa việc theo dõi và bảo vệ ví tiền của bạn.</p>
              </div>

              <div className="guide-steps-grid">
                <div className="guide-step-card">
                  <div className="guide-step-number">1</div>
                  <div className="guide-step-content">
                    <h5>Khai báo Ví & Số dư ban đầu</h5>
                    <p>Thêm các tài khoản nguồn: Tiền mặt, Thẻ ngân hàng, Ví điện tử để hệ thống tổng hợp tài sản ròng chính xác.</p>
                    <button type="button" className="guide-action-link" onClick={() => navigateTo('plan', 'wallets')}>
                      Mở mục Ví & Tài khoản →
                    </button>
                  </div>
                </div>

                <div className="guide-step-card">
                  <div className="guide-step-number">2</div>
                  <div className="guide-step-content">
                    <h5>Đặt Hạn mức Ngân sách tháng</h5>
                    <p>Quy định số tiền tối đa được phép tiêu cho từng nhóm: Ăn uống, Nhà cửa, Di chuyển, Mua sắm...</p>
                    <button type="button" className="guide-action-link" onClick={() => navigateTo('plan', 'budgets')}>
                      Mở Hạn mức ngân sách →
                    </button>
                  </div>
                </div>

                <div className="guide-step-card">
                  <div className="guide-step-number">3</div>
                  <div className="guide-step-content">
                    <h5>Ghi nhận Giao dịch khi phát sinh</h5>
                    <p>Bấm nút <strong>+ Thêm giao dịch</strong> ở góc phải. Ghi chi tiêu, thu nhập hoặc chuyển khoản nội bộ.</p>
                    <button type="button" className="guide-action-link" onClick={() => navigateTo('home')}>
                      Về Trang chủ ghi giao dịch →
                    </button>
                  </div>
                </div>

                <div className="guide-step-card">
                  <div className="guide-step-number">4</div>
                  <div className="guide-step-content">
                    <h5>Kiểm tra Dòng tiền & Điều chỉnh</h5>
                    <p>Theo dõi chỉ số <em>Tiền có thể chi còn lại</em> và biểu đồ phân tích để không bao giờ bị bội chi vào cuối tháng.</p>
                    <button type="button" className="guide-action-link" onClick={() => navigateTo('analytics', 'overview')}>
                      Xem biểu đồ Phân tích →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: TRANG CHỦ ── */}
          {activeTab === 'home' && (
            <div className="guide-tab-pane">
              <div className="guide-section-block">
                <h5>1. Thẻ "Tiền có thể chi còn lại" (Safe to Spend)</h5>
                <p>
                  Đây là chỉ số quan trọng nhất trên Dashboard. Con số này cho bạn biết chính xác bạn còn bao nhiêu tiền được tiêu tự do, sau khi đã trừ đi các khoản chi phí cố định bắt buộc và tiền đã trích vào mục tiêu tiết kiệm.
                </p>
                <div className="guide-formula-box">
                  <code>Tiền có thể chi = Tổng số dư ví − Chi phí thiết yếu còn lại − Tiền đã dành cho hũ mục tiêu</code>
                </div>
              </div>

              <div className="guide-section-block">
                <h5>2. Hệ thống cảnh báo thông minh (Attention Panel)</h5>
                <p>
                  Bảng bên phải sẽ tự động chuyển trạng thái màu dựa trên tốc độ tiêu dùng thực tế:
                </p>
                <ul className="guide-bullet-list">
                  <li><span className="guide-badge-pill green">An toàn (&lt; 75%)</span>: Chi tiêu trong kế hoạch, hiển thị số tiền khả dụng.</li>
                  <li><span className="guide-badge-pill amber">Cảnh báo (75% - 99%)</span>: Danh mục gần chạm trần, nhắc nhở số tiền còn lại cho các ngày tới.</li>
                  <li><span className="guide-badge-pill red">Nguy hiểm (≥ 100%)</span>: Danh mục đã vượt ngân sách, gợi ý cắt giảm chi tiêu không thiết yếu.</li>
                </ul>
              </div>

              <div className="guide-section-block">
                <h5>3. Quản lý Giao dịch gần đây</h5>
                <p>
                  Xem danh sách các khoản thu/chi mới nhất, có thể xóa nhanh hoặc kiểm tra nguồn ví thanh toán ngay trên timeline.
                </p>
              </div>
            </div>
          )}

          {/* ── TAB 3: KẾ HOẠCH ── */}
          {activeTab === 'plan' && (
            <div className="guide-tab-pane">
              <div className="guide-section-block">
                <h5>1. Ví & Tài khoản (Wallets)</h5>
                <p>
                  Quản lý đa tài khoản độc lập. Khi chuyển tiền giữa các ví (ví dụ: Rút tiền ATM từ Thẻ về Tiền mặt), hệ thống ghi nhận là <strong>Chuyển khoản nội bộ</strong> và không tính trùng vào thu/chi của tháng.
                </p>
              </div>

              <div className="guide-section-block">
                <h5>2. Hạn mức Ngân sách (Budgets)</h5>
                <p>
                  Ngân sách được tính riêng cho từng tháng. Bạn có thể:
                </p>
                <ul className="guide-bullet-list">
                  <li>Phân loại danh mục theo <strong>Thiết yếu (Needs)</strong> và <strong>Mong muốn (Wants)</strong>.</li>
                  <li>Nhập hạn mức bằng bàn phím số hoặc bấm nút gợi ý nhanh.</li>
                  <li>Theo dõi tỷ lệ phần trăm đã tiêu trên thanh tiến độ trực quan.</li>
                </ul>
              </div>

              <div className="guide-section-block">
                <h5>3. Khoản định kỳ (Recurring Bills)</h5>
                <p>
                  Quản lý các hóa đơn lặp lại hàng tháng (Tiền nhà, Điện nước, Internet, Trả góp...). Bạn có thể bấm <strong>Thanh toán</strong> để tự động tạo giao dịch chi tiêu khi đến ngày đến hạn.
                </p>
              </div>
            </div>
          )}

          {/* ── TAB 4: PHÂN TÍCH ── */}
          {activeTab === 'analytics' && (
            <div className="guide-tab-pane">
              <div className="guide-section-block">
                <h5>1. Thống kê KPI Tổng quan (Overview)</h5>
                <ul className="guide-bullet-list">
                  <li><strong>Tổng thu nhập</strong>: Tổng tất cả nguồn tiền nhận vào trong tháng.</li>
                  <li><strong>Tổng chi tiêu</strong>: Tổng số tiền đã thanh toán cho mọi danh mục.</li>
                  <li><strong>Tiết kiệm ròng</strong>: <code>Thu nhập − Chi tiêu</code> (dương là thặng dư, âm là thâm hụt).</li>
                  <li><strong>Tỷ lệ tiết kiệm</strong>: <code>(Tiết kiệm ròng / Thu nhập) × 100%</code> (Mức lý tưởng là ≥ 20%).</li>
                </ul>
              </div>

              <div className="guide-section-block">
                <h5>2. Biểu đồ cơ cấu Danh mục (Doughnut Chart)</h5>
                <p>
                  Nhận diện tức thì danh mục nào đang "ngốn" nhiều tiền nhất của bạn theo tỷ lệ phần trăm để có phương án tối ưu hợp lý.
                </p>
              </div>

              <div className="guide-section-block">
                <h5>3. Xu hướng dòng tiền (Cash Flow Bar Chart)</h5>
                <p>
                  So sánh 2 cột Thu (Xanh) và Chi (Đỏ) qua từng tháng trong năm hoặc qua từng ngày trong tháng để thấy rõ chu kỳ dòng tiền của bản thân.
                </p>
              </div>
            </div>
          )}

          {/* ── TAB 5: HŨ CHI TIÊU ── */}
          {activeTab === 'jars' && (
            <div className="guide-tab-pane">
              <div className="guide-section-block">
                <h5>Phương pháp 6 Hũ tài chính chuẩn mực (J. Harv Eker)</h5>
                <p>
                  Quy tắc chia thu nhập thành 6 hũ để vừa đáp ứng cuộc sống hiện tại, vừa xây dựng nền tảng tài chính tự do trong tương lai:
                </p>
                <div className="guide-jars-spec-list">
                  <div className="guide-jar-spec-item">
                    <span className="jar-spec-code">NEC (55%)</span>
                    <strong>Nhu cầu thiết yếu</strong>: Ăn uống, nhà ở, điện nước, sinh hoạt cơ bản.
                  </div>
                  <div className="guide-jar-spec-item">
                    <span className="jar-spec-code">LTSS (10%)</span>
                    <strong>Tiết kiệm dài hạn</strong>: Mua nhà, mua xe, quỹ khẩn cấp 6 tháng.
                  </div>
                  <div className="guide-jar-spec-item">
                    <span className="jar-spec-code">FFA (10%)</span>
                    <strong>Tự do tài chính</strong>: Đầu tư sinh lời, tạo dòng tiền thụ động.
                  </div>
                  <div className="guide-jar-spec-item">
                    <span className="jar-spec-code">EDU (10%)</span>
                    <strong>Giáo dục & Phát triển</strong>: Học tập, sách vở, nâng cao kỹ năng.
                  </div>
                  <div className="guide-jar-spec-item">
                    <span className="jar-spec-code">PLAY (10%)</span>
                    <strong>Hưởng thụ</strong>: Giải trí, du lịch, tự thưởng cho bản thân.
                  </div>
                  <div className="guide-jar-spec-item">
                    <span className="jar-spec-code">GIVE (5%)</span>
                    <strong>Cho đi & Thiện nguyện</strong>: Giúp đỡ gia đình, bạn bè và cộng đồng.
                  </div>
                </div>
              </div>

              <div className="guide-section-block">
                <h5>Cách thực hành Nạp & Rút tiền hũ</h5>
                <p>
                  Khi có thu nhập về, bấm <strong>Nạp tiền</strong> để phân bổ vào từng hũ tương ứng. Khi cần chi tiêu cho mục đích cụ thể, bấm <strong>Rút tiền</strong> từ hũ đó.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="budget-dialog-footer guide-modal-footer">
          <button type="button" className="btn-dialog-save" onClick={closeHelpModal}>
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
