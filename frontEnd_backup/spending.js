/* ============================================================
   CaltDHy — spending.js
   Expense Management Logic
   ============================================================ */

'use strict';

/* ── Constants ── */
const STORAGE_KEY = 'caltdhy_txns';
const BUDGET_KEY = 'caltdhy_budgets';
const CUSTOM_CATS_KEY = 'caltdhy_custom_cats';
const THEME_KEY = 'caltdhy_theme';
const EXCHANGE_RATE = 27000;  // 1 USD = 27,000 VND
const CNY_RATE = 3750;   // 1 CNY = 3,750 VND
const CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Health', 'Utilities', 'Salary', 'Freelance', 'Other'
];
const CAT_ICONS = {
  'Food & Dining': '🍜', 'Transport': '🚗', 'Shopping': '🛗️',
  'Entertainment': '🎦', 'Health': '💊', 'Utilities': '⚡',
  'Salary': '💵', 'Freelance': '💻', 'Other': '📦'
};

/* ── State ── */
let transactions = [];
let budgets = {};   // { 'Food & Dining': 2000000, ... } — limits in VND
let customCategories = []; // extra user-defined category names
let currentFilter = 'all';
let currentType = 'expense';
let currentCurrency = 'VND'; // 'VND' | 'USD' | 'CNY'
let toastTimer = null;

/** Returns default + custom categories merged */
function getAllCategories() {
  const all = [...CATEGORIES];
  customCategories.forEach(c => { if (!all.includes(c)) all.push(c); });
  return all;
}

/* ============================================================
   PERSISTENCE
   ============================================================ */
let isServerConnected = false;

async function syncLoadFromServer() {
  try {
    const res = await fetch('/api/load');
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    if (data) {
      isServerConnected = true;
      if (Array.isArray(data.transactions)) {
        transactions = data.transactions;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      }
      if (data.budgets && typeof data.budgets === 'object') {
        budgets = data.budgets;
        localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
      }
      if (Array.isArray(data.customCategories)) {
        customCategories = data.customCategories;
        localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(customCategories));
      }
      console.log('🔌 Connected to local MacBook server. Data loaded from caltdhy_db.json!');
      
      // Trigger full UI redraw with new database state
      calcMetrics();
      renderFeed();
      renderBudgetPanel();
      updateChart();
    }
  } catch (e) {
    console.log('📴 Operating in Offline Mode (using browser localStorage).');
  }
}

async function syncSaveToServer() {
  if (!isServerConnected) {
    try {
      const ping = await fetch('/api/load');
      if (ping.ok) isServerConnected = true;
    } catch(e) {
      return;
    }
  }
  
  if (isServerConnected) {
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          budgets,
          customCategories
        })
      });
      console.log('💾 Automatically backed up to caltdhy_db.json on MacBook!');
    } catch (e) {
      console.warn('⚠️ Backup write failed, offline fallback active.');
    }
  }
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : seedData();
  } catch (e) {
    transactions = seedData();
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    syncSaveToServer();
  } catch (e) {
    showToast('⚠ Storage full — data not saved.');
  }
}

function loadBudgets() {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    budgets = raw ? JSON.parse(raw) : {};
  } catch (e) {
    budgets = {};
  }
}

function saveBudgets() {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
    syncSaveToServer();
  } catch (e) {
    showToast('⚠ Storage full.');
  }
}

function loadCustomCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATS_KEY);
    customCategories = raw ? JSON.parse(raw) : [];
  } catch (e) {
    customCategories = [];
  }
}

function saveCustomCategories() {
  try {
    localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(customCategories));
    syncSaveToServer();
  } catch (e) { }
}

/* ============================================================
   EXPORT / IMPORT BACKUPS
   ============================================================ */
