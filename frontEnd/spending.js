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
let selectedMonthYear = null;

/* ── Interactive Charts State ── */
let currentTrendRange = 3;  // 1 | 3 | 6 | 12 (months)
let currentTrendType = 'bar'; // 'bar' | 'line'
let currentCategoryChartType = 'doughnut'; // 'doughnut' | 'polarArea'
let _trendChart = null; // trend chart instance
let currentView = 'home'; // 'home' | 'analytics'

/** Returns default + custom categories merged */
function getAllCategories() {
  const all = [...CATEGORIES];
  customCategories.forEach(c => { if (!all.includes(c)) all.push(c); });
  return all;
}

/* ============================================================
   PREMIUM CUSTOM DROPDOWN (SELECT) LOGIC
   ============================================================ */
const customSelects = {};

function initCustomDropdown(selectId) {
  const nativeSelect = document.getElementById(selectId);
  if (!nativeSelect) return;

  // Check if wrapper already exists
  let wrapper = nativeSelect.nextElementSibling;
  if (!wrapper || !wrapper.classList.contains('custom-select')) {
    wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    wrapper.id = selectId + '_custom';
    
    // Insert wrapper right after the native select
    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect.nextSibling);
    
    // Hide native select
    nativeSelect.style.setProperty('display', 'none', 'important');
  }

  // Generate template
  wrapper.innerHTML = `
    <div class="custom-select-trigger" role="combobox" aria-expanded="false" aria-haspopup="listbox" tabIndex="0">
      <div class="custom-select-value">
        <span class="custom-select-icon">📦</span>
        <span class="custom-select-text"></span>
      </div>
      <span class="custom-select-arrow"></span>
    </div>
    <div class="custom-select-dropdown" role="listbox"></div>
  `;

  const trigger = wrapper.querySelector('.custom-select-trigger');

  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Close other custom selects first
    Object.keys(customSelects).forEach(key => {
      if (key !== selectId) {
        const otherWrapper = document.getElementById(key + '_custom');
        if (otherWrapper) {
          otherWrapper.classList.remove('open');
          otherWrapper.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'false');
        }
      }
    });

    const isOpen = wrapper.classList.toggle('open');
    trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Handle keyboard navigation for Accessibility
  trigger.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!wrapper.classList.contains('open')) {
        wrapper.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      const firstOpt = wrapper.querySelector('.custom-select-option');
      if (firstOpt) firstOpt.focus();
    }
  });

  customSelects[selectId] = wrapper;
  
  // Initial sync
  syncCustomDropdown(selectId);
}

function syncCustomDropdown(selectId) {
  const nativeSelect = document.getElementById(selectId);
  const wrapper = customSelects[selectId];
  if (!nativeSelect || !wrapper) return;

  const triggerText = wrapper.querySelector('.custom-select-text');
  const triggerIcon = wrapper.querySelector('.custom-select-icon');
  const dropdown = wrapper.querySelector('.custom-select-dropdown');

  const options = Array.from(nativeSelect.options);
  const selectedIndex = Math.max(0, nativeSelect.selectedIndex);
  const selectedOption = options[selectedIndex];

  // Update trigger UI
  if (selectedOption) {
    const value = selectedOption.value;
    triggerText.textContent = selectedOption.textContent;
    triggerIcon.textContent = CAT_ICONS[value] || '📦';
  } else {
    triggerText.textContent = '';
    triggerIcon.textContent = '📦';
  }

  // Populate options dropdown
  dropdown.innerHTML = options.map((opt, index) => {
    const value = opt.value;
    const text = opt.textContent;
    const icon = CAT_ICONS[value] || '📦';
    const isSelected = index === selectedIndex;
    
    return `
      <div class="custom-select-option ${isSelected ? 'selected' : ''}" 
           data-value="${escHtml(value)}" 
           role="option" 
           tabIndex="0"
           aria-selected="${isSelected ? 'true' : 'false'}">
        <span class="custom-select-icon">${icon}</span>
        <span class="custom-select-option-text">${escHtml(text)}</span>
      </div>
    `;
  }).join('');

  // Add click listeners to custom options
  const optElements = dropdown.querySelectorAll('.custom-select-option');
  optElements.forEach(optEl => {
    optEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = optEl.getAttribute('data-value');
      
      // Update native select and trigger change event
      nativeSelect.value = val;
      nativeSelect.dispatchEvent(new Event('change'));
      
      // Close dropdown
      wrapper.classList.remove('open');
      wrapper.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'false');
      
      // Sync UI again
      syncCustomDropdown(selectId);
    });

    // Keyboard support inside options list
    optEl.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        optEl.click();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = optEl.nextElementSibling;
        if (next) next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = optEl.previousElementSibling;
        if (prev) prev.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        wrapper.classList.remove('open');
        wrapper.querySelector('.custom-select-trigger').focus();
      }
    });
  });
}

function updateCategoryDropdown(selectId, type) {
  const catSel = document.getElementById(selectId);
  if (!catSel) return;

  let catsToShow = getAllCategories();
  if (type === 'expense') {
    const budgetedCats = catsToShow.filter(c => budgets[c] && budgets[c] > 0);
    if (budgetedCats.length > 0) {
      catsToShow = budgetedCats;
    }
  }

  // Populate hidden native select options
  catSel.innerHTML = catsToShow.map(c =>
    `<option value="${escHtml(c)}">${escHtml(tCat(c))}</option>`
  ).join('');

  // Synchronize custom dropdown
  syncCustomDropdown(selectId);
}

// Click outside to close custom select dropdowns and month picker dropdown
document.addEventListener('click', (e) => {
  Object.keys(customSelects).forEach(key => {
    const wrapper = document.getElementById(key + '_custom');
    if (wrapper && wrapper.classList.contains('open')) {
      wrapper.classList.remove('open');
      wrapper.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'false');
    }
  });

  // Close month picker dropdown if open and click was outside monthPickerWrapper
  const monthWrapper = document.getElementById('monthPickerWrapper');
  const monthDropdown = document.getElementById('monthPickerDropdown');
  const monthTrigger = document.getElementById('monthPickerTrigger');
  if (monthWrapper && monthDropdown && monthDropdown.classList.contains('open') && !monthWrapper.contains(e.target)) {
    monthDropdown.classList.remove('open');
    if (monthTrigger) monthTrigger.setAttribute('aria-expanded', 'false');
  }
});

/* ============================================================
   PERSISTENCE
   ============================================================ */
let isServerConnected = false;

function getAuthHeaders() {
  const token = localStorage.getItem('pcn_token') || localStorage.getItem('caltdhy_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function syncLoadFromServer() {
  try {
    const headers = getAuthHeaders();
    
    // Load Budgets
    const budgetRes = await fetch('/api/spending/budget', { headers });
    if (budgetRes.status === 401) {
      handleLogout();
      return;
    }
    if (budgetRes.ok) {
      const budgetData = await budgetRes.json();
      if (budgetData && budgetData.success && budgetData.data) {
        const serverBudgets = budgetData.data;
        const localBudgets = { ...budgets }; // đã load từ localStorage trước đó

        // Merge: local làm nền, server ghi đè (tránh race condition xóa mất data)
        const merged = { ...localBudgets, ...serverBudgets };
        budgets = merged;
        localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));

        // Nếu local có nhiều category hơn server → push lên server để sync
        if (Object.keys(localBudgets).length > Object.keys(serverBudgets).length) {
          syncSaveBudgetsToServer();
        }
      }
    }

    // Load Transactions
    const txnRes = await fetch('/api/spending', { headers });
    if (txnRes.ok) {
      const txnData = await txnRes.json();
      if (txnData && txnData.success && Array.isArray(txnData.data)) {
        transactions = txnData.data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      }
    }

    isServerConnected = true;
    console.log('🔌 Connected to MongoDB Atlas. Data loaded successfully!');
    
    // Trigger full UI redraw with new database state
    triggerUIUpdates();
  } catch (e) {
    console.log('📴 Operating in Offline Mode (using browser localStorage).', e);
  }
}

async function syncSaveBudgetsToServer() {
  try {
    const headers = getAuthHeaders();
    const res = await fetch('/api/spending/budget', {
      method: 'PUT',
      headers,
      body: JSON.stringify(budgets)
    });
    if (res.ok) {
      console.log('💾 Budgets backed up to MongoDB!');
    }
  } catch (e) {
    console.warn('⚠️ Budget backup failed.', e);
  }
}

