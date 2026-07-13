/* ============================================================
   CaltDHy — views/JarsView.jsx
   Quản lý Hũ tài chính & Định kỳ.
   Đã khôi phục hoàn toàn cấu trúc DOM và class CSS gốc để hiển thị đúng UI.
   ============================================================ */

import { useState, useEffect } from 'react';
import { apiGetJars, apiSaveJars } from '../services/api';
import { t } from '../utils/i18n';

const DEFAULT_JARS = [
  { id: 'necessities', name: 'necessities', target: 55, color: '#6366f1', description: '' },
  { id: 'education', name: 'education', target: 10, color: '#8b5cf6', description: '' },
  { id: 'savings', name: 'savings', target: 10, color: '#10b981', description: '' },
  { id: 'enjoyment', name: 'enjoyment', target: 10, color: '#f59e0b', description: '' },
  { id: 'investment', name: 'investment', target: 10, color: '#3b82f6', description: '' },
  { id: 'charity', name: 'charity', target: 5, color: '#ec4899', description: '' },
];

const jarNameMapping = {
  necessities: { en: '🏠 Necessities', vi: '🏠 Thiết Yếu' },
  education: { en: '📚 Education', vi: '📚 Giáo Dục' },
  savings: { en: '💰 Savings', vi: '💰 Tiết Kiệm' },
  enjoyment: { en: '🎉 Enjoyment', vi: '🎉 Hưởng Thụ' },
  investment: { en: '📈 Investment', vi: '📈 Đầu Tư' },
  charity: { en: '❤️ Charity', vi: '❤️ Cho Đi' }
};

const jarDescMapping = {
  necessities: { en: 'Basic living expenses: food, rent, transport', vi: 'Chi phí sống cơ bản: ăn, ở, đi lại' },
  education: { en: 'Learning, self development', vi: 'Học tập, phát triển bản thân' },
  savings: { en: 'Emergency fund & future planning', vi: 'Dự phòng khẩn cấp & tương lai' },
  enjoyment: { en: 'Entertainment, leisure, travel', vi: 'Giải trí, vui chơi, du lịch' },
  investment: { en: 'Stocks, real estate, business', vi: 'Cổ phiếu, bất động sản, kinh doanh' },
  charity: { en: 'Charity, helping others', vi: 'Từ thiện, giúp đỡ người khác' }
};