function exportData() {
  try {
    const backupObj = {
      transactions: transactions,
      budgets: budgets,
      customCategories: customCategories,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };
    const dataStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `caltdhy_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✓ Backup downloaded!');
  } catch (e) {
    showToast('⚠ Failed to export backup.');
  }
}

function triggerImport() {
  const fileInput = document.getElementById('importFileInput');
  if (fileInput) {
    fileInput.click();
  }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || (!data.transactions && !data.budgets && !data.customCategories)) {
        showToast(t('backupError'));
        return;
      }

      if (Array.isArray(data.transactions)) {
        transactions = data.transactions;
        saveTransactions();
      }
      if (data.budgets && typeof data.budgets === 'object') {
        budgets = data.budgets;
        saveBudgets();
      }
      if (Array.isArray(data.customCategories)) {
        customCategories = data.customCategories;
        saveCustomCategories();
      }

      showToast(t('backupSuccess'));
      
      calcMetrics();
      renderFeed();
      renderBudgetPanel();
      if (_categoryChart) {
        _categoryChart.destroy();
        _categoryChart = null;
      }
      event.target.value = '';
      closeSettings();
    } catch (err) {
      showToast(t('backupError'));
    }
  };
  reader.readAsText(file);
}

function seedData() {
  const ago = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };
  return [
    { id: uid(), type: 'income', desc: 'Monthly Salary', amount: 12000000, category: 'Salary', date: ago(3) },
    { id: uid(), type: 'expense', desc: 'Grocery Store', amount: 250000, category: 'Food & Dining', date: ago(2) },
    { id: uid(), type: 'expense', desc: 'Grab Ride', amount: 45000, category: 'Transport', date: ago(2) },
    { id: uid(), type: 'expense', desc: 'Netflix Subscription', amount: 260000, category: 'Entertainment', date: ago(5) },
    { id: uid(), type: 'expense', desc: 'Electricity Bill', amount: 650000, category: 'Utilities', date: ago(7) },
    { id: uid(), type: 'income', desc: 'Freelance Project', amount: 5000000, category: 'Freelance', date: ago(10) },
    { id: uid(), type: 'expense', desc: 'Pharmacy', amount: 180000, category: 'Health', date: ago(12) },
    { id: uid(), type: 'expense', desc: 'Online Shopping', amount: 890000, category: 'Shopping', date: ago(14) },
  ];
}

/* ============================================================
   UTILITIES
   ============================================================ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Safe math evaluator supporting standard operators and custom cleaners */
function evalMathExpression(str) {
  if (!str) return NaN;
  let sanitized = str.replace(/\s+/g, '')
                     .replace(/x/gi, '*')
                     .replace(/:/g, '/');
  
  // Strip thousands separators (dots or commas followed by exactly three digits)
  if (!/^[0-9.+\-*/()]+$/.test(sanitized)) {
    sanitized = sanitized.replace(/([.,])(?=\d{3}(?!\d))/g, '');
  }
  
  if (!/^[0-9.+\-*/()]+$/.test(sanitized)) return NaN;
  
  try {
    const fn = new Function(`return (${sanitized});`);
    const val = fn();
    return typeof val === 'number' && isFinite(val) ? val : NaN;
  } catch (e) {
    return NaN;
  }
}

function fmt(n) {
  if (currentCurrency === 'USD') {
    const usd = n / EXCHANGE_RATE;
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(usd);
  }
  if (currentCurrency === 'CNY') {
    const cny = n / CNY_RATE;
    return '¥' + new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(cny);
  }
  /* Default: Vietnamese Dong, no decimals */
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0
  }).format(Math.round(n));
}

function fmtDate(iso) {
  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';
  return new Date(iso + 'T00:00:00').toLocaleDateString(locale, {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

/* ============================================================
   METRICS
   ============================================================ */
function calcMetrics() {
  const { month, year } = currentMonthYear();
  let balance = 0, income = 0, expense = 0;

  transactions.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const inThisMonth = d.getMonth() === month && d.getFullYear() === year;
    if (t.type === 'income') {
      balance += t.amount;
      if (inThisMonth) income += t.amount;
    } else {
      balance -= t.amount;
      if (inThisMonth) expense += t.amount;
    }
  });

  document.getElementById('metricBalance').textContent = fmt(balance);
  document.getElementById('metricIncome').textContent = '+' + fmt(income);
  document.getElementById('metricExpense').textContent = '-' + fmt(expense);

  const now = new Date();
  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';
  const monthName = now.toLocaleString(locale, { month: 'short' }).toUpperCase();
  const el = document.getElementById('metricMonthLabel');
  if (el) el.textContent = monthName + ' ' + now.getFullYear();
}

/* ============================================================
   BUDGET ENGINE
   ============================================================ */

/**
 * Returns { category: totalSpent } for the CURRENT month only.
 * Only expense-type transactions are counted.
 */
function calcCategorySpend() {
  const { month, year } = currentMonthYear();
  const spent = {};
  transactions.forEach(txn => {
    if (txn.type !== 'expense') return;
    const d = new Date(txn.date + 'T00:00:00');
    if (d.getMonth() !== month || d.getFullYear() !== year) return;
    spent[txn.category] = (spent[txn.category] || 0) + txn.amount;
  });
  return spent;
}

/**
 * Renders the Budget Envelope panel in #budgetPanel.
 * Only shows categories that have a budget limit set.
 */
function renderBudgetPanel() {
  const panel = document.getElementById('budgetPanel');
  if (!panel) return;

  const activeCats = getAllCategories().filter(c => budgets[c] && budgets[c] > 0);

  if (activeCats.length === 0) {
    panel.innerHTML = `
      <div class="budget-empty">
        <span style="opacity:.35;font-size:22px">📊</span>
        <span data-i18n="budgetEmpty">${t('budgetEmpty')}</span>
      </div>`;
    return;
  }

  const spent = calcCategorySpend();

  panel.innerHTML = activeCats.map(cat => {
    const limit = budgets[cat];           // in VND
    const spentAmt = spent[cat] || 0;        // in VND
    const remaining = limit - spentAmt;       // can be negative
    const pct = Math.min((spentAmt / limit) * 100, 100);
    const overBudget = remaining < 0;
    const nearLimit = !overBudget && (spentAmt / limit) >= 0.8; // >= 80% used

    /* Status class drives LED color */
    const statusCls = overBudget ? 'budget-card--over'
      : nearLimit ? 'budget-card--warn'
        : 'budget-card--ok';

    const barCls = overBudget ? 'budget-bar__fill--over'
      : nearLimit ? 'budget-bar__fill--warn'
        : 'budget-bar__fill--ok';

    const remainLabel = overBudget
      ? `⚠ ${fmt(Math.abs(remaining))} over`
      : `${fmt(remaining)} left`;

    return `
      <div class="budget-card ${statusCls}">
        <div class="budget-card__header">
          <span class="budget-card__icon">${CAT_ICONS[cat] || '\u2713'}</span>
          <span class="budget-card__name">${escHtml(tCat(cat))}</span>
          <span class="budget-card__led" aria-hidden="true"></span>
        </div>
        <div class="budget-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
          <div class="budget-bar__fill ${barCls}" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <div class="budget-card__footer">
          <span class="budget-card__remaining ${overBudget ? 'over' : ''}"
          >${remainLabel}</span>
          <span class="budget-card__limit">/ ${fmt(limit)}</span>
        </div>
      </div>`;
  }).join('');
}

const CHART_COLORS = [
  { bg: '#ff4757', glow: 'rgba(255,71,87,.75)' },  // Accent Red / Safety Orange
  { bg: '#3498db', glow: 'rgba(52,152,219,.75)' },  // Cyber Blue
  { bg: '#2ecc71', glow: 'rgba(46,204,113,.75)' },  // Acid Green
  { bg: '#f1c40f', glow: 'rgba(241,196,15,.75)' },  // Neon Yellow
  { bg: '#9b59b6', glow: 'rgba(155,89,182,.75)' },  // Violet
  { bg: '#00e676', glow: 'rgba(0,230,118,.75)' },  // LED Green
  { bg: '#ff6b81', glow: 'rgba(255,107,129,.75)' },  // Hot Pink
  { bg: '#1abc9c', glow: 'rgba(26,188,156,.75)' },  // Teal
  { bg: '#e67e22', glow: 'rgba(230,126,34,.75)' },  // Amber
];

let _categoryChart = null;

function updateChart() {
  try {
    const canvas = document.getElementById('categoryChart');
    const legendEl = document.getElementById('chartLegend');
    const emptyEl = document.getElementById('chartEmpty');
    if (!canvas) return;

    /* Aggregate expenses by category (current month only) */
    const { month, year } = currentMonthYear();
    const totals = {};
    transactions.forEach(txn => {
      if (txn.type !== 'expense') return;
      const d = new Date(txn.date + 'T00:00:00');
      if (d.getMonth() !== month || d.getFullYear() !== year) return;
      totals[txn.category] = (totals[txn.category] || 0) + txn.amount;
    });

    /* Build localised labels from raw category keys */
    const rawKeys = Object.keys(totals);
    const labels = rawKeys.map(k => tCat(k));
    const data = Object.values(totals);
    const total = data.reduce((s, v) => s + v, 0);

    /* Empty state */
    const isEmpty = labels.length === 0;
    if (emptyEl) emptyEl.style.display = isEmpty ? 'block' : 'none';
    if (legendEl) legendEl.style.display = isEmpty ? 'none' : 'flex';
    canvas.style.display = isEmpty ? 'none' : 'block';

    if (isEmpty) {
      if (_categoryChart) { _categoryChart.destroy(); _categoryChart = null; }
      return;
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js is not loaded yet or failed to fetch from CDN.');
      return;
    }

    /* Build color arrays */
    const bgColors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length].bg);
    const glowColors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length].glow);

    /* Custom glow plugin */
    const glowPlugin = {
      id: 'segmentGlow',
      beforeDatasetDraw(chart) {
        const ctx = chart.ctx;
        ctx.save();
        chart.data.datasets[0].backgroundColor.forEach((color, i) => {
          const meta = chart.getDatasetMeta(0);
          const arc = meta.data[i];
          if (!arc) return;
          ctx.shadowColor = glowColors[i];
          ctx.shadowBlur = 18;
          arc.draw(ctx);
        });
        ctx.restore();
      }
    };

    if (_categoryChart) {
      /* Update in-place for smooth transitions */
      _categoryChart.data.labels = labels;
      _categoryChart.data.datasets[0].data = data;
      _categoryChart.data.datasets[0].backgroundColor = bgColors;
      _categoryChart.update('active');
    } else {
      _categoryChart = new Chart(canvas, {
        type: 'doughnut',
        plugins: [glowPlugin],
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: bgColors,
            borderColor: '#1e2124',
            borderWidth: 3,
            hoverOffset: 8,
          }]
        },
        options: {
          cutout: '70%',
          animation: { duration: 600, easing: 'easeInOutQuart' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#252a2b',
              titleColor: '#e0e5ec',
              bodyColor: '#8896a8',
              borderColor: 'rgba(255,255,255,.08)',
              borderWidth: 1,
              padding: 10,
              titleFont: { family: "'JetBrains Mono', monospace", size: 11, weight: '700' },
              bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
              callbacks: {
                label(ctx) {
                  const pct = ((ctx.parsed / total) * 100).toFixed(1);
                  return ` ${fmt(ctx.parsed)}  (${pct}%)`;
                }
              }
            }
          },
          layout: { padding: 6 },
        }
      });
    }

    /* Render custom HTML legend */
    legendEl.innerHTML = labels.map((lbl, i) => {
      const pct = ((data[i] / total) * 100).toFixed(0);
      return `
        <div class="chart-legend-item">
          <span class="chart-legend-dot" style="background:${bgColors[i]};box-shadow:0 0 6px 2px ${glowColors[i]}"></span>
          <span class="chart-legend-lbl">${escHtml(lbl)}</span>
          <span class="chart-legend-pct">${pct}%</span>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Error updating chart safely:', err);
  }
}