async function syncAddTransactionToServer(txn) {
  try {
    const headers = getAuthHeaders();
    const res = await fetch('/api/spending', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: txn.type,
        desc: txn.desc,
        amount: txn.amount,
        category: txn.category,
        date: txn.date
      })
    });
    if (res.ok) {
      const result = await res.json();
      if (result && result.success && result.data) {
        // Cập nhật ID từ client-side temporary thành ID thực tế của MongoDB
        const localTxn = transactions.find(t => t.id === txn.id);
        if (localTxn) {
          localTxn.id = result.data.id;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        }
        console.log('💾 Transaction saved to MongoDB!');
      }
    }
  } catch (e) {
    console.warn('⚠️ Transaction backup failed.', e);
  }
}

async function syncDeleteTransactionFromServer(id) {
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`/api/spending/${id}`, {
      method: 'DELETE',
      headers
    });
    if (res.ok) {
      console.log(`💾 Deleted transaction ${id} from MongoDB!`);
    }
  } catch (e) {
    console.warn('⚠️ Transaction deletion backup failed.', e);
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
    syncSaveBudgetsToServer();
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
   INFO TOOLTIP – Backup & Restore
   ============================================================ */
function toggleBackupTooltip(e) {
  e.stopPropagation();
  const tooltip = document.getElementById('backupTooltip');
  if (!tooltip) return;
  const isOpen = tooltip.classList.toggle('is-open');
  if (isOpen) {
    // Close when clicking anywhere outside
    const close = (ev) => {
      if (!ev.target.closest('#backupInfoBtn')) {
        tooltip.classList.remove('is-open');
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
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
      
      triggerUIUpdates();
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
  if (selectedMonthYear) return selectedMonthYear;
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

  const now = new Date(year, month, 1);
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

function getActiveThemeName() {
  const root = document.documentElement;
  if (root.classList.contains('light-theme')) return 'light';
  if (root.classList.contains('cream-theme')) return 'cream';
  if (root.classList.contains('sky-theme')) return 'sky';
  return 'dark';
}

function getThemeChartColors() {
  const theme = getActiveThemeName();
  switch (theme) {
    case 'light':
      return {
        income: '#4F46E5',     // Indigo
        incomeGlow: 'rgba(79,70,229,0.2)',
        incomeMuted: 'rgba(79,70,229,0.25)',
        expense: '#FF6B81',    // Rose-red
        expenseGlow: 'rgba(255,107,129,0.2)',
        expenseMuted: 'rgba(255,107,129,0.25)',
        grid: 'rgba(0,0,0,0.05)',
        text: '#64748B'
      };
    case 'cream':
      return {
        income: '#2D7A3E',     // Deep Green
        incomeGlow: 'rgba(45,122,62,0.2)',
        incomeMuted: 'rgba(45,122,62,0.25)',
        expense: '#C0531E',    // Terracotta
        expenseGlow: 'rgba(192,83,30,0.2)',
        expenseMuted: 'rgba(192,83,30,0.25)',
        grid: 'rgba(44, 29, 16, 0.08)',
        text: '#8A7060'
      };
    case 'sky':
      return {
        income: '#0D7252',     // Deep Teal
        incomeGlow: 'rgba(13,114,82,0.2)',
        incomeMuted: 'rgba(13,114,82,0.25)',
        expense: '#0078C8',    // Ocean Blue
        expenseGlow: 'rgba(0,120,200,0.2)',
        expenseMuted: 'rgba(0,120,200,0.25)',
        grid: 'rgba(0, 80, 140, 0.08)',
        text: '#4D7899'
      };
    case 'dark':
    default:
      return {
        income: '#10B981',     // Glowing Emerald Green
        incomeGlow: 'rgba(16,185,129,0.35)',
        incomeMuted: 'rgba(16,185,129,0.2)',
        expense: '#FF4B72',    // Glowing Neon Coral/Rose
        expenseGlow: 'rgba(255,75,114,0.35)',
        expenseMuted: 'rgba(255,75,114,0.2)',
        grid: 'rgba(255,255,255,0.05)',
        text: '#8F9CAE'
      };
  }
}

let _categoryChart = null;

function updateChart() {
  try {
    const canvas = document.getElementById('categoryChart');
    const legendEl = document.getElementById('chartLegend');
    const emptyEl = document.getElementById('chartEmpty');
    if (!canvas) return;

    /* Aggregate expenses by category (current month only) */
    const { month, year } = currentMonthYear();
    
    // Toggle View Month Detail button visibility
    const btnDetail = document.getElementById('btnViewMonthDetail');
    if (btnDetail) {
      const hasTxns = transactions.some(t => {
        const d = new Date(t.date + 'T00:00:00');
        return d.getMonth() === month && d.getFullYear() === year;
      });
      btnDetail.style.display = (hasTxns && currentView === 'analytics') ? 'block' : 'none';
    }

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
      updateTrendChart();
      updateAnalyticsSummary();
      return;
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js is not loaded yet or failed to fetch from CDN.');
      updateTrendChart();
      updateAnalyticsSummary();
      return;
    }

    /* Build color arrays */
    const bgColors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length].bg);
    const glowColors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length].glow);

    /* Custom glow plugin for category Doughnut */
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

    const colors = getThemeChartColors();

    if (_categoryChart && _categoryChart.config.type === currentCategoryChartType) {
      /* Update in-place for smooth transitions */
      _categoryChart.data.labels = labels;
      _categoryChart.data.datasets[0].data = data;
      _categoryChart.data.datasets[0].backgroundColor = bgColors;
      _categoryChart.data.datasets[0].borderColor = getActiveThemeName() === 'dark' ? '#1e2124' : '#ffffff';
      if (currentCategoryChartType === 'polarArea') {
        _categoryChart.options.scales.r.grid.color = colors.grid;
        _categoryChart.options.scales.r.angleLines.color = colors.grid;
        _categoryChart.options.scales.r.ticks.color = colors.text;
        _categoryChart.options.scales.r.ticks.font = { family: "'JetBrains Mono', monospace", size: 11 };
      }
      _categoryChart.options.plugins.tooltip.titleFont = { family: "'JetBrains Mono', monospace", size: 13, weight: '700' };
      _categoryChart.options.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 12 };
      _categoryChart.update('active');
    } else {
      if (_categoryChart) {
        _categoryChart.destroy();
      }

      const config = {
        type: currentCategoryChartType,
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: bgColors,
            borderColor: getActiveThemeName() === 'dark' ? '#1e2124' : '#ffffff',
            borderWidth: 2.5,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
              titleFont: { family: "'JetBrains Mono', monospace", size: 13, weight: '700' },
              bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
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
      };

      if (currentCategoryChartType === 'doughnut') {
        config.plugins = [glowPlugin];
        config.options.cutout = '70%';
      } else {
        // Polar Area specific scale settings
        config.options.scales = {
          r: {
            grid: { color: colors.grid },
            angleLines: { color: colors.grid },
            ticks: {
              color: colors.text,
              backdropColor: 'transparent',
              font: { family: "'JetBrains Mono', monospace", size: 11 }
            }
          }
        };
      }

      _categoryChart = new Chart(canvas, config);
    }

    /* Render custom HTML legend */
    legendEl.innerHTML = labels.map((lbl, i) => {
      const pct = ((data[i] / total) * 100).toFixed(0);
      return `
        <div class="chart-legend-item">
          <span class="chart-legend-dot" style="background:${bgColors[i]};box-shadow:0 0 6px 2px ${glowColors[i]}"></span>
          <span class="chart-legend-lbl">${escHtml(lbl)}</span>
          <span class="chart-legend-val">${fmt(data[i])}</span>
          <span class="chart-legend-pct">(${pct}%)</span>
        </div>`;
    }).join('');

    // Trigger trend chart update automatically!
    updateTrendChart();

    // Trigger analytics summary update automatically!
    updateAnalyticsSummary();

  } catch (err) {
    console.error('Error updating chart safely:', err);
  }
}

