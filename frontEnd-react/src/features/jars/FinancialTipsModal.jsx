import React, { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { formatCurrency, formatInputNumber } from '../../utils/formatters';
import { TargetOutlineIcon, ChartOutlineIcon, CloseOutlineIcon } from '../../components/ui/AppIcons';
import { useTranslation } from '../../i18n/useTranslation';

export function FinancialTipsModal({ isOpen, onClose, initialTopic = 'smart' }) {
  const { t } = useTranslation();

  const [topic, setTopic] = useState(initialTopic); // 'smart' | '50-30-20'
  const [customIncome, setCustomIncome] = useState('15000000');

  if (!isOpen) return null;

  const numericIncome = parseInt(String(customIncome).replace(/\D/g, ''), 10) || 0;
  const needs50 = Math.round(numericIncome * 0.5);
  const wants30 = Math.round(numericIncome * 0.3);
  const savings20 = Math.round(numericIncome * 0.2);

  const handleIncomeChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    setCustomIncome(rawVal);
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      portal={false}
      overlayClassName="modal-backdrop-overlay"
      className="financial-tips-dialog"
      label="Kiến thức tài chính"
    >
        {/* Header */}
        <div className="financial-tips-header">
          <div className="financial-tips-header__div--layout">
            <button
              type="button"
              onClick={() => setTopic('smart')}
              className={`financial-tips-tab-btn ${topic === 'smart' ? 'active' : ''} financial-tips-tab-btn--layout`}
             
            >
              <TargetOutlineIcon size={15} />
              <span>Tại sao cần mục tiêu?</span>
            </button>
            <button
              type="button"
              onClick={() => setTopic('50-30-20')}
              className={`financial-tips-tab-btn ${topic === '50-30-20' ? 'active' : ''} financial-tips-tab-btn--layout`}
             
            >
              <ChartOutlineIcon size={15} />
              <span>Quy tắc 50/30/20</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="financial-tips-close-btn"
            aria-label="Đóng"
          >
            <CloseOutlineIcon size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="financial-tips-body">
          {topic === 'smart' ? (
            <>
              <div>
                <h4 className="financial-tips-body__h4--text">
                  Biến Ước Mơ Thành Mục Tiêu Tài Chính Cụ Thể
                </h4>
                <p className="financial-tips-body__p--text">
                  Khi tiền tiết kiệm không có mục tiêu rõ ràng, nó rất dễ bị chi tiêu vào những khoản mua sắm bốc đồng.
                  Tạo các <strong>Hũ chi tiêu</strong> giúp bạn gán ý nghĩa cho từng đồng tiền bạn kiếm được.
                </p>
              </div>

              {/* SMART Pillars */}
              <div className="financial-tips-body__div--layout">
                <div className="financial-tips-body__div--box">
                  <strong className="financial-tips-body__strong--tone">
                    S - Cụ thể (Specific)
                  </strong>
                  <span className="financial-tips-body__span--text">
                    Thay vì "tiết kiệm tiền", hãy đặt tên hũ rõ ràng: "Quỹ khẩn cấp 6 tháng", "Mua xe máy mới", "Du lịch Đà Lạt".
                  </span>
                </div>

                <div className="financial-tips-body__div--box">
                  <strong className="financial-tips-body__strong--tone">
                    M - Đo lường được (Measurable)
                  </strong>
                  <span className="financial-tips-body__span--text">
                    {t('jars.measurableTip', { amount: formatCurrency(15000000) })}
                  </span>
                </div>

                <div className="financial-tips-body__div--box">
                  <strong className="financial-tips-body__strong--tone">
                    T - Có thời hạn (Time-bound)
                  </strong>
                  <span className="financial-tips-body__span--text">
                    Gán ngày đến hạn (Target Date) giúp CaltDHy tính toán chính xác mỗi tháng bạn cần nạp bao nhiêu tiền để về đích đúng hẹn.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 className="financial-tips-body__h4--text">
                  Quy Tắc Quản Trị Dòng Tiền 50/30/20
                </h4>
                <p className="financial-tips-body__p--text">
                  Đây là phương pháp phân bổ tài chính kinh điển giúp cân bằng giữa cuộc sống hiện tại và mục tiêu tương lai.
                </p>
              </div>

              {/* Interactive Calculator */}
              <div className="financial-tips-body__div--box2"
               
              >
                <div className="financial-tips-body__div--layout2">
                  <label className="financial-tips-body__label--text">
                    Thu nhập ròng hàng tháng của bạn (VND):
                  </label>
                  <input
                    type="text"
                    value={numericIncome ? formatInputNumber(numericIncome) : ''}
                    onChange={handleIncomeChange}
                    placeholder="Nhập mức thu nhập..."
                    className="financial-tips-input financial-tips-input--box"
                   
                  />
                </div>

                {/* 50/30/20 Distribution Visual Bar */}
                <div className="financial-tips-body__div--box3">
                  <div className="financial-tips-body__div--box4" title="50% Thiết yếu" />
                  <div className="financial-tips-body__div--box5" title="30% Mong muốn" />
                  <div className="financial-tips-body__div--box6" title="20% Tiết kiệm" />
                </div>

                {/* 3 Columns Output */}
                <div className="financial-tips-body__div--layout3">
                  <div className="financial-tips-body__div--box7">
                    <span className="financial-tips-body__span--text2">50% Thiết yếu</span>
                    <strong className="financial-tips-body__strong--text">
                      {formatCurrency(needs50)}
                    </strong>
                    <span className="financial-tips-body__span--text3">
                      Nhà cửa, ăn uống, hóa đơn
                    </span>
                  </div>

                  <div className="financial-tips-body__div--box7">
                    <span className="financial-tips-body__span--text4">30% Mong muốn</span>
                    <strong className="financial-tips-body__strong--text">
                      {formatCurrency(wants30)}
                    </strong>
                    <span className="financial-tips-body__span--text3">
                      Giải trí, mua sắm, ăn ngoài
                    </span>
                  </div>

                  <div className="financial-tips-body__div--box7">
                    <span className="financial-tips-body__span--text5">20% Tích lũy hũ</span>
                    <strong className="financial-tips-body__strong--text2">
                      {formatCurrency(savings20)}
                    </strong>
                    <span className="financial-tips-body__span--text3">
                      Nạp vào các hũ chi tiêu
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="financial-tips-footer">
          <div />
          <button
            type="button"
            onClick={onClose}
            className="financial-tips-ack-btn"
          >
            Đã hiểu
          </button>
        </div>
    </Dialog>
  );
}