/* ============================================================
   TRANSACTION FEED
   ============================================================ */
function renderFeed() {
  const feed = document.getElementById('txnFeed');
  if (!feed) return;

  let list = [...transactions].reverse(); // newest first

  if (currentFilter !== 'all') {
    list = list.filter(t => t.type === currentFilter);
  }

  if (list.length === 0) {
    feed.innerHTML = `
      <div class="txn-empty">
        ${t('noTxn')}<br>
        ${t('pressAdd')}
      </div>`;
    return;
  }

  feed.innerHTML = list.map(txn => `
    <div class="txn-slot" data-id="${txn.id}">
      <div class="txn-icon">${CAT_ICONS[txn.category] || '📦'}</div>
      <div class="txn-info">
        <div class="txn-name">${escHtml(txn.desc)}</div>
        <div class="txn-meta">${escHtml(tCat(txn.category)).toUpperCase()} &middot; ${fmtDate(txn.date)}</div>
      </div>
      <div class="txn-amount ${txn.type === 'expense' ? 'neg' : 'pos'}">
        ${txn.type === 'expense' ? '−' : '+'}${fmt(txn.amount)}
      </div>
      <button class="txn-delete" onclick="deleteTransaction('${txn.id}')" title="Delete" aria-label="Delete transaction">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Filter ── */
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
  btn.classList.add('filter-btn--active');
  renderFeed();
}

/* ============================================================
   UNDO DELETE
   ============================================================ */
let _deletedTxn = null;
let _deletedCustomCat = null;
let _deletedCustomCatBudget = null;
let _undoTimer = null;
const UNDO_DELAY = 5000; // ms before permanent deletion

function deleteTransaction(id) {
  const idx = transactions.findIndex(txn => txn.id === id);
  if (idx === -1) return;

  /* Soft-remove: hold in temp variable */
  _deletedTxn = transactions[idx];
  transactions.splice(idx, 1);
  saveTransactions();
  calcMetrics();
  renderFeed();
  renderBudgetPanel();
  updateChart();

  /* Show undo toast with dynamic closure */
  showUndoToast(t('deleteToast'), () => {
    if (!_deletedTxn) return;
    transactions.push(_deletedTxn);
    transactions.sort((a, b) => b.date.localeCompare(a.date));
    _deletedTxn = null;
    saveTransactions();
    calcMetrics();
    renderFeed();
    renderBudgetPanel();
    updateChart();
    showToast('↩ ' + t('undoSuccess'));
  });

  /* Start permanent-deletion timer */
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => {
    _deletedTxn = null;
    hideUndoToast();
  }, UNDO_DELAY);
}

function undoDelete() {
  if (!_deletedTxn) return;
  clearTimeout(_undoTimer);
  /* Re-insert at original position (restore by date order: push, then let render sort) */
  transactions.push(_deletedTxn);
  /* Stable sort by date descending so feed stays ordered */
  transactions.sort((a, b) => b.date.localeCompare(a.date));
  _deletedTxn = null;
  saveTransactions();
  calcMetrics();
  renderFeed();
  renderBudgetPanel();
  updateChart();
  hideUndoToast();
  showToast('↩ ' + t('undoSuccess'));
}

function deleteCustomCategory(name) {
  const idx = customCategories.indexOf(name);
  if (idx === -1) return;

  // Soft-remove: hold in temp variables
  _deletedCustomCat = name;
  _deletedCustomCatBudget = budgets[name] !== undefined ? budgets[name] : null;

  // Remove from customCategories
  customCategories.splice(idx, 1);
  saveCustomCategories();

  // Remove from budgets
  if (budgets[name] !== undefined) {
    delete budgets[name];
    saveBudgets();
  }

  // Refresh
  openBudgetModal();
  renderBudgetPanel();
  updateChart();

  // Show undo toast
  showUndoToast(t('categoryDeleted'), () => {
    if (!_deletedCustomCat) return;
    
    // Restore custom category
    if (!customCategories.includes(_deletedCustomCat)) {
      customCategories.push(_deletedCustomCat);
      saveCustomCategories();
    }
    
    // Restore budget
    if (_deletedCustomCatBudget !== null) {
      budgets[_deletedCustomCat] = _deletedCustomCatBudget;
      saveBudgets();
    }
    
    _deletedCustomCat = null;
    _deletedCustomCatBudget = null;

    openBudgetModal();
    renderBudgetPanel();
    updateChart();
    showToast('↩ ' + t('categoryRestored'));
  });

  // Start permanent-deletion timer
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => {
    _deletedCustomCat = null;
    _deletedCustomCatBudget = null;
    hideUndoToast();
  }, UNDO_DELAY);
}

function showUndoToast(labelText, undoFn) {
  const el = document.getElementById('undoToast');
  if (!el) return;
  const lbl = el.querySelector('.undo-toast__label');
  if (lbl) lbl.textContent = labelText;
  const btn = el.querySelector('.undo-toast__btn');
  if (btn) {
    btn.textContent = t('undo');
    btn.onclick = () => {
      if (typeof undoFn === 'function') undoFn();
      hideUndoToast();
    };
  }
  el.classList.add('show');
}

function hideUndoToast() {
  const el = document.getElementById('undoToast');
  if (el) el.classList.remove('show');
}

/* ============================================================
   MODAL
   ============================================================ */
function openModal() {
  currentType = 'expense';
  syncTypeButtons();
  document.getElementById('txnDesc').value = '';
  document.getElementById('txnAmount').value = '';
  document.getElementById('txnDate').value = todayISO();
  hideFormError();
  /* Rebuild category options dynamically (includes custom cats) */
  const catSel = document.getElementById('txnCat');
  if (catSel) {
    catSel.innerHTML = getAllCategories().map(c =>
      `<option value="${escHtml(c)}">${escHtml(tCat(c))}</option>`
    ).join('');
  }
  document.getElementById('modal').classList.add('open');
  document.getElementById('txnDesc').focus();
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

/* ── Type toggle ── */
function setType(type) {
  currentType = type;
  syncTypeButtons();
}

function syncTypeButtons() {
  const btnE = document.getElementById('typeExpense');
  const btnI = document.getElementById('typeIncome');
  btnE.className = 'type-btn type-btn--expense' + (currentType === 'expense' ? ' type-btn--active-expense' : '');
  btnI.className = 'type-btn type-btn--income' + (currentType === 'income' ? ' type-btn--active-income' : '');
}

/* ── Save ── */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('txnForm');
  if (form) form.addEventListener('submit', handleSave);
});

function handleSave(e) {
  e.preventDefault();
  hideFormError();

  const desc = document.getElementById('txnDesc').value.trim();
  const amtVal = document.getElementById('txnAmount').value.trim();
  const amount = evalMathExpression(amtVal);
  const cat = document.getElementById('txnCat').value;
  const date = document.getElementById('txnDate').value;

  if (isNaN(amount) || amount <= 0) { 
    showFormError(t('enterValidAmount')); 
    return; 
  }
  if (!date) { showFormError(t('dateRequired')); return; }

  const finalDesc = desc || tCat(cat);

  const txn = { id: uid(), type: currentType, desc: finalDesc, amount, category: cat, date };
  transactions.push(txn);
  saveTransactions();
  closeModal();
  calcMetrics();
  renderFeed();
  renderBudgetPanel();
  updateChart();
  showToast(currentType === 'expense' ? t('expenseLogged') : t('incomeRecorded'));
}

/* ── Form error helpers ── */
function showFormError(msg) {
  const el = document.getElementById('formError');
  if (!el) return;
  el.textContent = '⚠ ' + msg;
  el.classList.add('visible');
}
function hideFormError() {
  const el = document.getElementById('formError');
  if (el) el.classList.remove('visible');
}

/* ============================================================
   QUICK LOG — FAB MODAL
   ============================================================ */
let _qlType = 'expense';

function openQuickLog() {
  _qlType = 'expense';
  syncQlTypeButtons();
  const amtInput = document.getElementById('qlAmount');
  const descInput = document.getElementById('qlDesc');
  if (amtInput) amtInput.value = '';
  if (descInput) descInput.value = '';
  /* Rebuild category select dynamically */
  const catSel = document.getElementById('qlCat');
  if (catSel) {
    catSel.innerHTML = getAllCategories().map(c =>
      `<option value="${escHtml(c)}">${escHtml(tCat(c))}</option>`
    ).join('');
  }
  /* Show currency hint */
  const currHints = { VND: '(VND)', USD: '(USD)', CNY: '(¥CNY)' };
  const hint = document.getElementById('qlCurrHint');
  if (hint) hint.textContent = currHints[currentCurrency] || '(VND)';
  const errEl = document.getElementById('qlError');
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }
  document.getElementById('quickLogModal').classList.add('open');
  if (amtInput) amtInput.focus();
}

function closeQuickLog() {
  document.getElementById('quickLogModal').classList.remove('open');
}

function closeQuickLogOnOverlay(e) {
  if (e.target === document.getElementById('quickLogModal')) closeQuickLog();
}

function setQlType(type) {
  _qlType = type;
  syncQlTypeButtons();
}

function syncQlTypeButtons() {
  const btnE = document.getElementById('qlTypeExpense');
  const btnI = document.getElementById('qlTypeIncome');
  if (btnE) btnE.className = 'type-btn type-btn--expense' + (_qlType === 'expense' ? ' type-btn--active-expense' : '');
  if (btnI) btnI.className = 'type-btn type-btn--income' + (_qlType === 'income' ? ' type-btn--active-income' : '');
}

function handleQuickLog(e) {
  if (e) e.preventDefault();

  const amtInput = document.getElementById('qlAmount').value.trim();
  const amtRaw = evalMathExpression(amtInput);
  const desc = document.getElementById('qlDesc').value.trim();
  const cat = document.getElementById('qlCat').value;

  const errEl = document.getElementById('qlError');
  function showQlErr(msg) {
    if (errEl) { errEl.textContent = '⚠ ' + msg; errEl.classList.add('visible'); }
  }

  if (isNaN(amtRaw) || amtRaw <= 0) { 
    showQlErr(t('enterValidAmount')); 
    return; 
  }

  /* Convert display-currency input back to VND for storage */
  const amountVND = currentCurrency === 'USD'
    ? Math.round(amtRaw * EXCHANGE_RATE)
    : currentCurrency === 'CNY'
      ? Math.round(amtRaw * CNY_RATE)
      : Math.round(amtRaw);

  const finalDesc = desc || tCat(cat);

  const txn = { id: uid(), type: _qlType, desc: finalDesc, amount: amountVND, category: cat, date: todayISO() };
  transactions.push(txn);
  saveTransactions();
  closeQuickLog();
  calcMetrics();
  renderFeed();
  renderBudgetPanel();
  updateChart();
  showToast(_qlType === 'expense' ? t('expenseLogged') : t('incomeRecorded'));
}
let _numpadValue = '';

function openNumpad() {
  _numpadValue = '';
  document.getElementById('numpadDisplay').textContent = '0';
  document.getElementById('numpadModal').classList.add('open');
}

function closeNumpad() {
  document.getElementById('numpadModal').classList.remove('open');
}

function closeNumpadOnOverlay(e) {
  if (e.target === document.getElementById('numpadModal')) closeNumpad();
}

function numpadKey(key) {
  if (key === 'C') {
    _numpadValue = '';
  } else {
    if (_numpadValue.length >= 12) return; // max 12 digits
    _numpadValue += key;
    // strip leading zeros
    _numpadValue = String(parseInt(_numpadValue, 10) || 0);
  }
  document.getElementById('numpadDisplay').textContent =
    _numpadValue ? parseInt(_numpadValue, 10).toLocaleString('vi-VN') : '0';
}

function numpadSubmit() {
  const amount = parseInt(_numpadValue, 10);
  if (!amount || amount <= 0) { showToast('⚠ Nhập số tiền hợp lệ.'); return; }
  const txn = {
    id: uid(), type: 'income',
    desc: t('deposit'),
    amount,
    category: 'Salary',
    date: todayISO()
  };
  transactions.push(txn);
  saveTransactions();
  closeNumpad();
  calcMetrics();
  renderFeed();
  updateChart();
  showToast('✓ ' + t('depositAdded') + ' ' + fmt(amount));
}

/* ============================================================
   SETTINGS & LOCALIZATION
   ============================================================ */
const LANG_KEY = 'caltdhy_lang';
const CURR_KEY = 'caltdhy_curr';
let currentLang = 'en';

const I18N = {
  en: {
    financialOverview: 'Financial Overview',
    totalBalance: 'Total Balance',
    allTimeNet: 'All-time net',
    monthlyIncome: 'Monthly Income',
    monthlyExpense: 'Monthly Expense',
    thisMonth: 'This month',
    addTransaction: 'ADD TRANSACTION',
    categoryBreakdown: 'Category Breakdown',
    transactionFeed: 'Transaction Feed',
    filterAll: 'ALL',
    filterIncome: 'INCOME',
    filterExpense: 'EXPENSE',
    newTransaction: 'New Transaction',
    typeExpense: 'EXPENSE',
    typeIncome: 'INCOME',
    description: 'Description',
    amountVND: 'Amount (VND)',
    category: 'Category',
    date: 'Date',
    cancel: 'CANCEL',
    saveTransaction: 'SAVE TRANSACTION',
    logOut: 'LOG OUT',
    settings: 'Settings',
    language: 'Language',
    currency: 'Currency',
    done: 'DONE',
    quickDeposit: 'QUICK DEPOSIT',
    deposit: 'Quick Deposit',
    depositAdded: 'Deposited',
    noTxn: '// NO TRANSACTIONS FOUND',
    pressAdd: 'Press ADD TRANSACTION to begin.',
    noExpense: '// NO EXPENSE DATA',
    /* ── Category names ── */
    'Food & Dining': 'Food & Dining',
    'Transport': 'Transport',
    'Shopping': 'Shopping',
    'Entertainment': 'Entertainment',
    'Health': 'Health',
    'Utilities': 'Utilities',
    'Salary': 'Salary',
    'Freelance': 'Freelance',
    'Other': 'Other',
    /* ── Feed vocab ── */
    deleteToast: 'Transaction removed.',
    expenseLogged: '✓ Expense logged.',
    incomeRecorded: '✓ Income recorded.',
    undo: 'UNDO',
    undoSuccess: 'Transaction restored.',
    enterValidAmount: 'Enter a valid amount (e.g. 50000 or 5000+20000).',
    categoryDeleted: 'Category deleted.',
    categoryRestored: 'Category restored.',
    currencyToggle: 'Display Currency',
    quickLog: 'Quick Log',
    budgetPanel: 'Envelope Budgets',
    setBudgets: 'SET BUDGETS',
    budgetSaved: 'Budgets saved.',
    budgetEmpty: 'No budgets set. Click SET BUDGETS.',
    budgetLimit: 'Limit',
    categoryAdded: 'added.',
    addCustomCat: 'Add Category',
    cnyLabel: 'CNY ¥',
    backupRestore: 'Backup & Restore',
    exportBackup: 'Export Backup (JSON)',
    importBackup: 'Import Backup',
    backupSuccess: '✓ Backup restored successfully!',
    backupError: '⚠ Invalid backup file.',
    appearance: 'Appearance',
    darkTheme: 'Dark',
    lightTheme: 'Light',
    creamTheme: 'Cream',
    skyTheme: 'Sky',
    budgetHint: 'Enter monthly limits per category. Leave blank to disable.',
    addCustomCatLabel: '+ Add Custom Category',
    placeholderCatName: 'Category name',
    placeholderCatLimit: 'Limit (0 = track only)',
    addBtn: 'ADD',
    amount: 'Amount',
    placeholderDesc: 'e.g. Grocery run...',
    placeholderAmount: 'e.g. 50000 or 5000+20000',
    placeholderCoffee: 'e.g. Coffee...',
    syncActive: 'SYNC ACTIVE',
    dateRequired: 'Date is required.',
  },
  vi: {
    financialOverview: 'Tổng Quan Tài Chính',
    totalBalance: 'Tổng Số Dư',
    allTimeNet: 'Lũy kế tất cả',
    monthlyIncome: 'Thu Nhập Tháng',
    monthlyExpense: 'Chi Tiêu Tháng',
    thisMonth: 'Tháng này',
    addTransaction: 'THÊM GIAO DỊCH',
    categoryBreakdown: 'Phân Loại Chi Tiêu',
    transactionFeed: 'Lịch Sử Giao Dịch',
    filterAll: 'TẤT CẢ',
    filterIncome: 'THU NHẬP',
    filterExpense: 'CHI TIÊU',
    newTransaction: 'Giao Dịch Mới',
    typeExpense: 'CHI TIÊU',
    typeIncome: 'THU NHẬP',
    description: 'Mô Tả',
    amountVND: 'Số Tiền (VND)',
    category: 'Danh Mục',
    date: 'Ngày',
    cancel: 'HỦY',
    saveTransaction: 'LƯU GIAO DỊCH',
    logOut: 'ĐĂNG XUẤT',
    settings: 'Cài Đặt',
    language: 'Ngôn Ngữ',
    currency: 'Tiền Tệ',
    done: 'XONG',
    quickDeposit: 'NẠP NHANH',
    deposit: 'Nạp Tiền Nhanh',
    depositAdded: 'Đã nạp',
    noTxn: '// KHÔNG CÓ GIAO DỊCH',
    pressAdd: 'Nhấn THÊM GIAO DỊCH để bắt đầu.',
    noExpense: '// CHƯA CÓ DỮ LIỆU',
    /* ── Category names ── */
    'Food & Dining': 'Ăn uống',
    'Transport': 'Di chuyển',
    'Shopping': 'Mua sắm',
    'Entertainment': 'Giải trí',
    'Health': 'Sức khoẻ',
    'Utilities': 'Tiện ích',
    'Salary': 'Lương',
    'Freelance': 'Freelance',
    'Other': 'Khác',
    /* ── Feed vocab ── */
    deleteToast: 'Đã xoá giao dịch.',
    expenseLogged: '✓ Đã ghi chi tiêu.',
    incomeRecorded: '✓ Đã ghi thu nhập.',
    undo: 'HOÀN TÁC',
    undoSuccess: 'Đã khôi phục giao dịch.',
    enterValidAmount: 'Nhập số tiền hợp lệ (ví dụ: 50000 hoặc 5000+20000).',
    categoryDeleted: 'Đã xoá danh mục.',
    categoryRestored: 'Đã khôi phục danh mục.',
    currencyToggle: 'Hiển Thị Tiền Tệ',
    quickLog: 'Ghi Nhanh',
    budgetPanel: 'Ngân Sách Danh Mục',
    setBudgets: 'ĐẶT NGÂN SÁCH',
    budgetSaved: 'Đã lưu ngân sách.',
    budgetEmpty: 'Chưa có ngân sách. Nhấn ĐẶT NGÂN SÁCH.',
    budgetLimit: 'Hạn mức',
    categoryAdded: 'đã được thêm.',
    addCustomCat: 'Thêm Danh Mục',
    cnyLabel: 'CNY ¥',
    backupRestore: 'Sao Lưu & Khôi Phục',
    exportBackup: 'Xuất Sao Lưu (JSON)',
    importBackup: 'Nhập Bản Sao Lưu',
    backupSuccess: '✓ Khôi phục dữ liệu thành công!',
    backupError: '⚠ Tập tin sao lưu không hợp lệ.',
    appearance: 'Giao Diện',
    darkTheme: 'Tối',
    lightTheme: 'Sáng',
    creamTheme: 'Màu Kem',
    skyTheme: 'Xanh Trời',
    budgetHint: 'Nhập hạn mức chi tiêu hàng tháng theo từng danh mục. Để trống để tắt.',
    addCustomCatLabel: '+ Thêm Danh Mục Mới',
    placeholderCatName: 'Tên danh mục',
    placeholderCatLimit: 'Hạn mức (0 = chỉ theo dõi)',
    addBtn: 'THÊM',
    amount: 'Số tiền',
    placeholderDesc: 'Ví dụ: Đi siêu thị...',
    placeholderAmount: 'Ví dụ: 50000 hoặc 5000+20000',
    placeholderCoffee: 'Ví dụ: Cà phê...',
    syncActive: 'ĐÃ ĐỒNG BỘ',
    dateRequired: 'Vui lòng chọn ngày.',
  },
  zh: {
    financialOverview: '财务概览',
    totalBalance: '总余额',
    allTimeNet: '累计净值',
    monthlyIncome: '本月收入',
    monthlyExpense: '本月支出',
    thisMonth: '本月',
    addTransaction: '添加交易',
    categoryBreakdown: '分类明细',
    transactionFeed: '交易记录',
    filterAll: '全部',
    filterIncome: '收入',
    filterExpense: '支出',
    newTransaction: '新建交易',
    typeExpense: '支出',
    typeIncome: '收入',
    description: '描述',
    amountVND: '金额 (VND)',
    category: '分类',
    date: '日期',
    cancel: '取消',
    saveTransaction: '保存交易',
    logOut: '退出',
    settings: '设置',
    language: '语言',
    currency: '货币',
    done: '完成',
    quickDeposit: '快速存款',
    deposit: '快速存款',
    depositAdded: '已存入',
    noTxn: '// 暂无交易记录',
    pressAdd: '点击添加交易开始使用。',
    noExpense: '// 暂无支出数据',
    /* ── Category names ── */
    'Food & Dining': '餐饮',
    'Transport': '交通',
    'Shopping': '购物',
    'Entertainment': '娱乐',
    'Health': '健康',
    'Utilities': '水电',
    'Salary': '薪资',
    'Freelance': '自由职业',
    'Other': '其他',
    /* ── Feed vocab ── */
    deleteToast: '交易已删除。',
    expenseLogged: '✓ 支出已记录。',
    incomeRecorded: '✓ 收入已记录。',
    undo: '撤销',
    undoSuccess: '交易已恢复。',
    enterValidAmount: '输入有效金额（例如 50000 或 5000+20000）。',
    categoryDeleted: '分类已删除。',
    categoryRestored: '分类已恢复。',
    currencyToggle: '显示货币',
    quickLog: '快速记账',
    budgetPanel: '信封预算',
    setBudgets: '设置预算',
    budgetSaved: '预算已保存。',
    budgetEmpty: '未设置预算，请点击设置预算。',
    budgetLimit: '上限',
    categoryAdded: '已添加。',
    addCustomCat: '添加分类',
    cnyLabel: 'CNY ¥',
    backupRestore: '备份与恢复',
    exportBackup: '导出备份 (JSON)',
    importBackup: '导入备份',
    backupSuccess: '✓ 备份恢复成功！',
    backupError: '⚠ 无效的备份文件。',
    appearance: '外观',
    darkTheme: '深色',
    lightTheme: '浅色',
    creamTheme: '奶油色',
    skyTheme: '天蓝色',
    budgetHint: '输入每个类别的每月限额。留空表示禁用。',
    addCustomCatLabel: '+ 添加自定义分类',
    placeholderCatName: '分类名称',
    placeholderCatLimit: '限额（0 = 仅追踪）',
    addBtn: '添加',
    amount: '金额',
    placeholderDesc: '例如：买菜...',
    placeholderAmount: '例如：50000 或 5000+20000',
    placeholderCoffee: '例如：咖啡...',
    syncActive: '同步已激活',
    dateRequired: '日期是必填的。',
  },
};

function t(key) {
  return (I18N[currentLang] || I18N.en)[key] || key;
}

/* Translate a category name */
function tCat(cat) {
  return t(cat);
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  });
  // Sync active lang button
  ['en', 'vi', 'zh'].forEach(code => {
    const btn = document.getElementById('lang-' + code);
    if (btn) btn.classList.toggle('lang-btn--active', code === currentLang);
  });
  // Full re-render so ALL dynamic text (categories, feed vocab) updates
  renderFeed();
  updateChart();
  // Re-render chart empty label
  const emptyEl = document.getElementById('chartEmpty');
  if (emptyEl) emptyEl.textContent = t('noExpense');
}

function setLang(code) {
  currentLang = code;
  try { localStorage.setItem(LANG_KEY, code); } catch (e) { }
  applyLang();
}

function loadLang() {
  try { currentLang = localStorage.getItem(LANG_KEY) || 'en'; } catch (e) { currentLang = 'en'; }
  applyLang();
}

function openSettings() {
  document.getElementById('settingsModal').classList.add('open');
  /* Sync currency buttons */
  ['VND', 'USD', 'CNY'].forEach(c => {
    const btn = document.getElementById('curr-' + c);
    if (btn) btn.classList.toggle('lang-btn--active', c === currentCurrency);
  });
  /* Sync theme cards */
  syncThemeCards();
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

function closeSettingsOnOverlay(e) {
  if (e.target === document.getElementById('settingsModal')) closeSettings();
}

/* ============================================================
   CURRENCY TOGGLE
   ============================================================ */
function setCurrency(code) {
  currentCurrency = code;
  try { localStorage.setItem(CURR_KEY, code); } catch (e) { }
  /* Sync all 3 currency button active states */
  ['VND', 'USD', 'CNY'].forEach(c => {
    const btn = document.getElementById('curr-' + c);
    if (btn) btn.classList.toggle('lang-btn--active', c === code);
  });
  /* Full re-render with new display format */
  calcMetrics();
  renderFeed();
  renderBudgetPanel();
  if (_categoryChart) {
    _categoryChart.destroy();
    _categoryChart = null;
  }
  updateChart();
}

function loadCurrency() {
  try { currentCurrency = localStorage.getItem(CURR_KEY) || 'VND'; } catch (e) { currentCurrency = 'VND'; }
  ['VND', 'USD', 'CNY'].forEach(c => {
    const btn = document.getElementById('curr-' + c);
    if (btn) btn.classList.toggle('lang-btn--active', c === currentCurrency);
  });
}

/* ============================================================
   THEME — 4-theme system (dark / light / cream / sky)
   ============================================================ */
const THEME_ICONS   = { dark: '\ud83c\udf19', light: '\u2600\ufe0f', cream: '\u2615', sky: '\ud83e\udde3' };
const THEME_ORDER   = ['dark', 'light', 'cream', 'sky'];
const THEME_CLASSES = ['dark-theme', 'light-theme', 'cream-theme', 'sky-theme'];

function _getSavedTheme() {
  try { return localStorage.getItem('caltdhy_theme') || 'dark'; } catch (_) { return 'dark'; }
}

function syncThemeCards() {
  const cur = _getSavedTheme();
  console.log('🔄 Syncing settings theme cards. Active theme:', cur);
  document.querySelectorAll('.theme-card').forEach(card => {
    const active = card.id === 'theme-btn-' + cur;
    card.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function applyTheme(theme) {
  console.log('🎨 Applying theme:', theme);
  const html = document.documentElement;
  
  if (window.ThemeManager && typeof window.ThemeManager.set === 'function') {
    // If window.ThemeManager is loaded in head, delegate applying and saving to it
    window.ThemeManager.set(theme);
  } else {
    // Fallback: manual local class application
    THEME_CLASSES.forEach(c => html.classList.remove(c));
    if (theme !== 'dark') {
      html.classList.add(theme + '-theme');
    }
    try { localStorage.setItem('caltdhy_theme', theme); } catch (_) {}
  }
  
  /* Sync active states on cards in settings modal */
  syncThemeCards();
}

function setTheme(theme) {
  console.log('💾 Setting theme to:', theme);
  applyTheme(theme);
}

function loadTheme() {
  const saved = _getSavedTheme();
  console.log('📂 Loading saved theme from storage:', saved);
  applyTheme(saved);
}

/** Cycle to next theme */
function cycleTheme() {
  const cur = _getSavedTheme();
  const idx = THEME_ORDER.indexOf(cur);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  console.log('🔄 Cycling theme from', cur, 'to', next);
  setTheme(next);
}

/** Select a specific theme — called by theme-card buttons in settings */
function pickTheme(theme) {
  console.log('👉 pickTheme called with:', theme);
  setTheme(theme);
}

/* Legacy compat */
function toggleTheme() { cycleTheme(); }
function toggleThemePicker() { cycleTheme(); }

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ============================================================
   AUTH
   ============================================================ */
function handleLogout() {
  ['caltdhy_token', 'caltdhy_user', 'pcn_token', 'pcn_user']
    .forEach(k => localStorage.removeItem(k));
  window.location.href = 'index.html';
}

function initUser() {
  try {
    const raw = localStorage.getItem('caltdhy_user') || localStorage.getItem('pcn_user');
    const u = raw ? JSON.parse(raw) : null;
    if (u) {
      const name = u.name || u.username || 'USER';
      const el = document.getElementById('userChip');
      if (el) el.textContent = name.toUpperCase().slice(0, 14);
    }
  } catch (e) { /* ignore */ }
}

/* ============================================================
   BUDGET MODAL (Set Budgets)
   ============================================================ */
function openBudgetModal() {
  const grid = document.getElementById('budgetFormGrid');
  if (!grid) { document.getElementById('budgetModal').classList.add('open'); return; }

  /* Render ALL categories (default + custom) as form rows */
  const allCats = getAllCategories();

  /* Helper: convert stored VND to display currency for pre-fill */
  function toDisplay(vnd) {
    if (!vnd) return '';
    if (currentCurrency === 'USD') return +(vnd / EXCHANGE_RATE).toFixed(2);
    if (currentCurrency === 'CNY') return +(vnd / CNY_RATE).toFixed(2);
    return vnd;
  }

  grid.innerHTML = allCats.map(cat => {
    const safeId = 'budget-input-' + cat.replace(/[^a-z0-9]/gi, '_');
    const icon = CAT_ICONS[cat] || '\u2713';
    const label = escHtml(tCat(cat));
    const val = toDisplay(budgets[cat]);
    const isCustom = customCategories.includes(cat);
    return `
      <div class="budget-form-row" data-cat="${escHtml(cat)}">
        <label class="budget-form-label" for="${safeId}">${icon} ${label}</label>
        <div class="budget-input-wrapper">
          <input class="budget-form-input" id="${safeId}" type="number" min="0" step="1" placeholder="0" value="${val}" />
          ${isCustom ? `
            <button type="button" class="btn-delete-cat" onclick="deleteCustomCategory('${escHtml(cat)}')" title="Delete Category" aria-label="Delete Category">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : ''}
        </div>
      </div>`;
  }).join('');

  document.getElementById('budgetModal').classList.add('open');
}