function updateTrendChart() {
  try {
    const canvas = document.getElementById('trendChart');
    const emptyEl = document.getElementById('trendEmpty');
    if (!canvas) return;

    /* Safety: do not render/update trend chart if not in analytics view (avoids 0x0 size bugs) */
    if (currentView !== 'analytics') return;

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js is not loaded.');
      return;
    }

    let labels = [];
    let incomeData = [];
    let expenseData = [];
    let currentWeekIdx = -1;

    if (currentTrendRange === 1) {
      const today = new Date();
      const currentDay = today.getDate();
      if (currentDay >= 1 && currentDay <= 7) currentWeekIdx = 0;
      else if (currentDay >= 8 && currentDay <= 14) currentWeekIdx = 1;
      else if (currentDay >= 15 && currentDay <= 21) currentWeekIdx = 2;
      else if (currentDay >= 22) currentWeekIdx = 3;

      // 1 Month: Weekly breakdown of current month
      const weeksList = [
        { label: currentWeekIdx === 0 ? [t('week1') || 'Week 1', `(${t('current') || 'current'})`] : (t('week1') || 'Week 1'), start: 1, end: 7 },
        { label: currentWeekIdx === 1 ? [t('week2') || 'Week 2', `(${t('current') || 'current'})`] : (t('week2') || 'Week 2'), start: 8, end: 14 },
        { label: currentWeekIdx === 2 ? [t('week3') || 'Week 3', `(${t('current') || 'current'})`] : (t('week3') || 'Week 3'), start: 15, end: 21 },
        { label: currentWeekIdx === 3 ? [t('week4') || 'Week 4+', `(${t('current') || 'current'})`] : (t('week4') || 'Week 4+'), start: 22, end: 31 }
      ];
      incomeData = [0, 0, 0, 0];
      expenseData = [0, 0, 0, 0];
      const { month, year } = currentMonthYear();

      transactions.forEach(t => {
        const d = new Date(t.date + 'T00:00:00');
        if (d.getMonth() === month && d.getFullYear() === year) {
          const dateNum = d.getDate();
          let idx = -1;
          if (dateNum >= 1 && dateNum <= 7) idx = 0;
          else if (dateNum >= 8 && dateNum <= 14) idx = 1;
          else if (dateNum >= 15 && dateNum <= 21) idx = 2;
          else if (dateNum >= 22) idx = 3;

          if (idx !== -1) {
            if (t.type === 'income') {
              incomeData[idx] += t.amount;
            } else {
              expenseData[idx] += t.amount;
            }
          }
        }
      });
      labels = weeksList.map(w => w.label);
    } else {
      // 3, 6, 12 Months: Monthly calendar grouping
      const monthsList = [];
      const now = new Date();
      for (let i = currentTrendRange - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const lName = d.toLocaleString(currentLang === 'vi' ? 'vi-VN' : (currentLang === 'zh' ? 'zh-CN' : 'en-US'), { month: 'short' }).toUpperCase();
        monthsList.push({
          month: d.getMonth(),
          year: d.getFullYear(),
          label: lName + ' ' + d.getFullYear()
        });
      }

      incomeData = new Array(currentTrendRange).fill(0);
      expenseData = new Array(currentTrendRange).fill(0);

      transactions.forEach(t => {
        const d = new Date(t.date + 'T00:00:00');
        const tMonth = d.getMonth();
        const tYear = d.getFullYear();

        const idx = monthsList.findIndex(m => m.month === tMonth && m.year === tYear);
        if (idx !== -1) {
          if (t.type === 'income') {
            incomeData[idx] += t.amount;
          } else {
            expenseData[idx] += t.amount;
          }
        }
      });
      labels = monthsList.map(m => m.label);
    }

    const totalIncome = incomeData.reduce((s, v) => s + v, 0);
    const totalExpense = expenseData.reduce((s, v) => s + v, 0);
    const isEmpty = totalIncome === 0 && totalExpense === 0;

    if (emptyEl) emptyEl.style.display = isEmpty ? 'block' : 'none';
    canvas.style.display = isEmpty ? 'none' : 'block';

    if (isEmpty) {
      if (_trendChart) { _trendChart.destroy(); _trendChart = null; }
      return;
    }

    const colors = getThemeChartColors();

    const datasetIncomeColors = currentTrendRange === 1 && currentTrendType === 'bar'
      ? incomeData.map((_, idx) => (idx === currentWeekIdx ? colors.income : colors.incomeMuted))
      : (currentTrendType === 'bar' ? colors.income : colors.incomeGlow);

    const datasetExpenseColors = currentTrendRange === 1 && currentTrendType === 'bar'
      ? expenseData.map((_, idx) => (idx === currentWeekIdx ? colors.expense : colors.expenseMuted))
      : (currentTrendType === 'bar' ? colors.expense : colors.expenseGlow);

    const datasetIncomeBorderColors = currentTrendRange === 1 && currentTrendType === 'bar'
      ? incomeData.map((_, idx) => (idx === currentWeekIdx ? colors.income : colors.incomeMuted))
      : colors.income;

    const datasetExpenseBorderColors = currentTrendRange === 1 && currentTrendType === 'bar'
      ? expenseData.map((_, idx) => (idx === currentWeekIdx ? colors.expense : colors.expenseMuted))
      : colors.expense;

    if (_trendChart && _trendChart.config.type === currentTrendType) {
      // Update in-place
      _trendChart.data.labels = labels;
      _trendChart.data.datasets[0].data = incomeData;
      _trendChart.data.datasets[1].data = expenseData;
      _trendChart.data.datasets[0].backgroundColor = datasetIncomeColors;
      _trendChart.data.datasets[1].backgroundColor = datasetExpenseColors;
      _trendChart.data.datasets[0].borderColor = datasetIncomeBorderColors;
      _trendChart.data.datasets[1].borderColor = datasetExpenseBorderColors;
      _trendChart.options.scales.x.grid.color = colors.grid;
      _trendChart.options.scales.y.grid.color = colors.grid;
      _trendChart.options.scales.x.ticks.color = colors.text;
      _trendChart.options.scales.y.ticks.color = colors.text;
      _trendChart.options.scales.x.ticks.font = { family: "'JetBrains Mono', monospace", size: 11 };
      _trendChart.options.scales.y.ticks.font = { family: "'JetBrains Mono', monospace", size: 11 };
      _trendChart.options.plugins.legend.labels.font = { family: "'JetBrains Mono', monospace", size: 12 };
      _trendChart.options.plugins.tooltip.titleFont = { family: "'JetBrains Mono', monospace", size: 13, weight: '700' };
      _trendChart.options.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 12 };
      _trendChart.update('active');
    } else {
      // Recreate chart
      if (_trendChart) { _trendChart.destroy(); }

      const datasets = [
        {
          label: t('incomeLabel') || 'Income',
          data: incomeData,
          backgroundColor: datasetIncomeColors,
          borderColor: datasetIncomeBorderColors,
          borderWidth: 2.5,
          borderRadius: currentTrendType === 'bar' ? 4 : 0,
          fill: currentTrendType === 'line',
          tension: 0.35,
          pointBackgroundColor: colors.income,
          pointBorderColor: '#1e2124',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: t('expenseLabel') || 'Expense',
          data: expenseData,
          backgroundColor: datasetExpenseColors,
          borderColor: datasetExpenseBorderColors,
          borderWidth: 2.5,
          borderRadius: currentTrendType === 'bar' ? 4 : 0,
          fill: currentTrendType === 'line',
          tension: 0.35,
          pointBackgroundColor: colors.expense,
          pointBorderColor: '#1e2124',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ];

      _trendChart = new Chart(canvas, {
        type: currentTrendType,
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 500, easing: 'easeInOutQuad' },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: colors.text,
                font: { family: "'JetBrains Mono', monospace", size: 12 },
                boxWidth: 10,
                boxHeight: 10,
                padding: 15
              }
            },
            tooltip: {
              backgroundColor: '#252a2b',
              titleColor: '#e0e5ec',
              bodyColor: '#8896a8',
              borderColor: 'rgba(255,255,255,.08)',
              borderWidth: 1,
              padding: 10,
              titleFont: { family: "'JetBrains Mono', monospace", size: 13, weight: '700' },
              bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
              callbacks: {
                label(ctx) {
                  return ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: colors.grid, drawBorder: false },
              ticks: { color: colors.text, font: { family: "'JetBrains Mono', monospace", size: 11 } }
            },
            y: {
              grid: { color: colors.grid, drawBorder: false },
              ticks: {
                color: colors.text,
                font: { family: "'JetBrains Mono', monospace", size: 11 },
                callback(val) {
                  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
                  if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
                  return val;
                }
              }
            }
          }
        }
      });
    }
  } catch (err) {
    console.error('Error rendering trend chart:', err);
    const emptyEl = document.getElementById('trendEmpty');
    if (emptyEl) {
      emptyEl.textContent = '⚠️ Error: ' + err.message + '\n' + (err.stack ? err.stack.split('\n').slice(0, 2).join('\n') : '');
      emptyEl.style.display = 'block';
      emptyEl.style.whiteSpace = 'pre-wrap';
      emptyEl.style.color = '#ff4757';
      emptyEl.style.opacity = '1';
    }
  }
}

