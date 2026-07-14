/* ============================================================
   CaltDHy — views/DashboardLayout.jsx
   Layout chính của app: Topbar + Sidebar Rail + Main View + Modals.
   Khôi phục 100% UI nguyên bản: Quick Deposit Numpad, FAB Quick Log,
   Budget Modal, Segment Glow Doughnut Chart, STABLE_CHART_COLORS.
   ============================================================ */

import { useState, useMemo, useEffect, useRef } from 'react';
import Topbar from '../components/Topbar';
import {
  useTransactions, EXCHANGE_RATE, CNY_RATE,
  getCategoryColor, evalMathExpression, DEFAULT_CATEGORIES,
} from '../hooks/useTransactions';
import { t, tCat, getCatIcon } from '../utils/i18n';
import { useAuth } from '../hooks/useAuth';

// Views
import DashboardView from './DashboardView';
import AnalyticsView from './AnalyticsView';
import JarsView from './JarsView';

// Modals
import AccountModal from '../components/AccountModal';
import GuideModal from '../components/GuideModal';
import WrapupModal from '../components/WrapupModal';

// Chart components
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// ── Plugin: Segment Glow (tái tạo nguyên bản từ spending.js) ──
const segmentGlowPlugin = {
  id: 'segmentGlow',
  beforeDatasetDraw(chart) {
    const ctx = chart.ctx;
    ctx.save();
    const glowColors = chart.data.datasets[0]._glowColors || [];
    chart.data.datasets[0].backgroundColor.forEach((_, i) => {
      const meta = chart.getDatasetMeta(0);
      const arc = meta.data[i];
      if (!arc) return;
      ctx.shadowColor = glowColors[i] || 'rgba(255,255,255,0.3)';
      ctx.shadowBlur = 18;
      arc.draw(ctx);
    });
    ctx.restore();
  }
};