function closeBudgetModal() {
  document.getElementById('budgetModal').classList.remove('open');
}

function closeBudgetOnOverlay(e) {
  if (e.target === document.getElementById('budgetModal')) closeBudgetModal();
}

function handleSaveBudgets(e) {
  if (e) e.preventDefault();
  const grid = document.getElementById('budgetFormGrid');
  if (!grid) return;

  grid.querySelectorAll('.budget-form-row[data-cat]').forEach(row => {
    const cat = row.dataset.cat;
    const inp = row.querySelector('.budget-form-input');
    if (!inp) return;
    const raw = parseFloat(inp.value);
    if (!isNaN(raw) && raw > 0) {
      /* If USD mode, user typed USD → convert to VND for storage */
      budgets[cat] = currentCurrency === 'USD'
        ? Math.round(raw * EXCHANGE_RATE)
        : Math.round(raw);
    } else {
      delete budgets[cat]; // clear if empty / zero
    }
  });
  saveBudgets();
  renderBudgetPanel();
  closeBudgetModal();
  showToast('✓ ' + t('budgetSaved'));
}

/* ============================================================
   CUSTOM CATEGORY MANAGEMENT
   ============================================================ */
function addCustomCategory() {
  const nameEl = document.getElementById('newCatName');
  const limitEl = document.getElementById('newCatLimit');
  if (!nameEl || !limitEl) return;

  const name = nameEl.value.trim();
  const raw = parseFloat(limitEl.value);

  if (!name) { showToast('\u26a0 Enter a category name.'); return; }
  if (getAllCategories().map(c => c.toLowerCase()).includes(name.toLowerCase())) {
    showToast('\u26a0 Category already exists.'); return;
  }

  customCategories.push(name);
  saveCustomCategories();

  if (!isNaN(raw) && raw > 0) {
    budgets[name] = currentCurrency === 'USD' ? Math.round(raw * EXCHANGE_RATE)
      : currentCurrency === 'CNY' ? Math.round(raw * CNY_RATE)
        : Math.round(raw);
    saveBudgets();
  }

  nameEl.value = '';
  limitEl.value = '';

  showToast('\u2713 "' + name + '" ' + t('categoryAdded'));
  openBudgetModal();    // rebuild grid rows to include new cat
  renderBudgetPanel();
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    /* Close whichever modal is open, cascading priority */
    const modal = document.getElementById('modal');
    const numpad = document.getElementById('numpadModal');
    const settings = document.getElementById('settingsModal');
    const ql = document.getElementById('quickLogModal');
    const budget = document.getElementById('budgetModal');
    if (modal && modal.classList.contains('open')) { closeModal(); return; }
    if (numpad && numpad.classList.contains('open')) { closeNumpad(); return; }
    if (settings && settings.classList.contains('open')) { closeSettings(); return; }
    if (ql && ql.classList.contains('open')) { closeQuickLog(); return; }
    if (budget && budget.classList.contains('open')) { closeBudgetModal(); return; }
    /* No modal open — go back */
    history.back();
    return;
  }
  // N → open Add Transaction (when not typing in an input)
  if (e.key === 'n' && document.activeElement.tagName !== 'INPUT'
    && document.activeElement.tagName !== 'TEXTAREA'
    && document.activeElement.tagName !== 'SELECT') {
    openModal();
  }
});