function switchView(view) {
  currentView = view;
  
  // Update navigation button active state
  const btnHome = document.getElementById('nav-home');
  const btnAnalytics = document.getElementById('nav-analytics');
  if (btnHome) btnHome.classList.toggle('active', view === 'home');
  if (btnAnalytics) btnAnalytics.classList.toggle('active', view === 'analytics');
  
  // Show / Hide view containers
  const viewHome = document.getElementById('view-home');
  const viewAnalytics = document.getElementById('view-analytics');
  if (viewHome) viewHome.classList.toggle('active', view === 'home');
  if (viewAnalytics) viewAnalytics.classList.toggle('active', view === 'analytics');
  
  if (view === 'analytics') {
    // Redraw the trend chart immediately to fit the spacious area
    renderMonthSelector();
    updateTrendChart();
    updateAnalyticsSummary();
    renderMonthTxnFeed();
  }
  updateChart();
}

function updateAnalyticsSummary() {
  const grid = document.getElementById('analyticsGrid');
  if (!grid) return;
  
  const { month, year } = currentMonthYear();
  
  // Calculate analytics based on transactions in the selected month
  let totalIncome = 0;
  let totalExpense = 0;
  let txnCount = 0;
  const totalsByCat = {};
  
  transactions.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    if (d.getMonth() === month && d.getFullYear() === year) {
      txnCount++;
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        totalsByCat[t.category] = (totalsByCat[t.category] || 0) + t.amount;
      }
    }
  });
  
  // Find top spending category
  let topCat = 'Other';
  let topCatAmt = 0;
  Object.keys(totalsByCat).forEach(c => {
    if (totalsByCat[c] > topCatAmt) {
      topCat = c;
      topCatAmt = totalsByCat[c];
    }
  });
  
  // Calculate savings rate
  const savings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(0) : 0;
  
  const tSavingsRate = t('savingsRate') || 'Savings Rate';
  const tTopCategory = t('topCategory') || 'Top Category';
  const tTotalTransactions = t('totalTransactions') || 'Total Transactions';
  const tNetSavings = t('netSavings') || 'Net Savings';
  
  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';
  const monthDate = new Date(year, month, 1);
  const monthName = monthDate.toLocaleString(locale, { month: 'short' }).toUpperCase();
  const monthLabel = monthName + ' ' + year;

  grid.innerHTML = `
    <div class="analytics-card">
      <p class="analytics-card__title">${escHtml(tSavingsRate)}</p>
      <p class="analytics-card__value">${savingsRate}%</p>
      <p class="analytics-card__sub">${totalIncome > 0 ? `${t('savingsGood') || 'of total income saved'} (${monthLabel})` : (t('savingsNoIncome') || 'No income logged')}</p>
    </div>
    <div class="analytics-card">
      <p class="analytics-card__title">${escHtml(tTopCategory)}</p>
      <p class="analytics-card__value" style="font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(tCat(topCat))}</p>
      <p class="analytics-card__sub">${topCatAmt > 0 ? fmt(topCatAmt) : '0 ₫'}</p>
    </div>
    <div class="analytics-card">
      <p class="analytics-card__title">${escHtml(tNetSavings)}</p>
      <p class="analytics-card__value ${savings >= 0 ? 'pos' : 'neg'}" style="color: ${savings >= 0 ? 'var(--green)' : '#ff4757'}">${savings >= 0 ? '+' : ''}${fmt(savings)}</p>
      <p class="analytics-card__sub">${monthLabel}</p>
    </div>
    <div class="analytics-card">
      <p class="analytics-card__title">${escHtml(tTotalTransactions)}</p>
      <p class="analytics-card__value">${txnCount}</p>
      <p class="analytics-card__sub">${currentLang === 'vi' ? 'giao dịch được ghi nhận' : (currentLang === 'zh' ? '笔已记录交易' : 'transactions recorded')} (${monthLabel})</p>
    </div>
  `;
}

function renderMonthSelector() {
  const labelEl = document.getElementById('monthPickerLabel');
  const gridEl = document.getElementById('monthPickerGrid');
  if (!gridEl) return;

  const now = new Date();
  const monthsList = [];
  
  // Generate the last 12 months (starting from current going back 11 months)
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthsList.push({
      month: d.getMonth(),
      year: d.getFullYear()
    });
  }

  const { month: activeMonth, year: activeYear } = currentMonthYear();
  const locale = currentLang === 'vi' ? 'vi-VN' : (currentLang === 'zh' ? 'zh-CN' : 'en-US');

  // Format active picker label
  const activeMonthDate = new Date(activeYear, activeMonth, 1);
  const activeMonthLabel = activeMonthDate.toLocaleString(locale, { month: 'short' }).toUpperCase() + ' ' + activeYear;
  if (labelEl) {
    labelEl.textContent = activeMonthLabel;
  }

  // Draw the 3x4 grid cells
  gridEl.innerHTML = monthsList.map(m => {
    const isActive = m.month === activeMonth && m.year === activeYear;
    const cellMonthDate = new Date(m.year, m.month, 1);
    const cellMonthName = cellMonthDate.toLocaleString(locale, { month: 'short' }).toUpperCase();
    const activeClass = isActive ? 'month-grid-cell--active' : '';

    return `
      <button class="month-grid-cell ${activeClass}" 
              role="tab" 
              aria-selected="${isActive ? 'true' : 'false'}"
              onclick="selectMonth(${m.month}, ${m.year})">
        <span class="month-grid-cell-name">${cellMonthName}</span>
        <span class="month-grid-cell-year" style="display: block; font-size: 8px; opacity: 0.6; margin-top: 2px;">${m.year}</span>
      </button>
    `;
  }).join('');
}

function selectMonth(month, year) {
  selectedMonthYear = { month, year };
  
  // Close the month picker dropdown
  const dropdown = document.getElementById('monthPickerDropdown');
  const trigger = document.getElementById('monthPickerTrigger');
  if (dropdown) dropdown.classList.remove('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');

  triggerUIUpdates();
}

function toggleMonthPicker(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('monthPickerDropdown');
  const trigger = document.getElementById('monthPickerTrigger');
  if (!dropdown || !trigger) return;

  const isOpen = dropdown.classList.toggle('open');
  trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  
  // Close custom selects
  Object.keys(customSelects).forEach(key => {
    const wrapper = document.getElementById(key + '_custom');
    if (wrapper) {
      wrapper.classList.remove('open');
      wrapper.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'false');
    }
  });
}

