/* ============================================================
   CaltDHy — components/WrapupModal.jsx
   Modal báo cáo tổng kết tháng (Monthly Wrap-up).
   ============================================================ */

import { useState, useMemo } from 'react';

export default function WrapupModal({ isOpen, onClose, transactions, formatCurrency }) {
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth()}`; // 'YYYY-M' where M is 0-11
  });

  // Tìm danh sách các tháng có giao dịch để hiển thị trong dropdown chọn kỳ báo cáo
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        monthsSet.add(`${d.getFullYear()}-${d.getMonth()}`);
      }
    });

    // Luôn thêm tháng hiện tại nếu trống
    const today = new Date();
    monthsSet.add(`${today.getFullYear()}-${today.getMonth()}`);

    // Sắp xếp giảm dần theo thời gian
    return Array.from(monthsSet).sort((a, b) => {
      const [yA, mA] = a.split('-').map(Number);
      const [yB, mB] = b.split('-').map(Number);
      return yB * 12 + mB - (yA * 12 + mA);
    });
  }, [transactions]);

  // Hàm tính toán các chỉ số tổng hợp của một tháng cụ thể
  const calcMonthStats = (yearMonthStr) => {
    const [year, month] = yearMonthStr.split('-').map(Number);
    let totalIncome = 0;
    let totalExpense = 0;
    let txnCount = 0;
    const totalsByCat = {};

    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;

      txnCount++;
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        if (!t.jarId && t.category !== 'Savings') {
          totalsByCat[t.category] = (totalsByCat[t.category] || 0) + t.amount;
        }
      }
    });

    const savings = totalIncome - totalExpense;
    // Tỉ lệ tích luỹ = (Tiền tích luỹ / Thu nhập) * 100
    const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

    let topCat = null;
    let topCatAmt = 0;
    Object.keys(totalsByCat).forEach(c => {
      if (totalsByCat[c] > topCatAmt) {
        topCat = c;
        topCatAmt = totalsByCat[c];
      }
    });

    return {
      totalIncome,
      totalExpense,
      savings,
      savingsRate,
      topCat,
      topCatAmt,
      txnCount
    };
  };

  const periodStats = useMemo(() => {
    return calcMonthStats(selectedPeriod);
  }, [selectedPeriod, transactions]);

  const prevPeriodStats = useMemo(() => {
    const [y, m] = selectedPeriod.split('-').map(Number);
    const prevDate = new Date(y, m - 1, 1);
    const prevStr = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;
    return calcMonthStats(prevStr);
  }, [selectedPeriod, transactions]);

  if (!isOpen) return null;

  const [selYear, selMonth] = selectedPeriod.split('-').map(Number);
  const localeDate = new Date(selYear, selMonth, 1);
  const monthName = localeDate.toLocaleString('vi-VN', { month: 'long' }).toUpperCase();
  const yearName = selYear;

  const prevDate = new Date(selYear, selMonth - 1, 1);
  const prevMonthName = prevDate.toLocaleString('vi-VN', { month: 'short' }).toUpperCase() + ' ' + prevDate.getFullYear();
  const currMonthName = localeDate.toLocaleString('vi-VN', { month: 'short' }).toUpperCase() + ' ' + yearName;

  const hasPrevData = prevPeriodStats.txnCount > 0;

  // Tính xem tháng này có tốt hơn tháng trước về các chỉ số không
  const isSavingsRateWinner = currMonthName && hasPrevData && periodStats.savingsRate > prevPeriodStats.savingsRate;
  const isSavingsWinner = currMonthName && hasPrevData && periodStats.savings > prevPeriodStats.savings;
  const isTopSpendWinner = currMonthName && hasPrevData && periodStats.topCatAmt < prevPeriodStats.topCatAmt && periodStats.topCatAmt > 0;

  // Bản tin nhắn nhận xét
  let commentMsg = '';
  if (periodStats.txnCount === 0) {
    commentMsg = 'Không có dữ liệu giao dịch trong kỳ này.';
  } else if (periodStats.savings >= 0) {
    if (periodStats.savingsRate >= 30) {
      commentMsg = `🎉 Xuất sắc! Bạn đã tích luỹ <strong>${periodStats.savingsRate.toFixed(0)}%</strong> thu nhập tháng này. Hãy tiếp tục phong độ đó!`;
    } else {
      commentMsg = `✅ Tháng ${monthName} kết thúc với tích luỹ ròng <strong>${formatCurrency(periodStats.savings)}</strong>. Tốt lắm!`;
    }
  } else {
    commentMsg = `⚠️ Chi tiêu vượt thu nhập <strong>${formatCurrency(Math.abs(periodStats.savings))}</strong> trong tháng này. Hãy cân nhắc điều chỉnh ngân sách tháng tới nhé!`;
  }

  return (
    <div className="modal-overlay open" id="monthlyReportModal" role="dialog" aria-modal="true" aria-labelledby="report-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card modal-card--report">
        <button className="modal-close" onClick={onClose} aria-label="Đóng báo cáo">✕</button>

        <div className="modal-card__screw mc--tl" aria-hidden="true"></div>
        <div className="modal-card__screw mc--tr" aria-hidden="true"></div>
        <div className="modal-card__screw mc--bl" aria-hidden="true"></div>
        <div className="modal-card__screw mc--br" aria-hidden="true"></div>

        <div className="report-header">
          <h2 className="report-title" id="report-title">MONTHLY WRAP-UP</h2>
          <p className="report-subtitle" id="reportMonthLabel">{monthName} {yearName}</p>
        </div>

        {/* Bộ chọn kỳ báo cáo */}
        <div className="report-period-selector-wrapper" style={{ margin: '10px 0 20px', display: 'flex', justifyContent: 'center' }}>
          <select
            className="budget-form-input"
            style={{ width: '220px', textAlign: 'center', textTransform: 'uppercase' }}
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
          >
            {availableMonths.map(key => {
              const [y, m] = key.split('-').map(Number);
              const d = new Date(y, m, 1);
              const label = d.toLocaleString('vi-VN', { month: 'long', year: 'numeric' }).toUpperCase();
              return (
                <option key={key} value={key}>{label}</option>
              );
            })}
          </select>
        </div>

        {/* Grid so sánh */}
        <div className={`report-comparison-grid${hasPrevData ? '' : ' single-column'}`}>
          {/* Cột tháng trước (nếu có) */}
          {hasPrevData && (
            <div className="report-col report-col--prev">
              <div className="report-col__header">
                {prevMonthName}
              </div>
              <div className="report-stat">
                <span className="report-stat__label">Tỉ lệ tích luỹ</span>
                <span className="report-stat__value">{prevPeriodStats.savingsRate.toFixed(1)}%</span>
              </div>
              <div className="report-stat">
                <span className="report-stat__label">Chi nhiều nhất</span>
                <span className="report-stat__value" style={{ fontSize: '11px' }}>
                  {prevPeriodStats.topCat ? `${prevPeriodStats.topCat}: ${formatCurrency(prevPeriodStats.topCatAmt)}` : '--'}
                </span>
              </div>
              <div className="report-stat">
                <span className="report-stat__label">Tích luỹ ròng</span>
                <span className="report-stat__value" style={{ color: prevPeriodStats.savings >= 0 ? 'var(--green)' : 'var(--accent)' }}>
                  {prevPeriodStats.savings >= 0 ? '+' : ''}{formatCurrency(prevPeriodStats.savings)}
                </span>
              </div>
              <div className="report-stat">
                <span className="report-stat__label">Tổng giao dịch</span>
                <span className="report-stat__value">{prevPeriodStats.txnCount}</span>
              </div>
            </div>
          )}

          {/* Cột tháng hiện tại */}
          <div className="report-col report-col--current">
            <div className="report-col__header">
              {currMonthName} <span className="report-col__header-badge">Tháng vừa qua</span>
            </div>
            <div className={`report-stat${isSavingsRateWinner ? ' report-stat--winner' : ''}`}>
              <span className="report-stat__label">Tỉ lệ tích luỹ</span>
              <span className="report-stat__value">{periodStats.savingsRate.toFixed(1)}%</span>
            </div>
            <div className={`report-stat${isTopSpendWinner ? ' report-stat--winner' : ''}`}>
              <span className="report-stat__label">Chi nhiều nhất</span>
              <span className="report-stat__value" style={{ fontSize: '11px' }}>
                {periodStats.topCat ? `${periodStats.topCat}: ${formatCurrency(periodStats.topCatAmt)}` : '--'}
              </span>
            </div>
            <div className={`report-stat${isSavingsWinner ? ' report-stat--winner' : ''}`}>
              <span className="report-stat__label">Tích luỹ ròng</span>
              <span className="report-stat__value" style={{ color: periodStats.savings >= 0 ? 'var(--green)' : 'var(--accent)' }}>
                {periodStats.savings >= 0 ? '+' : ''}{formatCurrency(periodStats.savings)}
              </span>
            </div>
            <div className="report-stat">
              <span className="report-stat__label">Tổng giao dịch</span>
              <span className="report-stat__value">{periodStats.txnCount}</span>
            </div>
          </div>
        </div>

        {/* Nhận xét động */}
        <div className="report-message" id="reportMessage" dangerouslySetInnerHTML={{ __html: commentMsg }} />

        <div className="modal-actions monthly-report-actions">
          <button className="btn-primary btn-start-fresh" style={{ width: '100%' }} onClick={onClose}>
            ĐÓNG TỔNG KẾT
          </button>
        </div>
      </div>
    </div>
  );
}