export default function DashboardLayout() {
  const { user, updateUser } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem('railCollapsed') !== 'true';
  });

  const txState = useTransactions();
  const {
    getTotals,
    transactions,
    budgets,
    setBudget,
    saveAllBudgets,
    getAllCategories,
    getCategoryType,
    addTransaction,
    customCategories,
    addCustomCategory,
  } = txState;

  const { income, expense, balance } = getTotals();

  // ── Theme State ──
  const [theme, setTheme] = useState(() => localStorage.getItem('caltdhy_theme') || 'dark');
  const [lang, setLang] = useState(() => localStorage.getItem('caltdhy_lang') || 'vi');
  const [currency, setCurrency] = useState(() => localStorage.getItem('caltdhy_currency') || 'VND');

  // Apply theme class to html element
  useEffect(() => {
    const root = document.documentElement;
    ['dark-theme', 'light-theme', 'cream-theme', 'green-theme'].forEach(c => root.classList.remove(c));
    if (theme !== 'dark') root.classList.add(`${theme}-theme`);
    localStorage.setItem('caltdhy_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('caltdhy_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('caltdhy_currency', currency);
  }, [currency]);

  // ── Currency Formatter (y hệt bản gốc) ──
  const formatCurrency = (amountInVND) => {
    if (currency === 'USD') {
      const val = amountInVND / EXCHANGE_RATE;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    if (currency === 'CNY') {
      const val = amountInVND / CNY_RATE;
      return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amountInVND).replace(/\s?₫/, ' đ');
  };

  // ── Modal States ──
  const [showAddTxModal, setShowAddTxModal]       = useState(false);
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [showNumpadModal, setShowNumpadModal]     = useState(false);
  const [showBudgetModal, setShowBudgetModal]     = useState(false);
  const [showSettings, setShowSettings]           = useState(false);
  const [showAccount, setShowAccount]             = useState(false);
  const [showGuide, setShowGuide]                 = useState(false);
  const [showWrapup, setShowWrapup]               = useState(false);

  // ── Add Transaction Form ──
  const [formType, setFormType]     = useState('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formCat, setFormCat]       = useState('');
  const [formNote, setFormNote]     = useState('');
  const [formDate, setFormDate]     = useState(new Date().toISOString().slice(0, 10));
  const [formError, setFormError]   = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // ── Quick Log (FAB) Form ──
  const [qlType, setQlType]     = useState('expense');
  const [qlAmount, setQlAmount] = useState('');
  const [qlDesc, setQlDesc]     = useState('');
  const [qlCat, setQlCat]       = useState('');
  const [qlError, setQlError]   = useState('');
  const [qlLoading, setQlLoading] = useState(false);

  // ── Numpad State ──
  const [numpadValue, setNumpadValue] = useState('');

  // ── Budget Modal State ──
  const [budgetDraft, setBudgetDraft] = useState({});
  const [newCatName, setNewCatName]   = useState('');
  const [newCatLimit, setNewCatLimit] = useState('');
  const [newCatType, setNewCatType]   = useState('expense');

  // NEW states for dynamic groups, toast, loading, validation
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [budgetToast, setBudgetToast] = useState({ show: false, message: '', type: 'success' });
  const [newCatNameError, setNewCatNameError] = useState('');
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('✨');

  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem('caltdhy_budget_groups');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'essential', title: lang === 'vi' ? 'Sinh hoạt thiết yếu' : 'Essential Living', icon: '🏠' },
      { id: 'personal', title: lang === 'vi' ? 'Cá nhân & Giải trí' : 'Personal & Leisure', icon: '🎉' },
      { id: 'finance', title: lang === 'vi' ? 'Tài chính & Khác' : 'Finance & Others', icon: '💼' }
    ];
  });

  const [groupMapping, setGroupMapping] = useState(() => {
    const saved = localStorage.getItem('caltdhy_category_group_mapping');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      'Food & Dining': 'essential',
      'Transport': 'essential',
      'Utilities': 'essential',
      'Health': 'essential',
      'Shopping': 'personal',
      'Entertainment': 'personal',
      'Installment': 'finance',
      'Other': 'finance'
    };
  });

  const categories = getAllCategories();

  // ── Category Doughnut Chart: STABLE_CHART_COLORS + segmentGlow ──
  const categoryChartData = useMemo(() => {
    const now = new Date();
    const expenseByCat = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' &&
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth();
      })
      .forEach(t => {
        expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount;
      });

    const labels    = Object.keys(expenseByCat);
    const bgColors  = labels.map(l => getCategoryColor(l).bg);
    const glowColors = labels.map(l => getCategoryColor(l).glow);

    const dataset = {
      data: labels.map(l => expenseByCat[l]),
      backgroundColor: bgColors,
      borderColor: theme === 'dark' ? '#1e2124' : '#ffffff',
      borderWidth: 2.5,
      hoverOffset: 8,
      _glowColors: glowColors,   // custom field — consumed by segmentGlowPlugin
    };

    return { labels, datasets: [dataset] };
  }, [transactions, theme]);

  // Sidebar toggle
  const toggleRail = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('railCollapsed', next ? 'false' : 'true');
      return next;
    });
  };

  // ── Submit Add Transaction (full form) ──
  async function handleAddTxn(e) {
    e.preventDefault();
    setFormError('');
    const amountRaw = evalMathExpression(formAmount);
    if (isNaN(amountRaw) || amountRaw <= 0) return setFormError('Số tiền phải lớn hơn 0.');
    if (!formCat) return setFormError('Vui lòng chọn danh mục.');
    setFormLoading(true);
    try {
      await addTransaction({
        amount: Math.round(amountRaw),
        category: formCat,
        type: formType,
        desc: formNote.trim() || formCat,
        date: formDate,
      });
      setFormAmount(''); setFormNote(''); setFormCat('');
      setShowAddTxModal(false);
    } catch (err) {
      setFormError(err.message || 'Không thể lưu giao dịch.');
    } finally {
      setFormLoading(false);
    }
  }

  // ── Quick Log (FAB) Submit ──
  async function handleQuickLog(e) {
    e.preventDefault();
    setQlError('');
    const amountRaw = evalMathExpression(qlAmount);
    if (isNaN(amountRaw) || amountRaw <= 0) return setQlError('⚠ Nhập số tiền hợp lệ (vd: 50000 hoặc 30k+20k).');
    const cat = qlCat || (qlType === 'income' ? 'Salary' : categories.filter(c => getCategoryType(c) === 'expense')[0]);
    setQlLoading(true);
    try {
      await addTransaction({
        amount: Math.round(amountRaw),
        category: cat,
        type: qlType,
        desc: qlDesc.trim() || cat,
        date: new Date().toISOString().slice(0, 10),
      });
      setQlAmount(''); setQlDesc(''); setQlError('');
      setShowQuickLogModal(false);
    } catch (err) {
      setQlError(err.message || 'Lỗi lưu giao dịch.');
    } finally {
      setQlLoading(false);
    }
  }

  // ── Numpad Keys ──
  function numpadKey(key) {
    if (key === 'C') {
      setNumpadValue('');
    } else {
      setNumpadValue(prev => {
        if (prev.length >= 12) return prev;
        const next = prev + key;
        return String(parseInt(next, 10) || 0);
      });
    }
  }

  async function numpadSubmit() {
    const amount = parseInt(numpadValue, 10);
    if (!amount || amount <= 0) return;
    await addTransaction({
      amount,
      category: 'Salary',
      type: 'income',
      desc: 'Nạp tiền',
      date: new Date().toISOString().slice(0, 10),
    });
    setNumpadValue('');
    setShowNumpadModal(false);
  }

  // ── Budget Modal Logic ──
  function openBudgetModal() {
    setBudgetDraft({ ...budgets });
    setNewCatName(''); setNewCatLimit(''); setNewCatType('expense');
    setNewCatNameError('');
    setShowBudgetModal(true);
  }

  const formatNumber = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = String(val).replace(/\D/g, '');
    if (!clean) return '';
    return parseInt(clean, 10).toLocaleString('vi-VN');
  };

  const handleBudgetChange = (cat, rawValue) => {
    const cleanValue = rawValue.replace(/\D/g, '');
    const numValue = cleanValue ? parseInt(cleanValue, 10) : '';
    setBudgetDraft(prev => ({ ...prev, [cat]: numValue }));
  };

  const handleNewCatLimitChange = (val) => {
    const clean = val.replace(/\D/g, '');
    setNewCatLimit(clean ? parseInt(clean, 10) : '');
  };

  const handleNewCatNameChange = (val) => {
    setNewCatName(val);
    if (!val.trim()) {
      setNewCatNameError('');
      return;
    }
    const exists = categories.some(c => c.toLowerCase() === val.trim().toLowerCase());
    if (exists) {
      setNewCatNameError(lang === 'vi' ? 'Danh mục này đã tồn tại!' : 'This category already exists!');
    } else {
      setNewCatNameError('');
    }
  };

  const getGroupTitle = (group) => {
    if (group.id === 'essential') return lang === 'vi' ? 'Sinh hoạt thiết yếu' : 'Essential Living';
    if (group.id === 'personal') return lang === 'vi' ? 'Cá nhân & Giải trí' : 'Personal & Leisure';
    if (group.id === 'finance') return lang === 'vi' ? 'Tài chính & Khác' : 'Finance & Others';
    return group.title;
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const newId = 'group_' + Date.now();
    const newGroup = {
      id: newId,
      title: newGroupName.trim(),
      icon: newGroupIcon || '📁'
    };
    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    localStorage.setItem('caltdhy_budget_groups', JSON.stringify(updatedGroups));
    setNewGroupName('');
    setNewGroupIcon('✨');
    setShowAddGroupForm(false);
    
    setBudgetToast({
      show: true,
      message: lang === 'vi' ? 'Đã thêm nhóm mới thành công!' : 'Added new group successfully!',
      type: 'success'
    });
    setTimeout(() => setBudgetToast(prev => ({ ...prev, show: false })), 2800);
  };

  const handleDeleteGroup = (groupId) => {
    if (groups.length <= 1) {
      setBudgetToast({
        show: true,
        message: lang === 'vi' ? 'Phải có ít nhất một nhóm danh mục!' : 'Must keep at least one group!',
        type: 'error'
      });
      setTimeout(() => setBudgetToast(prev => ({ ...prev, show: false })), 2800);
      return;
    }

    const updatedGroups = groups.filter(g => g.id !== groupId);
    setGroups(updatedGroups);
    localStorage.setItem('caltdhy_budget_groups', JSON.stringify(updatedGroups));

    const fallbackGroupId = updatedGroups[0].id;
    const updatedMapping = { ...groupMapping };
    Object.keys(updatedMapping).forEach(cat => {
      if (updatedMapping[cat] === groupId) {
        updatedMapping[cat] = fallbackGroupId;
      }
    });
    setGroupMapping(updatedMapping);
    localStorage.setItem('caltdhy_category_group_mapping', JSON.stringify(updatedMapping));

    setBudgetToast({
      show: true,
      message: lang === 'vi' ? 'Đã xóa nhóm thành công!' : 'Deleted group successfully!',
      type: 'success'
    });
    setTimeout(() => setBudgetToast(prev => ({ ...prev, show: false })), 2800);
  };

  const handleDragStart = (e, catName) => {
    e.dataTransfer.setData('text/plain', catName);
    e.currentTarget.classList.add('is-dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('is-dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e, groupId) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const catName = e.dataTransfer.getData('text/plain');
    if (catName) {
      setGroupMapping(prev => {
        const updated = { ...prev, [catName]: groupId };
        localStorage.setItem('caltdhy_category_group_mapping', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const groupedCategories = useMemo(() => {
    const res = {};
    groups.forEach(g => {
      res[g.id] = [];
    });

    const fallbackGroupId = groups[0]?.id || 'essential';
    const expenseCategories = categories.filter(c => getCategoryType(c) === 'expense');

    expenseCategories.forEach(cat => {
      const gId = groupMapping[cat] || fallbackGroupId;
      if (res[gId]) {
        res[gId].push(cat);
      } else {
        if (!res[fallbackGroupId]) res[fallbackGroupId] = [];
        res[fallbackGroupId].push(cat);
      }
    });

    return res;
  }, [categories, getCategoryType, groups, groupMapping]);

  async function saveBudgets() {
    setIsSavingBudget(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    const finalBudgets = {};
    categories.filter(c => getCategoryType(c) === 'expense').forEach(cat => {
      const rawVal = budgetDraft[cat] !== undefined ? budgetDraft[cat] : (budgets[cat] || '');
      const cleanVal = String(rawVal).replace(/\D/g, '');
      finalBudgets[cat] = cleanVal ? parseFloat(cleanVal) : 0;
    });

    if (newCatName.trim()) {
      if (newCatNameError) {
        setIsSavingBudget(false);
        return;
      }
      
      const limitVal = String(newCatLimit).replace(/\D/g, '');
      const limit = limitVal ? parseFloat(limitVal) : 0;
      
      const exists = categories.some(c => c.toLowerCase() === newCatName.trim().toLowerCase());
      if (exists) {
        setNewCatNameError(lang === 'vi' ? 'Danh mục đã tồn tại!' : 'Category already exists!');
        setIsSavingBudget(false);
        return;
      }

      addCustomCategory(newCatName.trim(), newCatType);
      finalBudgets[newCatName.trim()] = limit;
      
      const fallbackGroupId = groups[0]?.id || 'essential';
      setGroupMapping(prev => {
        const updated = { ...prev, [newCatName.trim()]: fallbackGroupId };
        localStorage.setItem('caltdhy_category_group_mapping', JSON.stringify(updated));
        return updated;
      });
    }

    saveAllBudgets(finalBudgets);
    setIsSavingBudget(false);
    setShowBudgetModal(false);

    setBudgetToast({
      show: true,
      message: lang === 'vi' ? 'Đã lưu ngân sách thành công!' : 'Saved budgets successfully!',
      type: 'success'
    });
    setTimeout(() => setBudgetToast(prev => ({ ...prev, show: false })), 3000);
  }

  // Backup data
  const exportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ transactions, budgets }));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `caltdhy_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ── Quick Log category options filtered by type ──
  const qlCatOptions = useMemo(() =>
    categories.filter(c => getCategoryType(c) === qlType),
    [categories, qlType]
  );

  return (
    <div className="app-shell" style={{ background: 'var(--chassis)', color: 'var(--txt)' }}>
      <Topbar
        currentView={currentView}
        onSwitchView={setCurrentView}
        onToggleSidebar={toggleRail}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAccount={() => setShowAccount(true)}
        onOpenGuide={() => setShowGuide(true)}
        onOpenWrapup={() => setShowWrapup(true)}
        lang={lang}
      />

      <div className={`app-body${sidebarOpen ? '' : ' rail-collapsed'}`}>
        {/* ─── LEFT RAIL (SIDEBAR) ─── */}
        <aside className="rail" aria-label="Financial overview">
          {/* 1. HERO METRICS DISPLAY */}
          <section className="rail-section" aria-labelledby="metrics-heading">
            <h2 className="section-label" id="metrics-heading">{t('financialOverview', lang)}</h2>
            <div className="metrics-stack">
              {/* Balance card — với nút Quick Deposit nguyên bản */}
              <div className="metric-card metric-card--balance">
                <div className="metric-card__screw mc-screw--tl" aria-hidden="true"></div>
                <div className="metric-card__screw mc-screw--tr" aria-hidden="true"></div>
                <p className="metric-card__label">{t('totalBalance', lang)}</p>
                <p className="metric-card__value metric-card__value--balance">{formatCurrency(balance)}</p>
                <p className="metric-card__sub">{t('allTimeNet', lang)}</p>
                {/* Nút Quick Deposit nguyên bản */}
                <button
                  className="btn-quick-deposit"
                  aria-label="Quick Deposit"
                  aria-haspopup="dialog"
                  onClick={() => { setNumpadValue(''); setShowNumpadModal(true); }}
                >
                  +
                </button>
              </div>

              <div className="metric-card metric-card--income">
                <p className="metric-card__label">{t('monthlyIncome', lang)}</p>
                <p className="metric-card__value metric-card__value--income">+{formatCurrency(income)}</p>
                <p className="metric-card__sub">{t('thisMonth', lang)}</p>
              </div>

              <div className="metric-card metric-card--expense">
                <p className="metric-card__label">{t('monthlyExpense', lang)}</p>
                <p className="metric-card__value metric-card__value--expense">-{formatCurrency(expense)}</p>
                <p className="metric-card__sub">{t('thisMonth', lang)}</p>
              </div>
            </div>
          </section>

          {/* 2. ADD TRANSACTION BUTTON */}
          <section className="rail-section">
            <button className="btn-add-txn" onClick={() => {
              setFormType('expense'); setFormCat('');
              setShowAddTxModal(true);
            }}>
              <span className="btn-add-txn__icon" aria-hidden="true">+</span>
              <span>{t('addTransaction', lang)}</span>
            </button>
          </section>

          {/* 3. CATEGORY BREAKDOWN — Doughnut với Glow Plugin */}
          <section className="rail-section rail-section--grow" aria-labelledby="cat-heading">
            <div className="cat-heading-row">
              <h2 className="section-label" id="cat-heading">{t('categoryBreakdown', lang)}</h2>
            </div>

            <div className="chassis-frame chassis-frame--chart" aria-label="Category breakdown chart">
              <div className="chassis-frame__screw cf-screw--tl" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--tr" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--bl" aria-hidden="true"></div>
              <div className="chassis-frame__screw cf-screw--br" aria-hidden="true"></div>

              <div className="chart-panel">
                {categoryChartData.labels.length === 0 ? (
                  <p className="chart-empty">{t('noExpense', lang)}</p>
                ) : (
                  <>
                    <div className="chart-canvas-wrap">
                      <Doughnut
                        data={categoryChartData}
                        options={{
                          cutout: '72%',
                          plugins: { legend: { display: false } },
                          maintainAspectRatio: false,
                          animation: { duration: 600, easing: 'easeInOutQuart' },
                          resizeDelay: 150,
                        }}
                        plugins={[segmentGlowPlugin]}
                      />
                    </div>
                    <div className="chart-legend" aria-label="Chart legend">
                      {categoryChartData.labels.map((lbl, i) => (
                        <div key={lbl} className="legend-item">
                          <span className="chart-legend-dot" style={{
                            background: categoryChartData.datasets[0].backgroundColor[i],
                            boxShadow: `0 0 6px 2px ${categoryChartData.datasets[0]._glowColors[i]}`,
                          }} />
                          <span className="chart-legend-lbl">{getCatIcon(lbl)} {tCat(lbl, lang)}</span>
                          <span className="chart-legend-val">{formatCurrency(categoryChartData.datasets[0].data[i])}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="main-content" role="main">
          {currentView === 'home'      && <DashboardView txState={txState} formatCurrency={formatCurrency} onOpenBudgetModal={openBudgetModal} lang={lang} />}
          {currentView === 'analytics' && <AnalyticsView txState={txState} formatCurrency={formatCurrency} theme={theme} lang={lang} />}
          {currentView === 'jars'      && <JarsView txState={txState} formatCurrency={formatCurrency} lang={lang} />}
        </main>
      </div>

      {/* ═══════════════════════════════════════════
           FLOATING ACTION BUTTON (FAB) — nguyên bản
         ═══════════════════════════════════════════ */}
      <button
        className="fab"
        id="fab"
        aria-label="Quick log transaction"
        aria-haspopup="dialog"
        onClick={() => { setQlAmount(''); setQlDesc(''); setQlError(''); setQlType('expense'); setShowQuickLogModal(true); }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>

      {/* ═══════════════════════════════════════════
           MODAL: QUICK LOG (FAB) — nguyên bản
         ═══════════════════════════════════════════ */}
      {showQuickLogModal && (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="ql-title"
          onClick={e => { if (e.target === e.currentTarget) setShowQuickLogModal(false); }}>
          <div className="modal-card modal-card--ql">
            <button className="modal-close" onClick={() => setShowQuickLogModal(false)} aria-label="Close quick log">✕</button>
            <div className="modal-card__screw mc--tl" aria-hidden="true"></div>
            <div className="modal-card__screw mc--tr" aria-hidden="true"></div>
            <div className="modal-card__screw mc--bl" aria-hidden="true"></div>
            <div className="modal-card__screw mc--br" aria-hidden="true"></div>

            <h2 className="modal-title" id="ql-title">{t('quickLog', lang)}</h2>

            <div className="modal-vents" aria-hidden="true">
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
            </div>

            {/* Type toggle */}
            <div className="type-row" role="group" aria-label="Transaction type">
              <button
                type="button"
                className={`type-btn type-btn--expense${qlType === 'expense' ? ' type-btn--active-expense' : ''}`}
                onClick={() => { setQlType('expense'); setQlCat(''); }}
              >
                {t('typeExpense', lang)}
              </button>
              <button
                type="button"
                className={`type-btn type-btn--income${qlType === 'income' ? ' type-btn--active-income' : ''}`}
                onClick={() => { setQlType('income'); setQlCat(''); }}
              >
                {t('typeIncome', lang)}
              </button>
            </div>

            <form onSubmit={handleQuickLog}>
              <div className="form-group">
                <label className="form-label" htmlFor="qlAmount">
                  {t('amount', lang)} <span className="ql-curr-hint">({currency})</span>
                </label>
                <input
                  id="qlAmount"
                  className="form-input"
                  type="text"
                  placeholder={t('placeholderAmount', lang)}
                  value={qlAmount}
                  onChange={e => setQlAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="qlDesc">{t('description', lang)}</label>
                <input
                  id="qlDesc"
                  className="form-input"
                  type="text"
                  placeholder={t('placeholderCoffee', lang)}
                  maxLength={80}
                  value={qlDesc}
                  onChange={e => setQlDesc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="qlCat">{t('category', lang)}</label>
                <select
                  id="qlCat"
                  className="form-select"
                  value={qlCat}
                  onChange={e => setQlCat(e.target.value)}
                >
                  <option value="">{lang === 'vi' ? '-- Chọn danh mục --' : '-- Select category --'}</option>
                  {qlCatOptions.map(c => (
                    <option key={c} value={c}>{getCatIcon(c)} {tCat(c, lang)}</option>
                  ))}
                </select>
              </div>

              {qlError && <div className="form-error show">{qlError}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowQuickLogModal(false)}>{t('cancel', lang)}</button>
                <button type="submit" className="btn-save" disabled={qlLoading}>
                  {qlLoading ? (lang === 'vi' ? 'ĐANG LƯU...' : 'SAVING...') : (lang === 'vi' ? 'LƯU' : 'SAVE')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           MODAL: QUICK DEPOSIT NUMPAD — nguyên bản
         ═══════════════════════════════════════════ */}
      {showNumpadModal && (
        <div className="modal-overlay modal-overlay--numpad open" role="dialog" aria-modal="true" aria-labelledby="numpad-title"
          onClick={e => { if (e.target === e.currentTarget) setShowNumpadModal(false); }}>
          <div className="numpad-device">
            <div className="numpad-screw nd-screw--tl" aria-hidden="true"></div>
            <div className="numpad-screw nd-screw--tr" aria-hidden="true"></div>
            <div className="numpad-screw nd-screw--bl" aria-hidden="true"></div>
            <div className="numpad-screw nd-screw--br" aria-hidden="true"></div>

            <div className="numpad-display" aria-live="polite">
              <p className="numpad-display__label">QUICK DEPOSIT</p>
              <p className="numpad-display__value">
                {numpadValue ? parseInt(numpadValue, 10).toLocaleString('vi-VN') : '0'}
              </p>
              <p className="numpad-display__unit">đ</p>
            </div>

            <div className="numpad-vents" aria-hidden="true">
              <div className="numpad-vent"></div>
              <div className="numpad-vent"></div>
              <div className="numpad-vent"></div>
            </div>

            <div className="numpad-grid" role="group" aria-label="Numeric keypad">
              {['7','8','9','4','5','6','1','2','3'].map(k => (
                <button key={k} className="nk" onClick={() => numpadKey(k)} aria-label={k}>{k}</button>
              ))}
              <button className="nk nk--wide" onClick={() => numpadKey('0')} aria-label="0">0</button>
              <button className="nk nk--clear" onClick={() => numpadKey('C')} aria-label="Clear">C</button>
              <button className="nk nk--submit" onClick={numpadSubmit} aria-label="Submit deposit">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           MODAL: SET BUDGETS — Cập nhật tối ưu và Drag & Drop
         ═══════════════════════════════════════════ */}
      {showBudgetModal && (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title"
          onClick={e => { if (e.target === e.currentTarget && !isSavingBudget) setShowBudgetModal(false); }}>
          <div className="modal-card modal-card--budget">
            <button className="modal-close" onClick={() => setShowBudgetModal(false)} disabled={isSavingBudget} aria-label="Close budget settings">✕</button>
            <div className="modal-card__screw mc--tl" aria-hidden="true"></div>
            <div className="modal-card__screw mc--tr" aria-hidden="true"></div>
            <div className="modal-card__screw mc--bl" aria-hidden="true"></div>
            <div className="modal-card__screw mc--br" aria-hidden="true"></div>

            <div className="modal-vents" aria-hidden="true">
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
            </div>

            <h2 className="modal-title" id="budget-modal-title">{t('setBudgets', lang)}</h2>
            <p className="budget-modal__hint">{t('budgetHint', lang)}</p>

            {/* ── Quản lý nhóm ── */}
            <div className="group-manager-panel">
              <div className="group-manager-header">
                <span className="group-manager-title">📁 {lang === 'vi' ? 'Nhóm ngân sách' : 'Budget Groups'}</span>
                <button
                  type="button"
                  className="btn-toggle-add-group"
                  onClick={() => setShowAddGroupForm(!showAddGroupForm)}
                >
                  {showAddGroupForm ? (lang === 'vi' ? 'Đóng' : 'Close') : `➕ ${lang === 'vi' ? 'Thêm nhóm' : 'Add Group'}`}
                </button>
              </div>

              {showAddGroupForm && (
                <div className="add-group-form-row">
                  <input
                    type="text"
                    className="budget-form-input new-group-name-input"
                    placeholder={lang === 'vi' ? 'Tên nhóm mới...' : 'New group name...'}
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                  />
                  <select
                    className="budget-form-input new-group-icon-select"
                    value={newGroupIcon}
                    onChange={e => setNewGroupIcon(e.target.value)}
                  >
                    {['✨', '🏠', '🎉', '💼', '🍕', '🚗', '🛍️', '🏥', '🔌', '📈', '📦'].map(emoji => (
                      <option key={emoji} value={emoji}>{emoji}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-add-group-submit"
                    onClick={handleAddGroup}
                    disabled={!newGroupName.trim()}
                  >
                    {lang === 'vi' ? 'Thêm' : 'Add'}
                  </button>
                </div>
              )}

              <div className="group-badges-list">
                {groups.map(g => (
                  <span key={g.id} className="group-badge-item">
                    {g.icon} {getGroupTitle(g)}
                    {groups.length > 1 && (
                      <button
                        type="button"
                        className="btn-delete-group-badge"
                        onClick={() => handleDeleteGroup(g.id)}
                        title={lang === 'vi' ? 'Xóa nhóm' : 'Delete group'}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Danh mục phân nhóm & Drag & Drop ── */}
            <div className="budget-groups-wrapper">
              {groups.map(group => {
                const catsInGroup = groupedCategories[group.id] || [];
                return (
                  <div
                    key={group.id}
                    className="budget-group-section"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, group.id)}
                  >
                    <h3 className="budget-group-title">
                      <span className="budget-group-title-left">
                        <span className="group-title-icon">{group.icon}</span>
                        <span className="group-title-text">{getGroupTitle(group)}</span>
                      </span>
                      {catsInGroup.length === 0 && (
                        <span className="budget-group-title-empty">
                          {lang === 'vi' ? '(Kéo thả vào đây)' : '(Drag categories here)'}
                        </span>
                      )}
                    </h3>
                    
                    <div className="budget-form-grid">
                      {catsInGroup.map(cat => {
                        const draftVal = budgetDraft[cat] !== undefined ? budgetDraft[cat] : (budgets[cat] || '');
                        return (
                          <div
                            key={cat}
                            className="budget-form-row budget-form-row--draggable"
                            draggable={true}
                            onDragStart={e => handleDragStart(e, cat)}
                            onDragEnd={handleDragEnd}
                          >
                            <label className="budget-form-label" htmlFor={`budget-${cat}`}>
                              <span className="drag-handle" title={lang === 'vi' ? 'Kéo để phân nhóm' : 'Drag to re-group'}>☰</span>
                              {getCatIcon(cat)} {tCat(cat, lang)}
                            </label>
                            <div className="currency-input-wrapper">
                              <input
                                id={`budget-${cat}`}
                                className="budget-form-input"
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={formatNumber(draftVal)}
                                onChange={e => handleBudgetChange(cat, e.target.value)}
                              />
                              <span className="currency-suffix">đ</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Custom Category */}
            <div className="budget-add-cat">
              <h3 className="budget-add-cat__header">
                <span className="icon">➕</span> {t('addCustomCatLabel', lang)}
              </h3>
              
              <div className="budget-add-cat__fields">
                <div className="budget-add-field-group">
                  <label htmlFor="new-cat-name" className="budget-add-field-label">
                    {lang === 'vi' ? 'Tên danh mục mới' : 'New Category Name'}
                  </label>
                  <input
                    id="new-cat-name"
                    className={`budget-form-input budget-add-cat__name ${newCatNameError ? 'is-invalid' : ''}`}
                    type="text"
                    placeholder={t('placeholderCatName', lang)}
                    value={newCatName}
                    onChange={e => handleNewCatNameChange(e.target.value)}
                  />
                  {newCatNameError && <span className="budget-field-error">{newCatNameError}</span>}
                </div>

                <div className="budget-add-field-group">
                  <label htmlFor="new-cat-limit" className="budget-add-field-label">
                    {lang === 'vi' ? 'Hạn mức ban đầu' : 'Initial Limit'}
                  </label>
                  <div className="currency-input-wrapper">
                    <input
                      id="new-cat-limit"
                      className="budget-form-input budget-add-cat__limit"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formatNumber(newCatLimit)}
                      onChange={e => handleNewCatLimitChange(e.target.value)}
                    />
                    <span className="currency-suffix">đ</span>
                  </div>
                </div>

                <div className="budget-add-field-group budget-add-field-group--type">
                  <label className="budget-add-field-label">
                    {lang === 'vi' ? 'Loại danh mục' : 'Category Type'}
                  </label>
                  <div className="budget-add-cat__type-dropdown" role="listbox" aria-label="Category type">
                    <button
                      type="button"
                      className={`budget-type-option budget-type-option--expense${newCatType === 'expense' ? ' selected' : ''}`}
                      onClick={() => setNewCatType('expense')}
                      role="option"
                    >
                      {lang === 'vi' ? 'Chi chi tiêu' : 'Expense'}
                    </button>
                    <button
                      type="button"
                      className={`budget-type-option budget-type-option--income${newCatType === 'income' ? ' selected' : ''}`}
                      onClick={() => setNewCatType('income')}
                      role="option"
                    >
                      {lang === 'vi' ? 'Thu nhập' : 'Income'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions budget-modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowBudgetModal(false)} disabled={isSavingBudget}>
                {t('cancel', lang)}
              </button>
              <button type="button" className="btn-save" onClick={saveBudgets} disabled={isSavingBudget || !!newCatNameError}>
                {isSavingBudget ? (
                  <span className="save-btn-spinner-wrapper">
                    <span className="save-btn-spinner"></span>
                    {lang === 'vi' ? 'ĐANG LƯU...' : 'SAVING...'}
                  </span>
                ) : (
                  lang === 'vi' ? 'LƯU NGÂN SÁCH' : 'SAVE BUDGETS'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           MODAL: ADD TRANSACTION (full form)
         ═══════════════════════════════════════════ */}
      {showAddTxModal && (
        <div className="modal-overlay open" role="dialog" aria-modal="true"
          onClick={e => { if (e.target === e.currentTarget) setShowAddTxModal(false); }}>
          <div className="modal-card">
            <button className="modal-close" onClick={() => setShowAddTxModal(false)}>✕</button>
            <div className="modal-card__screw mc--tl" aria-hidden="true"></div>
            <div className="modal-card__screw mc--tr" aria-hidden="true"></div>
            <div className="modal-card__screw mc--bl" aria-hidden="true"></div>
            <div className="modal-card__screw mc--br" aria-hidden="true"></div>

            <h2 className="modal-title">{t('newTransaction', lang)}</h2>
            <div className="modal-vents" aria-hidden="true">
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
            </div>

            <div className="type-row">
              <button
                type="button"
                className={`type-btn type-btn--expense${formType === 'expense' ? ' type-btn--active-expense' : ''}`}
                onClick={() => { setFormType('expense'); setFormCat(''); }}
              >{t('typeExpense', lang)}</button>
              <button
                type="button"
                className={`type-btn type-btn--income${formType === 'income' ? ' type-btn--active-income' : ''}`}
                onClick={() => { setFormType('income'); setFormCat(''); }}
              >{t('typeIncome', lang)}</button>
            </div>

            <form onSubmit={handleAddTxn}>
              <div className="form-group">
                <label className="form-label" htmlFor="txnDesc">{t('description', lang)}</label>
                <input id="txnDesc" className="form-input" type="text" placeholder={t('placeholderDesc', lang)}
                  value={formNote} onChange={e => setFormNote(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="txnAmount">
                  {t('amount', lang)} ({currency}){lang === 'vi' ? ' — hỗ trợ phép tính (vd: 50000+30000)' : ' — supports calculations (e.g. 50000+30000)'}
                </label>
                <input id="txnAmount" className="form-input" type="text" placeholder={t('placeholderAmount', lang)}
                  value={formAmount} onChange={e => setFormAmount(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="txnCat">{t('category', lang)}</label>
                <select id="txnCat" className="form-select" value={formCat}
                  onChange={e => setFormCat(e.target.value)}>
                  <option value="">{lang === 'vi' ? '-- Chọn Danh Mục --' : '-- Select Category --'}</option>
                  {categories.filter(c => getCategoryType(c) === formType).map(c => (
                    <option key={c} value={c}>{getCatIcon(c)} {tCat(c, lang)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="txnDate">{t('date', lang)}</label>
                <input id="txnDate" className="form-input" type="date"
                  value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>

              {formError && <div className="form-error show">{formError}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddTxModal(false)}>{t('cancel', lang)}</button>
                <button type="submit" className="btn-save" disabled={formLoading}>
                  {formLoading ? (lang === 'vi' ? 'ĐANG LƯU...' : 'SAVING...') : t('saveTransaction', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           MODAL: SETTINGS
         ═══════════════════════════════════════════ */}
      {showSettings && (
        <div className="modal-overlay open" role="dialog" aria-modal="true"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="modal-card modal-card--settings">
            <button className="modal-close" onClick={() => setShowSettings(false)}>✕</button>
            <div className="modal-card__screw mc--tl" aria-hidden="true"></div>
            <div className="modal-card__screw mc--tr" aria-hidden="true"></div>
            <div className="modal-card__screw mc--bl" aria-hidden="true"></div>
            <div className="modal-card__screw mc--br" aria-hidden="true"></div>

            <h2 className="modal-title">{t('settingsTitle', lang)}</h2>
            <div className="modal-vents" aria-hidden="true">
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
              <div className="modal-vent"></div>
            </div>

            <div className="settings-group">
              <p className="settings-group__label">{t('settingsLanguage', lang)}</p>
              <div className="lang-switch">
                {['en', 'vi'].map(l => (
                  <button key={l} className={`lang-btn${lang === l ? ' lang-btn--active' : ''}`}
                    onClick={() => setLang(l)}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div className="settings-group">
              <p className="settings-group__label">{t('settingsAppearance', lang)}</p>
              <div className="theme-grid">
                {[
                  { id: 'dark',  label: lang === 'vi' ? 'Tối' : 'Dark',  bg: 'linear-gradient(135deg,#353b3c,#2d3436)' },
                  { id: 'light', label: lang === 'vi' ? 'Sáng' : 'Light', bg: 'linear-gradient(135deg,#ffffff,#f5f7fa)' },
                  { id: 'cream', label: lang === 'vi' ? 'Kem' : 'Cream', bg: 'linear-gradient(135deg,#fdf8f2,#f5ede0)' },
                  { id: 'green', label: lang === 'vi' ? 'Lá' : 'Green', bg: 'linear-gradient(135deg,#f0f9f4,#e3f2e9)' },
                ].map(t => (
                  <button key={t.id}
                    className={`theme-card${theme === t.id ? ' theme-card--selected' : ''}`}
                    onClick={() => setTheme(t.id)} type="button">
                    <span className="theme-card__swatch" style={{ background: t.bg }}></span>
                    <span className="theme-card__name">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-group">
              <p className="settings-group__label">{t('settingsCurrency', lang)}</p>
              <div className="lang-switch">
                {['VND', 'USD', 'CNY'].map(c => (
                  <button key={c} className={`lang-btn${currency === c ? ' lang-btn--active' : ''}`}
                    onClick={() => setCurrency(c)}>{c}</button>
                ))}
              </div>
            </div>

            {/* Set Budgets shortcut */}
            <div className="settings-group">
              <p className="settings-group__label">{lang === 'vi' ? 'Ngân sách' : 'Budget'}</p>
              <button className="btn-set-budgets btn-set-budgets--full" type="button"
                onClick={() => { setShowSettings(false); openBudgetModal(); }}>
                {t('setBudgets', lang)}
              </button>
            </div>

            <div className="settings-group settings-group--last">
              <p className="settings-group__label">{t('settingsBackup', lang)}</p>
              <div className="settings-backup-row">
                <button className="btn-set-budgets btn-backup" onClick={exportData}>{t('exportJson', lang)}</button>
              </div>
            </div>

            <div className="modal-actions settings-modal-actions">
              <button className="btn-save" onClick={() => setShowSettings(false)}>{t('done', lang)}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           MODALS: ACCOUNT, GUIDE, WRAPUP
         ═══════════════════════════════════════════ */}
      <AccountModal
        isOpen={showAccount}
        onClose={() => setShowAccount(false)}
        user={user}
        updateUser={updateUser}
      />

      <GuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />

      <WrapupModal
        isOpen={showWrapup}
        onClose={() => setShowWrapup(false)}
        transactions={transactions}
        formatCurrency={formatCurrency}
      />

      {/* Toast Notification */}
      {budgetToast.show && (
        <div className={`toast-notification ${budgetToast.type} show`} role="alert">
          <span className="toast-icon">
            {budgetToast.type === 'success' ? '✅' : '⚠️'}
          </span>
          <span className="toast-message">{budgetToast.message}</span>
        </div>
      )}
    </div>
  );
}