function renderMonthTxnFeed() {
  const feed = document.getElementById('monthTxnFeed');
  if (!feed) return;

  const { month, year } = currentMonthYear();

  // Filter transactions for the selected month/year
  let list = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });

  list = [...list].reverse(); // newest first

  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';
  const monthDate = new Date(year, month, 1);
  const monthName = monthDate.toLocaleString(locale, { month: 'short' }).toUpperCase();
  const monthLabel = monthName + ' ' + year;

  // Set header text dynamically
  const heading = document.getElementById('month-detail-title');
  if (heading) {
    heading.textContent = currentLang === 'vi' 
      ? `CHI TIẾT CHI TIÊU THÁNG ${month + 1}/${year}`
      : (currentLang === 'zh' ? `${year}年${month + 1}月消费明细` : `MONTH DETAIL — ${monthLabel}`);
  }

  if (list.length === 0) {
    feed.innerHTML = `
      <div class="txn-empty">
        ${currentLang === 'vi' ? 'Không có giao dịch nào trong tháng này.' : (currentLang === 'zh' ? '本月没有交易记录。' : 'No transactions recorded for this month.')}
      </div>`;
    return;
  }

  feed.innerHTML = list.map(txn => `
    <div class="txn-slot" data-id="${txn.id}" data-type="${txn.type}">
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

function openMonthDetailModal() {
  const modal = document.getElementById('monthDetailModal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderMonthTxnFeed();
}

function closeMonthDetailModal() {
  const modal = document.getElementById('monthDetailModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

function closeMonthDetailOnOverlay(e) {
  if (e.target === document.getElementById('monthDetailModal')) {
    closeMonthDetailModal();
  }
}

function triggerUIUpdates() {
  calcMetrics();
  renderFeed();
  renderBudgetPanel();
  updateChart();
  renderMonthSelector();
  updateAnalyticsSummary();
  renderMonthTxnFeed();
}

function changeTrendRange(months) {
  currentTrendRange = months;
  updateTrendChart();
}

function setTrendType(type) {
  currentTrendType = type;
  document.getElementById('trend-btn-bar').classList.toggle('active', type === 'bar');
  document.getElementById('trend-btn-line').classList.toggle('active', type === 'line');
  updateTrendChart();
}

function toggleCategoryChartType() {
  currentCategoryChartType = currentCategoryChartType === 'doughnut' ? 'polarArea' : 'doughnut';
  if (_categoryChart) {
    _categoryChart.destroy();
    _categoryChart = null;
  }
  updateChart();
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
  triggerUIUpdates();

  /* Show undo toast with dynamic closure */
  showUndoToast(t('deleteToast'), () => {
    if (!_deletedTxn) return;
    transactions.push(_deletedTxn);
    transactions.sort((a, b) => b.date.localeCompare(a.date));
    _deletedTxn = null;
    saveTransactions();
    triggerUIUpdates();
    showToast('↩ ' + t('undoSuccess'));
  });

  /* Start permanent-deletion timer */
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => {
    if (_deletedTxn) {
      syncDeleteTransactionFromServer(_deletedTxn.id);
    }
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
  triggerUIUpdates();
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
  updateCategoryDropdown('txnCat', 'expense');
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
  updateCategoryDropdown('txnCat', type);
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
  syncAddTransactionToServer(txn);
  closeModal();
  triggerUIUpdates();
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
  updateCategoryDropdown('qlCat', 'expense');
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
  updateCategoryDropdown('qlCat', type);
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
  syncAddTransactionToServer(txn);
  closeQuickLog();
  triggerUIUpdates();
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
  syncAddTransactionToServer(txn);
  closeNumpad();
  triggerUIUpdates();
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
    analyticsMonth: 'SELECT MONTH',
    viewMonthDetail: 'VIEW TRANSACTIONS DETAIL',
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
    trendPanel: 'Cash Flow Trends',
    range1M: '1 Month',
    range3M: '3 Months',
    range6M: '6 Months',
    range12M: '12 Months',
    week1: 'Week 1',
    week2: 'Week 2',
    week3: 'Week 3',
    week4: 'Week 4+',
    incomeLabel: 'Income',
    expenseLabel: 'Expense',
    navHome: 'DASHBOARD',
    navAnalytics: 'ANALYTICS',
    analyticsSummary: 'Analytics Summary',
    savingsRate: 'Savings Rate',
    topCategory: 'Top Category',
    netSavings: 'Net Savings',
    totalTransactions: 'Total Transactions',
    savingsGood: 'of total income saved',
    savingsNoIncome: 'No income logged',
    incomeVsExpense: 'Income minus Expense',
    allTimeTxns: 'transactions recorded',
    current: 'current',
    /* ── Guide modal ── */
    guideBadge: 'DOCS v2.0',
    guideTitle: 'CaltDHy',
    guideSub: '— User Guide',
    guideClose: 'Close',
    /* Tab labels */
    gTab_overview: '📊 Overview',
    gTab_txn: '💳 Transactions',
    gTab_budget: '🎯 Budgets',
    gTab_analytics: '📈 Analytics',
    gTab_settings: '⚙️ Settings',
    gTab_tips: '💡 Tips',
    /* Overview */
    gHeroTagline: 'Personal finance management — <strong>simple, fast, effective</strong>',
    gCard_dashboard_title: 'Dashboard',
    gCard_dashboard_desc: 'View balance, income and monthly spending at a glance on the main screen.',
    gCard_quicklog_title: 'Quick Log',
    gCard_quicklog_desc: 'Tap the ✏️ button at the bottom-right to log a transaction in 3 seconds.',
    gCard_budget_title: 'Budgets',
    gCard_budget_desc: 'Set per-category budgets and track spending with colour progress bars.',
    gCard_analytics_title: 'Analytics',
    gCard_analytics_desc: 'Cash-flow charts over time; spot income and expense trends by month.',
    gCard_backup_title: 'Backup',
    gCard_backup_desc: 'Export/import data as JSON to keep your data safe when switching devices.',
    gCard_lang_title: 'Multi-language',
    gCard_lang_desc: 'Supports Vietnamese (VI), English (EN) and Chinese (ZH).',
    gNoteOffline: 'CaltDHy works <strong>fully offline</strong> — data is saved in your browser; no internet needed after the first login.',
    /* Transactions tab */
    gTxn_title: '💳 Transaction Management',
    gStep1_title: 'Add a New Transaction',
    gStep1_desc: 'Tap <kbd>+ ADD TRANSACTION</kbd> in the left column, or use the <kbd>✏️ FAB</kbd> button (bottom-right) to open Quick Log even faster.',
    gStep2_title: 'Choose Transaction Type',
    gStep2_desc: 'Select <span class="guide-badge guide-badge--expense">EXPENSE</span> for spending or <span class="guide-badge guide-badge--income">INCOME</span> for earnings. The colour theme will change to distinguish them.',
    gStep3_title: 'Enter the Amount',
    gStep3_desc: 'Math expressions are supported! e.g. <code class="guide-code">50000+20000</code> auto-calculates to <code class="guide-code">70,000 ₫</code>.',
    gStep4_title: 'Select Category & Date',
    gStep4_desc: 'Choose the relevant category (Food, Transport, Shopping…) and the transaction date. Defaults to today.',
    gStep5_title: 'Delete / Undo',
    gStep5_desc: 'Tap <kbd>✕</kbd> on any transaction to delete it. An <strong>UNDO</strong> notification appears for 5 seconds in case of an accidental tap.',
    gTxnTip: '<strong>Quick tip:</strong> The <kbd>+</kbd> button on the <em>Total Balance</em> card opens a numeric keypad for recording income instantly.',
    /* Budgets tab */
    gBudget_title: '🎯 Budget Management (Envelope Method)',
    gBudget_intro: 'CaltDHy uses <strong>Envelope Budgeting</strong> — divide your budget into specific category "envelopes".',
    gBudgetStep1_title: 'Set Budgets',
    gBudgetStep1_desc: 'Tap <kbd>SET BUDGETS</kbd> on the Dashboard or inside Settings. Enter a monthly spending limit for each category.',
    gBudgetStep2_title: 'Track Progress Bars',
    gBudgetStep2_desc: 'Each budget card shows a colour bar: <span style="color:#10B981">■ Green</span> (safe), <span style="color:#F59E0B">■ Yellow</span> (near limit), <span style="color:#FF4B72">■ Red</span> (over budget).',
    gBudgetStep3_title: 'Add Custom Categories',
    gBudgetStep3_desc: 'Inside Budget Modal, scroll to <strong>+ Add Custom Category</strong> to create personal categories (e.g. Tuition, Travel…).',
    gBudgetStep4_title: 'Limit = 0',
    gBudgetStep4_desc: 'Setting limit to <code class="guide-code">0</code> means <em>track but no cap</em> — the card still shows but won\'t warn about overspending.',
    gBudgetWarning: 'Budgets reset to <strong>0 spending</strong> at the start of each new month. Transaction history is preserved.',
    /* Analytics tab */
    gAnalytics_title: '📈 Analytics Page',
    gAnalytics_intro: 'Switch to the <kbd>ANALYTICS</kbd> tab in the top navigation to see detailed cash-flow analysis.',
    gFeat1_title: 'Bar / Line Chart',
    gFeat1_desc: 'Toggle between Bar and Line chart types using the buttons on the right. Visualise income and expenses month by month.',
    gFeat2_title: 'Time Range',
    gFeat2_desc: 'Filter by <strong>1 Month</strong>, <strong>3 Months</strong>, <strong>6 Months</strong> or <strong>12 Months</strong> using the left-hand dropdown.',
    gFeat3_title: 'Category Doughnut',
    gFeat3_desc: 'The left sidebar displays category spending breakdown for the selected month (click the button at the bottom of the chart to view detailed records).',
    gFeat4_title: 'Analytics Summary',
    gFeat4_desc: 'Below the chart, summary cards show average monthly figures, the highest-spend month, the most frugal month, and more.',
    gFeat5_title: 'Month Picker Grid',
    gFeat5_desc: 'Click the date dropdown trigger (e.g. "MAY 2026 ▾") at the top to open a 3x4 grid for switching between the last 12 rolling months.',
    /* Settings tab */
    gSettings_title: '⚙️ Settings & Customisation',
    gSettings_intro: 'Tap the <strong>Settings</strong> (⚙️) button in the top bar to open settings.',
    gRow_lang_key: '🌐 Language',
    gRow_lang_val: 'Choose EN / VI / ZH — the interface switches instantly without a reload.',
    gRow_theme_key: '🎨 Appearance',
    gRow_theme_val: '4 themes: <strong>Dark</strong> (default), <strong>Light</strong>, <strong>Cream</strong>, <strong>Sky</strong>. Changes are auto-saved.',
    gRow_curr_key: '💰 Currency',
    gRow_curr_val: 'Display as VND ₫, USD $, or CNY ¥. Fixed rates: 1 USD = 27,000 ₫, 1 CNY = 3,750 ₫.',
    gRow_export_key: '💾 Export Data',
    gRow_export_val: '<strong>EXPORT JSON</strong> — download a backup file of all transactions and budgets.',
    gRow_import_key: '📥 Import Data',
    gRow_import_val: '<strong>IMPORT JSON</strong> — select a backup file to restore data. <span style="color:var(--accent)">Overwrites current data!</span>',
    /* Tips tab */
    gTips_title: '💡 Tips & Tricks',
    gTip1_title: 'Math Expressions',
    gTip1_desc: 'Type <code class="guide-code">30000*3+15000</code> in the amount field — CaltDHy calculates it for you.',
    gTip2_title: 'Quick Deposit',
    gTip2_desc: 'Tap <strong>+</strong> on the Total Balance card to open a numeric keypad for lightning-fast income entry.',
    gTip3_title: 'Regular Backups',
    gTip3_desc: 'Export JSON at least once a week. Data is stored in localStorage — clearing browser cache will delete it.',
    gTip4_title: 'Filter Transactions',
    gTip4_desc: 'Use the <kbd>ALL</kbd> / <kbd>INCOME</kbd> / <kbd>EXPENSE</kbd> buttons to quickly filter the transaction list.',
    gTip5_title: 'Install as App',
    gTip5_desc: 'On mobile: <em>Share → Add to Home Screen</em> to install CaltDHy as a native-like app (PWA).',
    gTip6_title: 'Switch Theme Fast',
    gTip6_desc: 'Settings → Appearance → pick a theme. The change takes effect instantly across the entire interface.',
    gTipsNote: '<strong>Get started:</strong> Close this window and tap <kbd>+ ADD TRANSACTION</kbd> to log your first transaction!',
    /* Footer */
    gFooterClose: 'Close Guide ✕',
  },
  vi: {
    analyticsMonth: 'CHỌN THÁNG',
    viewMonthDetail: 'XEM CHI TIẾT GIAO DỊCH',
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
    trendPanel: 'Xu Hướng Thu Chi',
    range1M: '1 Tháng',
    range3M: '3 Tháng',
    range6M: '6 Tháng',
    range12M: '12 Tháng',
    week1: 'Tuần 1',
    week2: 'Tuần 2',
    week3: 'Tuần 3',
    week4: 'Tuần 4+',
    incomeLabel: 'Thu nhập',
    expenseLabel: 'Chi tiêu',
    navHome: 'TRANG CHỦ',
    navAnalytics: 'PHÂN TÍCH',
    analyticsSummary: 'Tóm Tắt Phân Tích',
    savingsRate: 'Tỷ Lệ Tích Lũy',
    topCategory: 'Chi Nhiều Nhất',
    netSavings: 'Tích Lũy Ròng',
    totalTransactions: 'Tổng Giao Dịch',
    savingsGood: 'trong tổng thu nhập',
    savingsNoIncome: 'Chưa có thu nhập',
    incomeVsExpense: 'Thu nhập trừ Chi tiêu',
    allTimeTxns: 'giao dịch được ghi nhận',
    current: 'hiện tại',
    /* ── Guide modal ── */
    guideBadge: 'TÀI LIỆU v2.0',
    guideTitle: 'CaltDHy',
    guideSub: '— Hướng Dẫn Sử Dụng',
    guideClose: 'Đóng',
    /* Tab labels */
    gTab_overview: '📊 Tổng Quan',
    gTab_txn: '💳 Giao Dịch',
    gTab_budget: '🎯 Ngân Sách',
    gTab_analytics: '📈 Phân Tích',
    gTab_settings: '⚙️ Cài Đặt',
    gTab_tips: '💡 Mẹo Hay',
    /* Overview */
    gHeroTagline: 'Hệ thống quản lý tài chính cá nhân — <strong>đơn giản, nhanh chóng, hiệu quả</strong>',
    gCard_dashboard_title: 'Dashboard',
    gCard_dashboard_desc: 'Xem tổng quan số dư, thu nhập và chi tiêu theo tháng ngay trên màn hình chính.',
    gCard_quicklog_title: 'Quick Log',
    gCard_quicklog_desc: 'Bấm nút ✏️ góc phải dưới để ghi giao dịch nhanh chỉ trong 3 giây.',
    gCard_budget_title: 'Ngân Sách',
    gCard_budget_desc: 'Đặt ngân sách theo danh mục, theo dõi mức độ chi tiêu bằng thanh tiến độ màu sắc.',
    gCard_analytics_title: 'Phân Tích',
    gCard_analytics_desc: 'Biểu đồ dòng tiền theo thời gian, phân tích xu hướng thu chi theo tháng.',
    gCard_backup_title: 'Sao Lưu',
    gCard_backup_desc: 'Xuất/nhập dữ liệu dưới dạng JSON để bảo toàn dữ liệu khi đổi thiết bị.',
    gCard_lang_title: 'Đa Ngôn Ngữ',
    gCard_lang_desc: 'Hỗ trợ tiếng Việt (VI), tiếng Anh (EN) và tiếng Trung (ZH).',
    gNoteOffline: 'CaltDHy hoạt động <strong>offline hoàn toàn</strong> — dữ liệu lưu trong trình duyệt của bạn, không cần internet sau lần đăng nhập đầu tiên.',
    /* Transactions tab */
    gTxn_title: '💳 Quản Lý Giao Dịch',
    gStep1_title: 'Thêm Giao Dịch Mới',
    gStep1_desc: 'Bấm nút <kbd>+ THÊM GIAO DỊCH</kbd> ở cột trái, hoặc dùng <kbd>✏️ FAB</kbd> (nút bút chì góc phải màn hình) để mở Quick Log nhanh hơn.',
    gStep2_title: 'Chọn Loại Giao Dịch',
    gStep2_desc: 'Chọn <span class="guide-badge guide-badge--expense">CHI TIÊU</span> cho chi tiêu hoặc <span class="guide-badge guide-badge--income">THU NHẬP</span> cho thu nhập. Màu sắc sẽ thay đổi để phân biệt.',
    gStep3_title: 'Nhập Số Tiền',
    gStep3_desc: 'Hỗ trợ nhập biểu thức toán học! Ví dụ: <code class="guide-code">50000+20000</code> sẽ tự động tính thành <code class="guide-code">70,000 ₫</code>.',
    gStep4_title: 'Chọn Danh Mục & Ngày',
    gStep4_desc: 'Chọn danh mục phù hợp (Ăn uống, Di chuyển, Mua sắm…) và ngày giao dịch. Ngày mặc định là hôm nay.',
    gStep5_title: 'Xóa / Hoàn Tác',
    gStep5_desc: 'Bấm <kbd>✕</kbd> trên mỗi giao dịch để xóa. Một thông báo <strong>HOÀN TÁC</strong> sẽ xuất hiện trong 5 giây để hoàn tác nếu nhỡ tay.',
    gTxnTip: '<strong>Mẹo nhanh:</strong> Nút <kbd>+</kbd> trên thẻ <em>Tổng Số Dư</em> mở màn hình nạp tiền số (numpad) để ghi thu nhập nhanh.',
    /* Budgets tab */
    gBudget_title: '🎯 Quản Lý Ngân Sách (Envelope Method)',
    gBudget_intro: 'CaltDHy sử dụng phương pháp <strong>Envelope Budgeting</strong> — phân chia ngân sách theo từng "phong bì" danh mục cụ thể.',
    gBudgetStep1_title: 'Đặt Ngân Sách',
    gBudgetStep1_desc: 'Bấm <kbd>ĐẶT NGÂN SÁCH</kbd> trên Dashboard hoặc trong Cài Đặt. Nhập giới hạn chi tiêu theo tháng cho từng danh mục.',
    gBudgetStep2_title: 'Theo Dõi Thanh Tiến Độ',
    gBudgetStep2_desc: 'Mỗi thẻ ngân sách có thanh tiến độ màu: <span style="color:#10B981">■ Xanh</span> (an toàn), <span style="color:#F59E0B">■ Vàng</span> (gần đủ), <span style="color:#FF4B72">■ Đỏ</span> (vượt giới hạn).',
    gBudgetStep3_title: 'Thêm Danh Mục Tùy Chỉnh',
    gBudgetStep3_desc: 'Trong Budget Modal, cuộn xuống phần <strong>+ Thêm Danh Mục Mới</strong> để tạo danh mục riêng (ví dụ: Học Phí, Du Lịch…).',
    gBudgetStep4_title: 'Giới Hạn = 0',
    gBudgetStep4_desc: 'Đặt giới hạn <code class="guide-code">0</code> nghĩa là <em>theo dõi nhưng không giới hạn</em> — vẫn hiện thẻ ngân sách nhưng không cảnh báo vượt mức.',
    gBudgetWarning: 'Ngân sách được reset về <strong>0 chi tiêu</strong> vào đầu mỗi tháng. Lịch sử giao dịch vẫn được giữ nguyên.',
    /* Analytics tab */
    gAnalytics_title: '📈 Trang Phân Tích (Analytics)',
    gAnalytics_intro: 'Chuyển sang tab <kbd>PHÂN TÍCH</kbd> trên thanh điều hướng để xem phân tích dòng tiền chi tiết.',
    gFeat1_title: 'Biểu Đồ Cột / Đường',
    gFeat1_desc: 'Chọn kiểu biểu đồ Bar hoặc Line bằng các nút góc phải. Trực quan hóa thu/chi theo từng tháng.',
    gFeat2_title: 'Khoảng Thời Gian',
    gFeat2_desc: 'Lọc theo <strong>1 tháng</strong>, <strong>3 tháng</strong>, <strong>6 tháng</strong> hoặc <strong>12 tháng</strong> bằng dropdown bên trái.',
    gFeat3_title: 'Biểu Đồ Tròn Danh Mục',
    gFeat3_desc: 'Cột trái (sidebar) hiển thị phân bổ chi tiêu theo danh mục của tháng đang chọn (bấm nút sát viền dưới biểu đồ để xem chi tiết danh sách giao dịch).',
    gFeat4_title: 'Analytics Summary',
    gFeat4_desc: 'Phần bên dưới biểu đồ hiển thị các chỉ số tổng hợp: trung bình tháng, tháng chi nhiều nhất, tháng tiết kiệm nhất…',
    gFeat5_title: 'Lưới Chọn Tháng',
    gFeat5_desc: 'Bấm vào ô hiển thị tháng ở góc trên bên phải để mở lưới chọn tháng 3x4, giúp đổi nhanh dữ liệu hiển thị của tháng bất kỳ.',
    /* Settings tab */
    gSettings_title: '⚙️ Cài Đặt & Tùy Chỉnh',
    gSettings_intro: 'Bấm nút <strong>Cài Đặt</strong> (⚙️) trên thanh trên để mở cài đặt.',
    gRow_lang_key: '🌐 Ngôn Ngữ',
    gRow_lang_val: 'Chọn EN / VI / ZH — giao diện đổi ngay lập tức, không cần reload.',
    gRow_theme_key: '🎨 Giao Diện',
    gRow_theme_val: '4 theme: <strong>Dark</strong> (mặc định), <strong>Light</strong>, <strong>Cream</strong>, <strong>Sky</strong>. Thay đổi lưu tự động.',
    gRow_curr_key: '💰 Tiền Tệ',
    gRow_curr_val: 'Hiển thị theo VND ₫, USD $, hoặc CNY ¥. Tỉ lệ quy đổi cố định: 1 USD = 27,000 ₫, 1 CNY = 3,750 ₫.',
    gRow_export_key: '💾 Xuất Dữ Liệu',
    gRow_export_val: '<strong>EXPORT JSON</strong> — tải về file backup toàn bộ giao dịch và ngân sách.',
    gRow_import_key: '📥 Nhập Dữ Liệu',
    gRow_import_val: '<strong>IMPORT JSON</strong> — chọn file backup để phục hồi dữ liệu. <span style="color:var(--accent)">Sẽ ghi đè dữ liệu hiện tại!</span>',
    /* Tips tab */
    gTips_title: '💡 Mẹo & Thủ Thuật',
    gTip1_title: 'Biểu Thức Toán Học',
    gTip1_desc: 'Nhập <code class="guide-code">30000*3+15000</code> vào ô số tiền — CaltDHy tự tính cho bạn.',
    gTip2_title: 'Quick Deposit',
    gTip2_desc: 'Bấm <strong>+</strong> trên thẻ Tổng Số Dư để mở bàn phím số ghi thu nhập cực nhanh.',
    gTip3_title: 'Sao Lưu Định Kỳ',
    gTip3_desc: 'Export JSON ít nhất 1 lần/tuần. Dữ liệu lưu trong localStorage — xóa cache trình duyệt sẽ mất dữ liệu.',
    gTip4_title: 'Lọc Giao Dịch',
    gTip4_desc: 'Dùng các nút <kbd>TẤT CẢ</kbd> / <kbd>THU NHẬP</kbd> / <kbd>CHI TIÊU</kbd> để lọc nhanh danh sách.',
    gTip5_title: 'Cài Làm App',
    gTip5_desc: 'Trên mobile: <em>Share → Add to Home Screen</em> để cài CaltDHy như một ứng dụng gốc (PWA).',
    gTip6_title: 'Đổi Theme Nhanh',
    gTip6_desc: 'Cài Đặt → Giao Diện → chọn theme ngay. Thay đổi có hiệu lực tức thì trên toàn bộ giao diện.',
    gTipsNote: '<strong>Bắt đầu ngay:</strong> Đóng cửa sổ này và bấm <kbd>+ THÊM GIAO DỊCH</kbd> để ghi giao dịch đầu tiên của bạn!',
    /* Footer */
    gFooterClose: 'Đóng Hướng Dẫn ✕',
  },
  zh: {
    analyticsMonth: '选择月份',
    viewMonthDetail: '查看本月交易',
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
    trendPanel: '现金流趋势',
    range1M: '1 个月',
    range3M: '3 个月',
    range6M: '6 个月',
    range12M: '12 个月',
    week1: '第一周',
    week2: '第二周',
    week3: '第三周',
    week4: '第四周+',
    incomeLabel: '收入',
    expenseLabel: '支出',
    current: '当前',
    /* ── Guide modal ── */
    guideBadge: '文档 v2.0',
    guideTitle: 'CaltDHy',
    guideSub: '— 使用指南',
    guideClose: '关闭',
    /* Tab labels */
    gTab_overview: '📊 总览',
    gTab_txn: '💳 交易',
    gTab_budget: '🎯 预算',
    gTab_analytics: '📈 分析',
    gTab_settings: '⚙️ 设置',
    gTab_tips: '💡 技巧',
    /* Overview */
    gHeroTagline: '个人财务管理系统 — <strong>简单、快速、高效</strong>',
    gCard_dashboard_title: '仪表盘',
    gCard_dashboard_desc: '在主屏幕上一目了然地查看余额、收入和本月支出。',
    gCard_quicklog_title: '快速记录',
    gCard_quicklog_desc: '点击右下角的 ✏️ 按钮，3 秒内完成交易记录。',
    gCard_budget_title: '预算',
    gCard_budget_desc: '按分类设置预算，通过彩色进度条跟踪支出情况。',
    gCard_analytics_title: '分析',
    gCard_analytics_desc: '按时间段查看现金流图表，分析月度收支趋势。',
    gCard_backup_title: '备份',
    gCard_backup_desc: '以 JSON 格式导出/导入数据，更换设备时保护您的数据。',
    gCard_lang_title: '多语言',
    gCard_lang_desc: '支持越南语（VI）、英语（EN）和中文（ZH）。',
    gNoteOffline: 'CaltDHy <strong>完全离线运行</strong> — 数据保存在浏览器中，首次登录后无需网络连接。',
    /* Transactions tab */
    gTxn_title: '💳 交易管理',
    gStep1_title: '添加新交易',
    gStep1_desc: '点击左列的 <kbd>添加交易</kbd> 按钮，或使用右下角的 <kbd>✏️ 快捷键</kbd> 快速打开记录窗口。',
    gStep2_title: '选择交易类型',
    gStep2_desc: '选择 <span class="guide-badge guide-badge--expense">支出</span> 或 <span class="guide-badge guide-badge--income">收入</span>，颜色主题会随之变化以作区分。',
    gStep3_title: '输入金额',
    gStep3_desc: '支持数学表达式！例如 <code class="guide-code">50000+20000</code> 将自动计算为 <code class="guide-code">70,000 ₫</code>。',
    gStep4_title: '选择分类和日期',
    gStep4_desc: '选择合适的分类（餐饮、交通、购物…）和交易日期，默认为今天。',
    gStep5_title: '删除 / 撤销',
    gStep5_desc: '点击任意交易上的 <kbd>✕</kbd> 可删除。5 秒内会显示 <strong>撤销</strong> 提示，防止误操作。',
    gTxnTip: '<strong>快速提示：</strong>点击 <em>总余额</em> 卡片上的 <kbd>+</kbd> 按钮，打开数字键盘快速记录收入。',
    /* Budgets tab */
    gBudget_title: '🎯 预算管理（信封法）',
    gBudget_intro: 'CaltDHy 使用<strong>信封预算法</strong>——将预算按特定分类「信封」进行分配。',
    gBudgetStep1_title: '设置预算',
    gBudgetStep1_desc: '在仪表盘或设置中点击 <kbd>设置预算</kbd>，为每个分类输入每月支出上限。',
    gBudgetStep2_title: '查看进度条',
    gBudgetStep2_desc: '每张预算卡片显示彩色进度条：<span style="color:#10B981">■ 绿色</span>（安全），<span style="color:#F59E0B">■ 黄色</span>（接近上限），<span style="color:#FF4B72">■ 红色</span>（超出预算）。',
    gBudgetStep3_title: '添加自定义分类',
    gBudgetStep3_desc: '在预算弹窗中，滚动到 <strong>+ 添加自定义分类</strong> 部分，创建个人分类（如：学费、旅行…）。',
    gBudgetStep4_title: '上限 = 0',
    gBudgetStep4_desc: '将上限设为 <code class="guide-code">0</code> 表示<em>仅追踪，不设上限</em>——预算卡片仍会显示，但不会发出超支警告。',
    gBudgetWarning: '预算在每月初自动重置为 <strong>0 支出</strong>，交易历史记录保持不变。',
    /* Analytics tab */
    gAnalytics_title: '📈 分析页面',
    gAnalytics_intro: '点击顶部导航中的 <kbd>分析</kbd> 标签，查看详细的现金流分析。',
    gFeat1_title: '柱状图 / 折线图',
    gFeat1_desc: '使用右上角的按钮切换柱状图或折线图，按月可视化收入和支出。',
    gFeat2_title: '时间范围',
    gFeat2_desc: '通过左侧下拉菜单按 <strong>1 个月</strong>、<strong>3 个月</strong>、<strong>6 个月</strong>或 <strong>12 个月</strong> 筛选数据。',
    gFeat3_title: '分类圆环图',
    gFeat3_desc: '左侧栏显示所选月份的分类支出圆环图（点击图表底部的按钮即可查看完整的交易明细）。',
    gFeat4_title: '分析摘要',
    gFeat4_desc: '图表下方的摘要卡片显示月均数据、支出最高月份、最节省月份等综合指标。',
    gFeat5_title: '月份网格选择器',
    gFeat5_desc: '点击右上角的月份按钮（如 “5月 2026 ▾”）即可展开 3x4 布局 of 12 个月网格进行快速切换。',
    /* Settings tab */
    gSettings_title: '⚙️ 设置与自定义',
    gSettings_intro: '点击顶栏中的<strong>设置</strong>（⚙️）按钮打开设置。',
    gRow_lang_key: '🌐 语言',
    gRow_lang_val: '选择 EN / VI / ZH — 界面立即切换，无需刷新。',
    gRow_theme_key: '🎨 外观',
    gRow_theme_val: '4 种主题：<strong>深色</strong>（默认）、<strong>浅色</strong>、<strong>奶油色</strong>、<strong>天蓝色</strong>。更改自动保存。',
    gRow_curr_key: '💰 货币',
    gRow_curr_val: '以 VND ₫、USD $ 或 CNY ¥ 显示。固定汇率：1 USD = 27,000 ₫，1 CNY = 3,750 ₫。',
    gRow_export_key: '💾 导出数据',
    gRow_export_val: '<strong>导出 JSON</strong> — 下载包含所有交易和预算的备份文件。',
    gRow_import_key: '📥 导入数据',
    gRow_import_val: '<strong>导入 JSON</strong> — 选择备份文件以恢复数据。<span style="color:var(--accent)">将覆盖当前数据！</span>',
    /* Tips tab */
    gTips_title: '💡 技巧与窍门',
    gTip1_title: '数学表达式',
    gTip1_desc: '在金额栏输入 <code class="guide-code">30000*3+15000</code>，CaltDHy 会自动计算结果。',
    gTip2_title: '快速存款',
    gTip2_desc: '点击总余额卡片上的 <strong>+</strong> 按钮，打开数字键盘快速记录收入。',
    gTip3_title: '定期备份',
    gTip3_desc: '至少每周导出一次 JSON 备份。数据存储在 localStorage 中，清除浏览器缓存会导致数据丢失。',
    gTip4_title: '筛选交易',
    gTip4_desc: '使用 <kbd>全部</kbd> / <kbd>收入</kbd> / <kbd>支出</kbd> 按钮快速筛选交易列表。',
    gTip5_title: '安装为应用',
    gTip5_desc: '在手机上：<em>分享 → 添加到主屏幕</em>，将 CaltDHy 安装为原生应用（PWA）。',
    gTip6_title: '快速切换主题',
    gTip6_desc: '设置 → 外观 → 选择主题。更改立即在整个界面生效。',
    gTipsNote: '<strong>立即开始：</strong>关闭此窗口，点击 <kbd>添加交易</kbd> 记录您的第一笔交易！',
    /* Footer */
    gFooterClose: '关闭指南 ✕',
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
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = t(key);
    } else {
      if (key.startsWith('g') || key.startsWith('guide')) {
        el.innerHTML = t(key);
      } else {
        el.textContent = t(key);
      }
    }
  });
  // Sync active lang button
  ['en', 'vi', 'zh'].forEach(code => {
    const btn = document.getElementById('lang-' + code);
    if (btn) btn.classList.toggle('lang-btn--active', code === currentLang);
  });
  // Full re-render so ALL dynamic text (categories, feed vocab, monthly lists) updates
  triggerUIUpdates();
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
  triggerUIUpdates();
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

  /* Force charts to redraw with new theme colors */
  updateChart();
  updateTrendChart();
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

  /* Initialize premium custom selects */
  initCustomDropdown('txnCat');
  initCustomDropdown('qlCat');

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
window.changeTrendRange = changeTrendRange;
window.setTrendType = setTrendType;
window.toggleCategoryChartType = toggleCategoryChartType;
window.switchView = switchView;
window.selectMonth = selectMonth;
window.renderMonthSelector = renderMonthSelector;
window.toggleMonthPicker = toggleMonthPicker;
window.renderMonthTxnFeed = renderMonthTxnFeed;
window.triggerUIUpdates = triggerUIUpdates;
window.openMonthDetailModal = openMonthDetailModal;
window.closeMonthDetailModal = closeMonthDetailModal;
window.closeMonthDetailOnOverlay = closeMonthDetailOnOverlay;

/* ============================================================
   USER GUIDE MODAL
   ============================================================ */

/**
 * Opens the User Guide modal with a smooth fade-in.
 */
function openGuide() {
  const overlay = document.getElementById('guideModal');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Trap focus inside the panel
  const panel = overlay.querySelector('.guide-panel');
  if (panel) {
    const focusables = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length) focusables[0].focus();
  }
}

/**
 * Closes the User Guide modal.
 */
function closeGuide() {
  const overlay = document.getElementById('guideModal');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  // Return focus to the help button
  const btn = document.getElementById('btnHelp');
  if (btn) btn.focus();
}

/**
 * Closes guide if user clicks outside the panel.
 */
function closeGuideOnOverlay(event) {
  if (event.target === document.getElementById('guideModal')) {
    closeGuide();
  }
}

/**
 * Switches the active guide tab section.
 * @param {string} key  — Section key, e.g. 'overview', 'txn', etc.
 * @param {HTMLElement} clickedBtn — The tab button that was clicked.
 */
function switchGuideTab(key, clickedBtn) {
  // Deactivate all tabs
  document.querySelectorAll('.guide-tab').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  // Deactivate all sections
  document.querySelectorAll('.guide-section').forEach(sec => {
    sec.classList.remove('active');
  });

  // Activate clicked tab
  if (clickedBtn) {
    clickedBtn.classList.add('active');
    clickedBtn.setAttribute('aria-selected', 'true');
  }

  // Activate matching section
  const sec = document.getElementById('gsec-' + key);
  if (sec) {
    sec.classList.add('active');
    // Scroll body to top when switching tab
    const body = document.querySelector('.guide-body');
    if (body) body.scrollTop = 0;
  }
}

// Close guide on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('guideModal');
    if (overlay && overlay.classList.contains('open')) {
      closeGuide();
    }
  }
});

// Export to window
window.openGuide = openGuide;
window.closeGuide = closeGuide;
window.closeGuideOnOverlay = closeGuideOnOverlay;
window.switchGuideTab = switchGuideTab;