/* ============================================================
   DELETE BUTTON — inject CSS once (avoid extra link tag)
   ============================================================ */
// injectDeleteStyle removed in favor of spending.css styles

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  loadCustomCategories();
  loadTransactions();
  loadBudgets();
  calcMetrics();
  renderFeed();
  renderBudgetPanel();
  updateChart();
  loadLang();
  loadCurrency();
  loadTheme();

  // Try to sync with MacBook local file-server
  syncLoadFromServer();

  /* Quick Log form — Enter key support */
  const qlForm = document.getElementById('qlForm');
  if (qlForm) qlForm.addEventListener('submit', handleQuickLog);

  /* Budget form */
  const bForm = document.getElementById('budgetForm');
  if (bForm) bForm.addEventListener('submit', handleSaveBudgets);
});

/* ============================================================
   GLOBAL WINDOW BINDINGS
   Ensure all functions triggered via inline HTML onclick are
   explicitly exposed to the global window scope to avoid FOUC/ESM conflicts.
   ============================================================ */
window.pickTheme = pickTheme;
window.setLang = setLang;
window.setCurrency = setCurrency;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.closeSettingsOnOverlay = closeSettingsOnOverlay;
window.exportData = exportData;
window.triggerImport = triggerImport;
window.importData = importData;
window.openBudgetModal = openBudgetModal;
window.closeBudgetModal = closeBudgetModal;
window.closeBudgetOnOverlay = closeBudgetOnOverlay;
window.handleQuickLog = handleQuickLog;
window.handleSaveBudgets = handleSaveBudgets;
window.deleteTransaction = deleteTransaction;
window.setFilter = setFilter;
window.setType = setType;
window.closeModal = closeModal;
window.openModal = openModal;
window.closeModalOnOverlay = closeModalOnOverlay;
window.setQlType = setQlType;
window.closeQuickLog = closeQuickLog;
window.openQuickLog = openQuickLog;
window.closeQuickLogOnOverlay = closeQuickLogOnOverlay;
window.numpadKey = numpadKey;
window.numpadSubmit = numpadSubmit;
window.closeNumpad = closeNumpad;
window.openNumpad = openNumpad;
window.closeNumpadOnOverlay = closeNumpadOnOverlay;
window.handleLogout = handleLogout;
window.deleteCustomCategory = deleteCustomCategory;
window.undoDelete = undoDelete;
window.addCustomCategory = addCustomCategory;