export default function JarsView({ txState, formatCurrency, lang = 'vi' }) {
  const { transactions } = txState;
  const [jars, setJars] = useState(DEFAULT_JARS);
  const [jarBalances, setJarBalances] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // Local input values for deposit/withdraw on each jar
  const [amounts, setAmounts] = useState({});

  // Fetch jars
  useEffect(() => {
    apiGetJars()
      .then(data => {
        if (data?.jars?.length) setJars(data.jars);
        if (data?.balances) setJarBalances(data.balances);
      })
      .catch(() => {
        const stored = localStorage.getItem('caltdhy_jars');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.jars) setJars(parsed.jars);
          if (parsed?.balances) setJarBalances(parsed.balances);
        }
      });
  }, []);

  const monthlyIncome = transactions
    .filter(t => {
      const d = new Date(t.date);
      const now = new Date();
      return t.type === 'income' &&
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  function handleDeposit(jarId) {
    const amt = parseFloat(amounts[jarId] || 0);
    if (isNaN(amt) || amt <= 0) return;
    setJarBalances(prev => ({ ...prev, [jarId]: (prev[jarId] || 0) + amt }));
    setAmounts(prev => ({ ...prev, [jarId]: '' }));
  }

  function handleWithdraw(jarId) {
    const amt = parseFloat(amounts[jarId] || 0);
    if (isNaN(amt) || amt <= 0) return;
    setJarBalances(prev => ({ ...prev, [jarId]: Math.max(0, (prev[jarId] || 0) - amt) }));
    setAmounts(prev => ({ ...prev, [jarId]: '' }));
  }

  async function handleSave() {
    setSaving(true);
    const payload = { jars, balances: jarBalances };
    localStorage.setItem('caltdhy_jars', JSON.stringify(payload));
    try {
      await apiSaveJars(jars);
      setToast(lang === 'vi' ? '✅ Đã lưu thành công!' : '✅ Saved successfully!');
      setTimeout(() => setToast(''), 2000);
    } catch {
      setToast(lang === 'vi' ? '💾 Đã lưu cục bộ (offline mode).' : '💾 Saved locally (offline mode).');
      setTimeout(() => setToast(''), 2000);
    } finally {
      setSaving(false);
    }
  }

  // Total accumulated savings in jars
  const totalSavings = Object.values(jarBalances).reduce((sum, val) => sum + val, 0);

  return (
    <div id="view-jars" className="dashboard-view active">
      <div className="jars-columns">
        
        {/* Left Column: Hũ Tiết Kiệm */}
        <section className="jars-section" aria-labelledby="jars-heading" style={{ flex: 2 }}>
          <div className="jars-section__header">
            <div className="jars-section__title-row">
              <h2 className="section-label" id="jars-heading">{t('jarsHeading', lang)}</h2>
              <p className="jars-section__subtitle">{t('jarsSubtitle', lang)}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-jar-history" onClick={handleSave} disabled={saving} type="button">
                {saving ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...') : (lang === 'vi' ? '💾 Lưu hũ' : '💾 Save Jars')}
              </button>
            </div>
          </div>

          {toast && <div className="toast-msg">{toast}</div>}

          {/* Metrics bar */}
          <div className="jars-summary-header" id="jarsLeftSummary">
            <div className="jars-summary-card">
              <div className="jars-summary-card__label">{t('jarsTotalSaved', lang)}</div>
              <div className="jars-summary-card__value" id="totalJarsBalance">{formatCurrency(totalSavings)}</div>
            </div>
            <div className="jars-summary-card">
              <div className="jars-summary-card__label">{t('monthlyIncome', lang)}</div>
              <div className="jars-summary-card__value">{formatCurrency(monthlyIncome)}</div>
            </div>
          </div>

          <div className="jars-grid" id="jarsGrid">
            {jars.map(jar => {
              const balance = jarBalances[jar.id] || 0;
              const recommended = (jar.target / 100) * monthlyIncome;
              const pct = recommended > 0 ? Math.min(100, (balance / recommended) * 100) : 0;
              const displayName = jarNameMapping[jar.id]?.[lang] || jar.name;
              const displayDesc = jarDescMapping[jar.id]?.[lang] || jar.description;

              return (
                <div key={jar.id} className="jar-card" style={{ '--jar-color': jar.color }}>
                  <div className="jar-card__header">
                    <span className="jar-card__name">{displayName}</span>
                    <span className="jar-card__target">{jar.target}%</span>
                  </div>
                  <p className="jar-card__desc">{displayDesc}</p>
                  <div className="jar-card__balance">{formatCurrency(balance)}</div>

                  <div className="jar-progress" aria-label={`${pct.toFixed(0)}% ${lang === 'vi' ? 'mục tiêu' : 'goal'}`}>
                    <div className="jar-progress__fill" style={{ width: `${pct}%`, background: jar.color }}></div>
                  </div>
                  <div className="jar-progress__meta">
                    <span>{pct.toFixed(0)}% {lang === 'vi' ? 'mục tiêu' : 'goal'}</span>
                    <span>{lang === 'vi' ? 'Đề nghị' : 'Recommended'}: {formatCurrency(recommended)}</span>
                  </div>

                  <div className="jar-actions">
                    <input
                      className="jar-amount-input"
                      type="number"
                      placeholder={lang === 'vi' ? 'Số tiền...' : 'Amount...'}
                      value={amounts[jar.id] || ''}
                      onChange={e => setAmounts({ ...amounts, [jar.id]: e.target.value })}
                    />
                    <div className="jar-action-btns">
                      <button className="jar-btn jar-btn--deposit" onClick={() => handleDeposit(jar.id)} type="button">
                        {lang === 'vi' ? '＋ Nạp' : '＋ Deposit'}
                      </button>
                      <button className="jar-btn jar-btn--withdraw" onClick={() => handleWithdraw(jar.id)} type="button">
                        {lang === 'vi' ? '－ Rút' : '－ Withdraw'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Định Kỳ */}
        <section className="installments-section" aria-labelledby="inst-heading" style={{ flex: 1 }}>
          <div className="inst-section__header">
            <div className="inst-section__title-row">
              <h2 className="section-label" id="inst-heading">{t('instHeading', lang)}</h2>
              <p className="inst-section__subtitle">{t('instSubtitle', lang)}</p>
            </div>
          </div>

          <div id="installmentList">
            <div className="empty-state">
              <div className="empty-state__icon">💳</div>
              <h3 className="empty-state__title">{t('instNoBillsTitle', lang)}</h3>
              <p className="empty-state__hint">{t('instNoBillsDesc', lang)}</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
