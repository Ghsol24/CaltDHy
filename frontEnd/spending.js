/* ============================================================
   CaltDHy — spending.js
   Expense Management Logic
   ============================================================ */

'use strict';

/* ── Constants ── */
const STORAGE_KEY = 'caltdhy_txns';
const BUDGET_KEY = 'caltdhy_budgets';
const CUSTOM_CATS_KEY = 'caltdhy_custom_cats';
const HIDDEN_CATS_KEY  = 'caltdhy_hidden_cats'; // danh mục mặc định bị ẩn
const CAT_ORDER_KEY    = 'caltdhy_cat_order';   // thứ tự danh mục do user tùy chỉnh
const THEME_KEY = 'caltdhy_theme';
const BALANCE_RESET_KEY = 'caltdhy_balance_reset_mode'; // 'keep' | 'reset'
const EXCHANGE_RATE = 27000;  // 1 USD = 27,000 VND
const CNY_RATE = 3750;   // 1 CNY = 3,750 VND
const CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Health', 'Utilities', 'Salary', 'Freelance', 'Installment', 'Other'
];
const CAT_ICONS = {
  'Food & Dining': '🍜', 'Transport': '🚗', 'Shopping': '🛍️',
  'Entertainment': '🎦', 'Health': '💊', 'Utilities': '⚡',
  'Salary': '💵', 'Freelance': '💻', 'Installment': '💳', 'Other': '📦'
};

/* ── State ── */
let transactions = [];
let budgets = {};   // { 'Food & Dining': 2000000, ... } — limits in VND
let customCategories = []; // extra user-defined category names — stored as { name, type } objects internally
let hiddenDefaultCategories = []; // default cats hidden by user (soft-hide, not deleted)
let currentFilter = 'all';
let currentPeriodFilter = 'month'; // 'month' or 'all'
let compareMonthYear = null;
let currentType = 'expense';
let currentCurrency = 'VND'; // 'VND' | 'USD' | 'CNY'
let toastTimer = null;
let selectedMonthYear = null;
let currentSort = 'date-desc'; // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
let balanceResetMode = 'keep'; // 'keep' = lũy kế tất cả | 'reset' = chỉ tính tháng hiện tại
let newCatType = 'expense'; // type selected in "Add Custom Category" row
let categoryOrder = []; // user-customized category display order (array of category names)
let currentReportTab = 'month'; // 'month' | 'quarter' | 'year' — active tab in wrapup modal
let _wrapupIsManual = false;  // true when opened manually via btn (hides reset box)

/* ── Interactive Charts State ── */
let currentTrendRange = 1;  // 1 | 3 | 6 | 12 (months)
let currentTrendType = 'bar'; // 'bar' | 'line'
let currentCategoryChartType = 'doughnut'; // 'doughnut' | 'polarArea'
let _trendChart = null; // trend chart instance
let currentView = 'home'; // 'home' | 'analytics'

/* ── Category helpers ── */

/**
 * Parse raw stored array → normalize each item to { name: string, type: 'expense'|'income' }
 * Supports legacy string items (type defaults to 'expense' for backward compat).
 */
function parseCategories(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') {
      // Legacy format: try parse JSON string first, then treat as plain name
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed.name === 'string') return { name: parsed.name.trim(), type: parsed.type === 'income' ? 'income' : 'expense' };
      } catch (_) {}
      return { name: item.trim(), type: 'expense' };
    }
    if (typeof item === 'object' && item !== null && typeof item.name === 'string') {
      return { name: item.name.trim(), type: item.type === 'income' ? 'income' : 'expense' };
    }
    return null;
  }).filter(Boolean);
}

/**
 * Serialize category objects → string[] for localStorage and server (JSON-encoded objects).
 * This keeps the server schema [String] while encoding the type info inside.
 */
function serializeCategories(arr) {
  return arr.map(c => JSON.stringify({ name: c.name, type: c.type }));
}

/** Returns the type ('expense'|'income') of a named category (default or custom). */
function getCategoryType(catName) {
  const DEFAULT_INCOME = ['Salary', 'Freelance'];
  if (DEFAULT_INCOME.includes(catName)) return 'income';
  const found = customCategories.find(c => c.name === catName);
  return found ? found.type : 'expense';
}

/** Returns default + custom category NAMES merged, excluding hidden defaults */
function getAllCategories() {
  const all = CATEGORIES.filter(c => !hiddenDefaultCategories.includes(c));
  customCategories.forEach(c => { if (!all.includes(c.name)) all.push(c.name); });

  // Sort by user-defined order if available
  if (categoryOrder.length > 0) {
    all.sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      // Known items come first in their custom order; unknown items stay at end
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

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

  // Pre-compute per-category spending for budget badges (only if data is ready)
  let monthlySpent = {};
  try {
    if (typeof calcCategorySpend === 'function' && typeof budgets !== 'undefined') {
      monthlySpent = calcCategorySpend();
    }
  } catch (_) { /* data not yet initialised */ }

  // Populate options dropdown
  dropdown.innerHTML = options.map((opt, index) => {
    const value = opt.value;
    const text = opt.textContent;
    const icon = CAT_ICONS[value] || '📦';
    const isSelected = index === selectedIndex;

    // Build budget badge (only for expense categories with a budget set)
    let budgetBadge = '';
    let isOverBudget = false;
    let overAmt = 0;
    try {
      const limit = (typeof budgets !== 'undefined') ? (budgets[value] || 0) : 0;
      const isExpenseCat = typeof getCategoryType === 'function'
        ? getCategoryType(value) === 'expense'
        : true;

      if (limit > 0 && isExpenseCat) {
        const spentAmt = monthlySpent[value] || 0;
        const remaining = limit - spentAmt;
        const pct = spentAmt / limit;
        const overBudget = remaining < 0;
        const nearLimit  = !overBudget && pct >= 0.8;

        if (overBudget) {
          // Over-budget: show red badge with ⚠️ icon — row stays fully clickable
          isOverBudget = true;
          overAmt = Math.abs(remaining);
          budgetBadge = `<span class="custom-select-budget-badge badge--over">⚠️ ${fmt(overAmt)} ${t('budgetOver')}</span>`;
        } else {
          const badgeCls = nearLimit ? 'badge--warn' : 'badge--ok';
          const badgeLabel = `${fmt(remaining)} ${t('budgetLeft')}`;
          budgetBadge = `<span class="custom-select-budget-badge ${badgeCls}">${badgeLabel}</span>`;
        }
      }
    } catch (_) { /* gracefully skip if helpers not ready */ }

    return `
      <div class="custom-select-option ${isSelected ? 'selected' : ''}" 
           data-value="${escHtml(value)}"
           data-over-budget="${isOverBudget ? '1' : '0'}"
           role="option" 
           tabIndex="0"
           aria-selected="${isSelected ? 'true' : 'false'}">
        <div class="custom-select-option-left">
          <span class="custom-select-icon">${icon}</span>
          <span class="custom-select-option-text">${escHtml(text)}</span>
        </div>
        ${budgetBadge}
      </div>
    `;
  }).join('');

  // ── Event listeners ────────────────────────────────────────────────────────

  const optElements = dropdown.querySelectorAll('.custom-select-option');
  optElements.forEach(optEl => {

    // All rows are now clickable (no locked row paradigm)
    optEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = optEl.getAttribute('data-value');
      const isOver = optEl.getAttribute('data-over-budget') === '1';
      nativeSelect.value = val;
      nativeSelect.dispatchEvent(new Event('change'));
      wrapper.classList.remove('open');
      wrapper.querySelector('.custom-select-trigger').setAttribute('aria-expanded', 'false');
      syncCustomDropdown(selectId);

      // Show / hide inline warning card below the custom-select wrapper
      _showBudgetInlineWarning(wrapper, isOver);
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

/**
 * Show or remove the inline budget warning card below the given custom-select wrapper.
 * @param {HTMLElement} wrapper - the .custom-select element
 * @param {boolean}     show   - true = over-budget category was selected
 */
function _showBudgetInlineWarning(wrapper, show) {
  // Remove any existing warning card first
  const existing = wrapper.parentNode.querySelector('.budget-inline-warning');
  if (existing) existing.remove();

  if (!show) return;

  const card = document.createElement('div');
  card.className = 'budget-inline-warning';
  card.setAttribute('role', 'alert');
  card.setAttribute('aria-live', 'polite');
  card.innerHTML = `
    <span class="budget-inline-warning__icon">⚠️</span>
    <span class="budget-inline-warning__text">${escHtml(t('overBudgetTip'))}</span>
  `;

  // Insert right after the wrapper
  wrapper.parentNode.insertBefore(card, wrapper.nextSibling);

  // Trigger slide-in animation on next frame
  requestAnimationFrame(() => card.classList.add('budget-inline-warning--visible'));
}

function updateCategoryDropdown(selectId, type) {
  const catSel = document.getElementById(selectId);
  if (!catSel) return;

  let catsToShow = getAllCategories();

  if (type === 'income') {
    // Only show income-type categories
    catsToShow = catsToShow.filter(c => getCategoryType(c) === 'income');
    // Fallback: if no income cats at all, show all (shouldn't happen with defaults Salary/Freelance)
    if (catsToShow.length === 0) catsToShow = getAllCategories();
  } else if (type === 'expense') {
    // Only show expense-type categories
    catsToShow = catsToShow.filter(c => getCategoryType(c) === 'expense');
    // Sub-filter: prefer budgeted cats if available, but ALWAYS keep 'Installment'
    const budgetedCats = catsToShow.filter(c => (budgets[c] && budgets[c] > 0) || c === 'Installment');
    if (budgetedCats.length > 0) catsToShow = budgetedCats;
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

/**
 * Migration: chuyển key cũ `pcn_*` sang `caltdhy_*` (chạy 1 lần khi khởi động)
 * Sau khi migrate xong thì xóa key cũ đi để tránh dupliate
 */
(function migrateLocalStorageKeys() {
  try {
    const OLD_TOKEN_KEY = 'pcn_token';
    const OLD_USER_KEY  = 'pcn_user';
    const NEW_TOKEN_KEY = 'caltdhy_token';
    const NEW_USER_KEY  = 'caltdhy_user';
    const oldToken = localStorage.getItem(OLD_TOKEN_KEY);
    const oldUser  = localStorage.getItem(OLD_USER_KEY);
    if (oldToken && !localStorage.getItem(NEW_TOKEN_KEY)) {
      localStorage.setItem(NEW_TOKEN_KEY, oldToken);
    }
    if (oldUser && !localStorage.getItem(NEW_USER_KEY)) {
      localStorage.setItem(NEW_USER_KEY, oldUser);
    }
    // Xóa key cũ
    localStorage.removeItem(OLD_TOKEN_KEY);
    localStorage.removeItem(OLD_USER_KEY);
  } catch (e) { /* ignore */ }
})();

function getAuthHeaders() {
  const token = localStorage.getItem('caltdhy_token');
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
        // ✅ Sửa lỗi 1.3 (Zombie Budget): Khi online, server là nguồn sự thật.
        // Chỉ giữ lại budget từ local nếu server chưa biết đến danh mục đó
        // (tức là mới thêm offline). Không đưa các mục local đã bị xóa trên server trở lại.
        const serverBudgets = budgetData.data; // Đây là source of truth khi online
        const localBudgets = { ...budgets };
        
        // Chỉ giữ budget local nếu category đó chưa có trên server (offline-created)
        const offlineOnlyBudgets = {};
        Object.keys(localBudgets).forEach(cat => {
          if (!(cat in serverBudgets) && localBudgets[cat] > 0) {
            offlineOnlyBudgets[cat] = localBudgets[cat];
          }
        });
        
        // Merge: server ghi đè + các mục offline chưa lên server
        budgets = { ...offlineOnlyBudgets, ...serverBudgets };
        localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));

        // Nếu có budget offline chưa sync lên → đẩy lên server
        if (Object.keys(offlineOnlyBudgets).length > 0) {
          syncSaveBudgetsToServer();
        }
      }
    }

    // Load Custom Categories
    const catRes = await fetch('/api/spending/categories', { headers });
    if (catRes.ok) {
      const catData = await catRes.json();
      if (catData && catData.success && Array.isArray(catData.data)) {
        const serverCatObjects = parseCategories(catData.data); // normalize server data
        const localCatObjects  = [...customCategories]; // already parsed objects from localStorage

        // Merge: server wins for existing names, local-only cats appended
        const serverNames = serverCatObjects.map(c => c.name);
        const localOnly   = localCatObjects.filter(c => !serverNames.includes(c.name));
        const merged = [...serverCatObjects, ...localOnly];
        customCategories = merged;
        // Persist serialized version
        localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(serializeCategories(customCategories)));

        // If local has extra categories not yet on server → push up to sync
        if (localOnly.length > 0) {
          syncSaveCategoriesToServer();
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
    
    // Trigger full UI redraw with new database state
    triggerUIUpdates();

    // Load Jars & Installments (non-blocking, after main data)
    if (typeof syncLoadJarsFromServer === 'function') {
      syncLoadJarsFromServer();
    }
  } catch (e) {
    // Offline mode – sử dụng dữ liệu cục bộ từ localStorage
    isServerConnected = false;
    // Hiển thị thông báo offline sau 1 giây để đảm bảo DOM đã sẵn sàng
    setTimeout(() => {
      showToast('📴 Đang ở chế độ Ngoại tuyến. Dữ liệu có thể chưa được đồng bộ.', 4000);
    }, 1000);
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
      // Budget saved to server
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
          if (result.data.createdAt) {
            localTxn.createdAt = result.data.createdAt;
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        }
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
      // Deleted from server
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
    const rawArr = raw ? JSON.parse(raw) : [];
    customCategories = parseCategories(rawArr);
  } catch (e) {
    customCategories = [];
  }
}

function saveCustomCategories() {
  try {
    const serialized = serializeCategories(customCategories);
    localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(serialized));
    syncSaveCategoriesToServer(); // ✅ Đã được định nghĩa bên dưới
  } catch (e) { }
}

// ✅ Lỗi 1.1: Hàm đồng bộ danh mục tự định nghĩa lên MongoDB Atlas
async function syncSaveCategoriesToServer() {
  if (!isServerConnected) return; // Chỉ gọi khi đang online
  try {
    const headers = getAuthHeaders();
    const serialized = serializeCategories(customCategories);
    const res = await fetch('/api/spending/categories', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ categories: serialized })
    });
    if (res.ok) {
      // Categories synced to server
    }
  } catch (e) {
    console.warn('⚠️ Category backup failed.', e);
  }
}


/* ── Hidden default categories ── */
function loadHiddenCategories() {
  try {
    const raw = localStorage.getItem(HIDDEN_CATS_KEY);
    hiddenDefaultCategories = raw ? JSON.parse(raw) : [];
  } catch (e) {
    hiddenDefaultCategories = [];
  }
}

function saveHiddenCategories() {
  try {
    localStorage.setItem(HIDDEN_CATS_KEY, JSON.stringify(hiddenDefaultCategories));
  } catch (e) { }
}

/* ── Category Order ── */
function loadCategoryOrder() {
  try {
    const raw = localStorage.getItem(CAT_ORDER_KEY);
    categoryOrder = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(categoryOrder)) categoryOrder = [];
  } catch (e) {
    categoryOrder = [];
  }
}

function saveCategoryOrder() {
  try {
    localStorage.setItem(CAT_ORDER_KEY, JSON.stringify(categoryOrder));
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
      categoryOrder: categoryOrder,
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

/**
 * Validate dữ liệu import từ file backup JSON trước khi ghi vào storage.
 * Trả về { valid: true } hoặc { valid: false, reason: '...' }
 */
function validateImportedData(data) {
  // Kiểm tra cấu trúc tổng quan
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'File không phải định dạng JSON hợp lệ.' };
  }
  if (!data.transactions && !data.budgets && !data.customCategories) {
    return { valid: false, reason: 'File không chứa dữ liệu CaltDHy.' };
  }

  // Validate mảng transactions
  if (data.transactions !== undefined) {
    if (!Array.isArray(data.transactions)) {
      return { valid: false, reason: 'Trường "transactions" phải là mảng.' };
    }
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    for (let i = 0; i < data.transactions.length; i++) {
      const txn = data.transactions[i];
      if (!txn || typeof txn !== 'object') {
        return { valid: false, reason: `Giao dịch #${i + 1} không hợp lệ.` };
      }
      if (!txn.type || !['income', 'expense'].includes(txn.type)) {
        return { valid: false, reason: `Giao dịch #${i + 1}: "type" phải là "income" hoặc "expense".` };
      }
      if (typeof txn.amount !== 'number' || isNaN(txn.amount) || txn.amount <= 0) {
        return { valid: false, reason: `Giao dịch #${i + 1}: "amount" phải là số dương.` };
      }
      if (!txn.date || !DATE_REGEX.test(txn.date)) {
        return { valid: false, reason: `Giao dịch #${i + 1}: "date" phải đúng định dạng YYYY-MM-DD.` };
      }
      // Kiểm tra ngày có thực sự tồn tại không (tránh 2024-02-30)
      const parsed = new Date(txn.date + 'T00:00:00');
      if (isNaN(parsed.getTime())) {
        return { valid: false, reason: `Giao dịch #${i + 1}: "date" là ngày không tồn tại (${txn.date}).` };
      }
      if (!txn.category || typeof txn.category !== 'string' || !txn.category.trim()) {
        return { valid: false, reason: `Giao dịch #${i + 1}: "category" không được để trống.` };
      }
    }
  }

  // Validate object budgets
  if (data.budgets !== undefined) {
    if (typeof data.budgets !== 'object' || Array.isArray(data.budgets)) {
      return { valid: false, reason: 'Trường "budgets" phải là object.' };
    }
    for (const [cat, limit] of Object.entries(data.budgets)) {
      if (typeof limit !== 'number' || isNaN(limit) || limit < 0) {
        return { valid: false, reason: `Ngân sách "${cat}": giới hạn phải là số không âm.` };
      }
    }
  }

  // Validate mảng customCategories
  if (data.customCategories !== undefined) {
    if (!Array.isArray(data.customCategories)) {
      return { valid: false, reason: 'Trường "customCategories" phải là mảng.' };
    }
    for (let i = 0; i < data.customCategories.length; i++) {
      const item = data.customCategories[i];
      if (typeof item === 'string') {
        continue; // Hỗ trợ định dạng cũ (hoặc chuỗi JSON)
      }
      if (typeof item === 'object' && item !== null && typeof item.name === 'string') {
        continue; // Hỗ trợ định dạng mới { name, type }
      }
      return { valid: false, reason: `Danh mục #${i + 1} không hợp lệ (phải là chuỗi hoặc đối tượng).` };
    }
  }

  return { valid: true };
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      // ✅ Validate trước khi ghi — tránh crash UI do dữ liệu hỏng
      const validation = validateImportedData(data);
      if (!validation.valid) {
        showToast('⚠ Import lỗi: ' + validation.reason);
        event.target.value = '';
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
        customCategories = parseCategories(data.customCategories);
        saveCustomCategories();
      }
      if (Array.isArray(data.categoryOrder)) {
        categoryOrder = data.categoryOrder.filter(c => typeof c === 'string');
        saveCategoryOrder();
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

/** Safe math evaluator – không dùng eval/new Function (tránh code injection) */
function evalMathExpression(str) {
  if (!str) return NaN;
  let s = str.replace(/\s+/g, '')
             .replace(/x/gi, '*')
             .replace(/:/g, '/');

  // Gỡ phân cách ngàn (dấu chấm hoặc phẩy trước 3 số)
  if (!/^[0-9.+\-*/()]+$/.test(s)) {
    s = s.replace(/([.,])(?=\d{3}(?!\d))/g, '');
  }

  if (!/^[0-9.+\-*/()]+$/.test(s)) return NaN;

  // ── Recursive descent parser ──────────────────────────────────
  // Grammar:
  //   expr   = term   (('+' | '-') term)*
  //   term   = factor (('*' | '/') factor)*
  //   factor = number | '(' expr ')' | '-' factor
  let pos = 0;

  function parseNumber() {
    let numStr = '';
    while (pos < s.length && /[0-9.]/.test(s[pos])) numStr += s[pos++];
    return numStr ? parseFloat(numStr) : NaN;
  }

  function parseFactor() {
    if (s[pos] === '(') {
      pos++;
      const val = parseExpr();
      if (s[pos] === ')') pos++;
      return val;
    }
    if (s[pos] === '-') { pos++; return -parseFactor(); }
    return parseNumber();
  }

  function parseTerm() {
    let val = parseFactor();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const right = parseFactor();
      if (op === '*') val *= right;
      else { if (right === 0) return NaN; val /= right; }
    }
    return val;
  }

  function parseExpr() {
    let val = parseTerm();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  }

  try {
    const result = parseExpr();
    return (pos === s.length && isFinite(result)) ? result : NaN;
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
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      // Tổng số dư: nếu chế độ 'reset' thì chỉ tính giao dịch trong tháng hiện tại
      if (balanceResetMode === 'reset') {
        if (inThisMonth) balance += t.amount;
      } else {
        balance += t.amount;
      }
      if (inThisMonth) income += t.amount;
    } else {
      if (balanceResetMode === 'reset') {
        if (inThisMonth) balance -= t.amount;
      } else {
        balance -= t.amount;
      }
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
 * Supports drag-and-drop reordering via the LED handle.
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
      ? `⚠ ${fmt(Math.abs(remaining))} ${t('budgetOver')}`
      : `${fmt(remaining)} ${t('budgetLeft')}`;

    return `
      <div class="budget-card ${statusCls}" data-cat="${escHtml(cat)}" draggable="false">
        <div class="budget-card__header">
          <span class="budget-card__icon">${CAT_ICONS[cat] || '\u2713'}</span>
          <span class="budget-card__name">${escHtml(tCat(cat))}</span>
          <span class="budget-card__led budget-card__drag-handle" aria-hidden="true" title="Giữ để kéo thứ tự"></span>
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

  // Initialize drag-and-drop on the panel
  _initBudgetPanelDragDrop(panel);
}

/**
 * Attach drag-and-drop event listeners to budget panel.
 * Uses event delegation: dragging is initiated only when mousedown is on the LED handle.
 *
 * Root cause of previous bug: pointerover set draggable="true", but when the user
 * started to move the mouse to initiate drag, the browser fired pointerout (cursor
 * leaving the handle), which reset draggable="false" BEFORE dragstart could fire.
 * Fix: use mousedown to set draggable, and only reset it on mouseup or dragend.
 */
function _initBudgetPanelDragDrop(panel) {
  let dragSrcCard = null;
  let pendingDragCard = null; // card that is primed for drag via mousedown on handle

  panel.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.budget-card__drag-handle');
    if (!handle) return;
    const card = handle.closest('.budget-card');
    if (!card) return;

    // Prime this card for dragging
    card.setAttribute('draggable', 'true');
    pendingDragCard = card;

    // Safety reset: if user releases mouse without ever dragging, remove draggable
    const onMouseUp = () => {
      if (pendingDragCard && !dragSrcCard) {
        pendingDragCard.setAttribute('draggable', 'false');
        pendingDragCard = null;
      }
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mouseup', onMouseUp, { once: true });
  });

  panel.addEventListener('dragstart', (e) => {
    // Only allow drag if this card was primed via mousedown on the handle
    const card = e.target.closest('.budget-card');
    if (!card || !pendingDragCard || card !== pendingDragCard) {
      e.preventDefault();
      return;
    }
    dragSrcCard = card;
    requestAnimationFrame(() => card.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.cat || '');
  });

  panel.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragSrcCard) return;
    const target = e.target.closest('.budget-card');
    if (!target || target === dragSrcCard) return;

    // Grid-aware swap: use diagonal split (top-left = insert before, bottom-right = insert after)
    const rect = target.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const insertBefore = (relX + relY) < 1.0;

    if (insertBefore) {
      panel.insertBefore(dragSrcCard, target);
    } else {
      panel.insertBefore(dragSrcCard, target.nextSibling);
    }
  });

  panel.addEventListener('dragend', () => {
    if (!dragSrcCard) return;
    dragSrcCard.classList.remove('dragging');
    dragSrcCard.setAttribute('draggable', 'false');

    // Extract new order from DOM
    const cards = panel.querySelectorAll('.budget-card[data-cat]');
    categoryOrder = Array.from(cards).map(c => c.dataset.cat);
    saveCategoryOrder();

    // Reset auto-sort state: user is now in custom (drag) order
    currentBudgetSort = null;

    // Update dropdowns to reflect new order
    updateCategoryDropdown('txnCat', currentType === 'income' ? 'income' : 'expense');
    updateCategoryDropdown('qlCat', 'expense');

    dragSrcCard = null;
    pendingDragCard = null;
  });
}



const STABLE_CHART_COLORS = [
  { bg: '#ff4757', glow: 'rgba(255,71,87,.75)' },   // Crimson Red
  { bg: '#3498db', glow: 'rgba(52,152,219,.75)' },  // Cyber Blue
  { bg: '#2ecc71', glow: 'rgba(46,204,113,.75)' },  // Acid Green
  { bg: '#ff9f43', glow: 'rgba(255,159,67,.75)' },  // Amber Orange
  { bg: '#9b59b6', glow: 'rgba(155,89,182,.75)' },  // Violet Purple
  { bg: '#1abc9c', glow: 'rgba(26,188,156,.75)' },  // Deep Teal
  { bg: '#ff6b81', glow: 'rgba(255,107,129,.75)' }, // Hot Pink
  { bg: '#f1c40f', glow: 'rgba(241,196,15,.75)' },  // Neon Yellow
  { bg: '#00d2fc', glow: 'rgba(0,210,252,.75)' },   // Ice Cyan
  { bg: '#ff4d4d', glow: 'rgba(255,77,77,.75)' },    // Coral Red
  { bg: '#26de81', glow: 'rgba(38,222,129,.75)' },  // Mint Green
  { bg: '#a55eea', glow: 'rgba(165,94,234,.75)' },  // Soft Lavender
  { bg: '#e67e22', glow: 'rgba(230,126,34,.75)' },  // Bright Tangerine
  { bg: '#54a0ff', glow: 'rgba(84,160,255,.75)' },  // Steel Blue
  { bg: '#10ac84', glow: 'rgba(16,172,132,.75)' },  // Emerald Forest
  { bg: '#fd79a8', glow: 'rgba(253,121,168,.75)' }  // Rose Gold
];

function getCategoryColor(catName) {
  const defaultIdx = CATEGORIES.indexOf(catName);
  if (defaultIdx !== -1) {
    return STABLE_CHART_COLORS[defaultIdx % STABLE_CHART_COLORS.length];
  }
  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % STABLE_CHART_COLORS.length;
  return STABLE_CHART_COLORS[index];
}

function getActiveThemeName() {
  const root = document.documentElement;
  if (root.classList.contains('light-theme')) return 'light';
  if (root.classList.contains('cream-theme')) return 'cream';
  if (root.classList.contains('green-theme')) return 'green';
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
    case 'green':
      return {
        income: '#059669',     // Emerald Green
        incomeGlow: 'rgba(5,150,105,0.35)',
        incomeMuted: 'rgba(5,150,105,0.2)',
        expense: '#D63E3E',    // Coral-red (distinct from income)
        expenseGlow: 'rgba(214,62,62,0.3)',
        expenseMuted: 'rgba(214,62,62,0.18)',
        grid: 'rgba(16,120,80,0.08)',
        text: '#4D7A68'
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

    /* Build color arrays based on stable category keys */
    const bgColors = rawKeys.map(k => getCategoryColor(k).bg);
    const glowColors = rawKeys.map(k => getCategoryColor(k).glow);

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
      _categoryChart.update('active'); // CSS aspect-ratio đã fix resize loop — animation 60fps an toàn
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
          resizeDelay: 150, // Throttling resize events to keep transition 60fps
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
    const now = new Date();
    const { month, year } = currentMonthYear();
    const isThisMonth = (month === now.getMonth() && year === now.getFullYear());

    if (currentTrendRange === 1) {
      if (isThisMonth) {
        const currentDay = now.getDate();
        if (currentDay >= 1 && currentDay <= 7) currentWeekIdx = 0;
        else if (currentDay >= 8 && currentDay <= 14) currentWeekIdx = 1;
        else if (currentDay >= 15 && currentDay <= 21) currentWeekIdx = 2;
        else if (currentDay >= 22) currentWeekIdx = 3;
      }

      // 1 Month: Weekly breakdown of current month
      const weeksList = [
        { label: (currentWeekIdx === 0 && isThisMonth) ? [t('week1') || 'Week 1', `(${t('current') || 'current'})`] : (t('week1') || 'Week 1'), start: 1, end: 7 },
        { label: (currentWeekIdx === 1 && isThisMonth) ? [t('week2') || 'Week 2', `(${t('current') || 'current'})`] : (t('week2') || 'Week 2'), start: 8, end: 14 },
        { label: (currentWeekIdx === 2 && isThisMonth) ? [t('week3') || 'Week 3', `(${t('current') || 'current'})`] : (t('week3') || 'Week 3'), start: 15, end: 21 },
        { label: (currentWeekIdx === 3 && isThisMonth) ? [t('week4') || 'Week 4+', `(${t('current') || 'current'})`] : (t('week4') || 'Week 4+'), start: 22, end: 31 }
      ];
      incomeData = [0, 0, 0, 0];
      expenseData = [0, 0, 0, 0];

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

    const averageLinePlugin = {
      id: 'averageLine',
      afterDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        
        chart.data.datasets.forEach(dataset => {
          const data = dataset.data;
          if (!data || data.length === 0) return;
          const sum = data.reduce((a, b) => a + b, 0);
          const avg = sum / data.length;
          if (avg <= 0) return;
          
          const yVal = scales.y.getPixelForValue(avg);
          
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = (typeof dataset.borderColor === 'function') ? dataset.borderColor(null) : dataset.borderColor;
          ctx.globalAlpha = 0.4;
          ctx.moveTo(chartArea.left, yVal);
          ctx.lineTo(chartArea.right, yVal);
          ctx.stroke();
          
          // Draw a small label right-aligned
          ctx.fillStyle = (typeof dataset.borderColor === 'function') ? dataset.borderColor(null) : dataset.borderColor;
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.textAlign = 'right';
          ctx.fillText(`AVG ${dataset.label}: ${fmt(avg)}`, chartArea.right - 10, yVal - 5);
          ctx.restore();
        });
      }
    };

    const getIncomeBg = (context) => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      if (!chartArea) return colors.income;
      
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      if (currentTrendType === 'line') {
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.01)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.35)');
      } else {
        const idx = context.dataIndex;
        const isCurrent = (currentTrendRange === 1 && isThisMonth) ? (idx === currentWeekIdx) : true;
        let topColor = colors.income;
        let bottomColor = colors.incomeGlow || 'rgba(16,185,129,0.05)';
        if (currentTrendRange === 1 && isThisMonth && !isCurrent) {
          topColor = colors.incomeMuted;
          bottomColor = 'rgba(16,185,129,0.02)';
        }
        gradient.addColorStop(0, bottomColor);
        gradient.addColorStop(1, topColor);
      }
      return gradient;
    };

    const getExpenseBg = (context) => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      if (!chartArea) return colors.expense;
      
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      if (currentTrendType === 'line') {
        gradient.addColorStop(0, 'rgba(255, 75, 114, 0.01)');
        gradient.addColorStop(1, 'rgba(255, 75, 114, 0.35)');
      } else {
        const idx = context.dataIndex;
        const isCurrent = (currentTrendRange === 1 && isThisMonth) ? (idx === currentWeekIdx) : true;
        let topColor = colors.expense;
        let bottomColor = colors.expenseGlow || 'rgba(255,75,114,0.05)';
        if (currentTrendRange === 1 && isThisMonth && !isCurrent) {
          topColor = colors.expenseMuted;
          bottomColor = 'rgba(255,75,114,0.02)';
        }
        gradient.addColorStop(0, bottomColor);
        gradient.addColorStop(1, topColor);
      }
      return gradient;
    };

    const getIncomeBorder = (context) => {
      if (currentTrendType === 'line') return colors.income;
      if (!context) return colors.income;
      const idx = context.dataIndex;
      const isCurrent = (currentTrendRange === 1 && isThisMonth) ? (idx === currentWeekIdx) : true;
      return (currentTrendRange === 1 && isThisMonth && !isCurrent) ? colors.incomeMuted : colors.income;
    };

    const getExpenseBorder = (context) => {
      if (currentTrendType === 'line') return colors.expense;
      if (!context) return colors.expense;
      const idx = context.dataIndex;
      const isCurrent = (currentTrendRange === 1 && isThisMonth) ? (idx === currentWeekIdx) : true;
      return (currentTrendRange === 1 && isThisMonth && !isCurrent) ? colors.expenseMuted : colors.expense;
    };

    if (_trendChart && _trendChart.config.type === currentTrendType) {
      // Update in-place
      _trendChart.data.labels = labels;
      _trendChart.data.datasets[0].data = incomeData;
      _trendChart.data.datasets[1].data = expenseData;
      _trendChart.data.datasets[0].backgroundColor = getIncomeBg;
      _trendChart.data.datasets[1].backgroundColor = getExpenseBg;
      _trendChart.data.datasets[0].borderColor = getIncomeBorder;
      _trendChart.data.datasets[1].borderColor = getExpenseBorder;
      _trendChart.options.scales.x.grid.color = colors.grid;
      _trendChart.options.scales.x.grid.display = false; // Hide vertical grids
      _trendChart.options.scales.y.grid.color = colors.grid;
      _trendChart.options.scales.y.grid.borderDash = [5, 5]; // Dashed lines
      _trendChart.options.scales.x.ticks.color = colors.text;
      _trendChart.options.scales.y.ticks.color = colors.text;
      _trendChart.options.scales.x.ticks.font = { family: "'JetBrains Mono', monospace", size: 11 };
      _trendChart.options.scales.y.ticks.font = { family: "'JetBrains Mono', monospace", size: 11 };
      _trendChart.options.plugins.legend.labels.font = { family: "'JetBrains Mono', monospace", size: 12 };
      _trendChart.options.plugins.tooltip.titleFont = { family: "'JetBrains Mono', monospace", size: 13, weight: '700' };
      _trendChart.options.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 12 };
      _trendChart.update('active'); // CSS aspect-ratio đã fix resize loop — animation 60fps an toàn
    } else {
      // Recreate chart
      if (_trendChart) { _trendChart.destroy(); }

      const datasets = [
        {
          label: t('incomeLabel') || 'Income',
          data: incomeData,
          backgroundColor: getIncomeBg,
          borderColor: getIncomeBorder,
          borderWidth: 2.5,
          borderRadius: currentTrendType === 'bar' ? { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 } : 0,
          fill: currentTrendType === 'line',
          tension: 0.4,
          pointBackgroundColor: colors.income,
          pointBorderColor: getActiveThemeName() === 'dark' ? '#1e2124' : '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          hoverBorderWidth: 3,
          hoverBorderColor: colors.income,
          barPercentage: 0.6,
          categoryPercentage: 0.8,
          barThickness: 'flex',
          maxBarThickness: 48
        },
        {
          label: t('expenseLabel') || 'Expense',
          data: expenseData,
          backgroundColor: getExpenseBg,
          borderColor: getExpenseBorder,
          borderWidth: 2.5,
          borderRadius: currentTrendType === 'bar' ? { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 } : 0,
          fill: currentTrendType === 'line',
          tension: 0.4,
          pointBackgroundColor: colors.expense,
          pointBorderColor: getActiveThemeName() === 'dark' ? '#1e2124' : '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          hoverBorderWidth: 3,
          hoverBorderColor: colors.expense,
          barPercentage: 0.6,
          categoryPercentage: 0.8,
          barThickness: 'flex',
          maxBarThickness: 48
        }
      ];

      _trendChart = new Chart(canvas, {
        type: currentTrendType,
        data: {
          labels,
          datasets
        },
        plugins: [averageLinePlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 150, // Throttling resize events to keep transition 60fps
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
              grid: { display: false },
              ticks: { color: colors.text, font: { family: "'JetBrains Mono', monospace", size: 11 } }
            },
            y: {
              grid: { color: colors.grid, drawBorder: false, borderDash: [5, 5] },
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

  // Bug 1: Ẩn nút budget sort khi đang ở analytics — calcCategorySpend dùng tháng hiện tại,
  // không phải tháng đang xem trong analytics, nên ẩn nút tránh nhầm lẫn UX.
  const budgetSortWrapper = document.getElementById('budgetSortWrapper');
  if (budgetSortWrapper) {
    budgetSortWrapper.style.display = view === 'analytics' ? 'none' : '';
    if (view === 'analytics') closeBudgetSort();
  }
  
  if (view === 'analytics') {
    // renderMonthSelector đồng bộ tháng đang chọn
    renderMonthSelector();
    // renderMonthTxnFeed render feed giao dịch
    renderMonthTxnFeed();
  }
  // updateChart() tự gọi updateTrendChart() + updateAnalyticsSummary() — không gọi thừa
  updateChart();
}

function generateAnalyticsHTML(month, year, isCompare = false) {
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
  
  let topCat = 'Other';
  let topCatAmt = 0;
  Object.keys(totalsByCat).forEach(c => {
    if (totalsByCat[c] > topCatAmt) {
      topCat = c;
      topCatAmt = totalsByCat[c];
    }
  });
  
  const savings = totalIncome - totalExpense;
  // Tỷ lệ tích lũy: phân nhánh 3 kịch bản tài chính
  let savingsRate;
  if (totalIncome === 0 && totalExpense === 0) savingsRate = '0.0';
  else if (totalIncome > 0 && totalExpense === 0) savingsRate = '100.0';
  else if (totalIncome >= totalExpense) savingsRate = (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1);
  else savingsRate = (-(totalIncome / totalExpense) * 100).toFixed(1);
  
  const tSavingsRate = t('savingsRate') || 'Savings Rate';
  const tTopCategory = t('topCategory') || 'Top Category';
  const tTotalTransactions = t('totalTransactions') || 'Total Transactions';
  const tNetSavings = t('netSavings') || 'Net Savings';
  
  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';
  const monthDate = new Date(year, month, 1);
  const monthName = monthDate.toLocaleString(locale, { month: 'short' }).toUpperCase();
  const monthLabel = monthName + ' ' + year;

  const titlePrefix = isCompare ? `VS ${monthLabel} - ` : '';

  return `
    <div class="analytics-card ${isCompare ? 'metric-card' : ''}" ${isCompare ? 'style="border: 1px dashed var(--accent); background: rgba(255,75,114,0.03);"' : ''}>
      <p class="analytics-card__title ${isCompare ? 'metric-card__label' : ''}" ${isCompare ? 'style="color: var(--accent); font-weight: 700; opacity: 0.8;"' : ''}>${titlePrefix}${escHtml(tSavingsRate)}</p>
      <p class="analytics-card__value">${savingsRate}%</p>
      <p class="analytics-card__sub">${totalIncome > 0 ? `${t('savingsGood') || 'of total income saved'} (${monthLabel})` : (t('savingsNoIncome') || 'No income logged')}</p>
    </div>
    <div class="analytics-card ${isCompare ? 'metric-card' : ''}" ${isCompare ? 'style="border: 1px dashed var(--accent); background: rgba(255,75,114,0.03);"' : ''}>
      <p class="analytics-card__title ${isCompare ? 'metric-card__label' : ''}" ${isCompare ? 'style="color: var(--accent); font-weight: 700; opacity: 0.8;"' : ''}>${titlePrefix}${escHtml(tTopCategory)}</p>
      <p class="analytics-card__value" style="font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(tCat(topCat))}</p>
      <p class="analytics-card__sub">${topCatAmt > 0 ? fmt(topCatAmt) : '0 ₫'}</p>
    </div>
    <div class="analytics-card ${isCompare ? 'metric-card' : ''}" ${isCompare ? 'style="border: 1px dashed var(--accent); background: rgba(255,75,114,0.03);"' : ''}>
      <p class="analytics-card__title ${isCompare ? 'metric-card__label' : ''}" ${isCompare ? 'style="color: var(--accent); font-weight: 700; opacity: 0.8;"' : ''}>${titlePrefix}${escHtml(tNetSavings)}</p>
      <p class="analytics-card__value ${savings >= 0 ? 'pos' : 'neg'}" style="color: ${savings >= 0 ? 'var(--green)' : '#ff4757'}">${savings >= 0 ? '+' : ''}${fmt(savings)}</p>
      <p class="analytics-card__sub">${monthLabel}</p>
    </div>
    <div class="analytics-card ${isCompare ? 'metric-card' : ''}" ${isCompare ? 'style="border: 1px dashed var(--accent); background: rgba(255,75,114,0.03);"' : ''}>
      <p class="analytics-card__title ${isCompare ? 'metric-card__label' : ''}" ${isCompare ? 'style="color: var(--accent); font-weight: 700; opacity: 0.8;"' : ''}>${titlePrefix}${escHtml(tTotalTransactions)}</p>
      <p class="analytics-card__value">${txnCount}</p>
      <p class="analytics-card__sub">${currentLang === 'vi' ? 'giao dịch được ghi nhận' : (currentLang === 'zh' ? '笔已记录交易' : 'transactions recorded')} (${monthLabel})</p>
    </div>
  `;
}

function updateAnalyticsSummary() {
  const grid = document.getElementById('analyticsGrid');
  if (!grid) return;
  
  // Determine which periods (months) are in the active trend range
  let periods = [];
  if (currentTrendRange === 1) {
    const { month, year } = currentMonthYear();
    periods.push({ month, year });
  } else {
    // Mirror the months shown in the chart (rolling last N months)
    const now = new Date();
    for (let i = currentTrendRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push({ month: d.getMonth(), year: d.getFullYear() });
    }
  }

  // Compute aggregated stats
  let totalIncome = 0;
  let totalExpense = 0;
  let txnCount = 0;
  const totalsByCat = {};

  transactions.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const tMonth = d.getMonth();
    const tYear = d.getFullYear();

    // Check if transaction is in any of the periods
    const inPeriod = periods.some(p => p.month === tMonth && p.year === tYear);
    if (inPeriod) {
      txnCount++;
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        totalsByCat[t.category] = (totalsByCat[t.category] || 0) + t.amount;
      }
    }
  });

  let topCat = 'Other';
  let topCatAmt = 0;
  Object.keys(totalsByCat).forEach(c => {
    if (totalsByCat[c] > topCatAmt) {
      topCat = c;
      topCatAmt = totalsByCat[c];
    }
  });

  const savings = totalIncome - totalExpense;
  const savingsRate = totalExpense > 0 ? (- (totalIncome / totalExpense) * 100).toFixed(1) : '0.0';

  const tSavingsRate = t('savingsRate') || 'Savings Rate';
  const tTopCategory = t('topCategory') || 'Top Category';
  const tTotalTransactions = t('totalTransactions') || 'Total Transactions';
  const tNetSavings = t('netSavings') || 'Net Savings';

  // Build the label for the subtitle (e.g. "MAY 2026 - JUL 2026" or "JUL 2026")
  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';
  
  let rangeLabel = '';
  if (periods.length === 1) {
    const d = new Date(periods[0].year, periods[0].month, 1);
    rangeLabel = d.toLocaleString(locale, { month: 'short' }).toUpperCase() + ' ' + periods[0].year;
  } else {
    const startD = new Date(periods[0].year, periods[0].month, 1);
    const endD = new Date(periods[periods.length - 1].year, periods[periods.length - 1].month, 1);
    const startLabel = startD.toLocaleString(locale, { month: 'short' }).toUpperCase() + ' ' + periods[0].year;
    const endLabel = endD.toLocaleString(locale, { month: 'short' }).toUpperCase() + ' ' + periods[periods.length - 1].year;
    rangeLabel = `${startLabel} - ${endLabel}`;
  }

  grid.innerHTML = `
    <div class="analytics-card">
      <p class="analytics-card__title">${escHtml(tSavingsRate)}</p>
      <p class="analytics-card__value">${savingsRate}%</p>
      <p class="analytics-card__sub">${totalIncome > 0 ? `${t('savingsGood') || 'of total income saved'} (${rangeLabel})` : (t('savingsNoIncome') || 'No income logged')}</p>
    </div>
    <div class="analytics-card">
      <p class="analytics-card__title">${escHtml(tTopCategory)}</p>
      <p class="analytics-card__value" style="font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(tCat(topCat))}</p>
      <p class="analytics-card__sub">${topCatAmt > 0 ? fmt(topCatAmt) : '0 ₫'}</p>
    </div>
    <div class="analytics-card">
      <p class="analytics-card__title">${escHtml(tNetSavings)}</p>
      <p class="analytics-card__value ${savings >= 0 ? 'pos' : 'neg'}" style="color: ${savings >= 0 ? 'var(--green)' : '#ff4757'}">${savings >= 0 ? '+' : ''}${fmt(savings)}</p>
      <p class="analytics-card__sub">${rangeLabel}</p>
    </div>
    <div class="analytics-card">
      <p class="analytics-card__title">${escHtml(tTotalTransactions)}</p>
      <p class="analytics-card__value">${txnCount}</p>
      <p class="analytics-card__sub">${currentLang === 'vi' ? 'giao dịch được ghi nhận' : (currentLang === 'zh' ? '笔已记录交易' : 'transactions recorded')} (${rangeLabel})</p>
    </div>
  `;

  // Compare month rendering (if active)
  const compareGrid = document.getElementById('analyticsCompareGrid');
  const btnCompareClear = document.getElementById('btnCompareClear');
  if (compareGrid && btnCompareClear) {
    if (compareMonthYear) {
      compareGrid.innerHTML = generateAnalyticsHTML(compareMonthYear.month, compareMonthYear.year, true);
      compareGrid.style.display = 'grid';
      btnCompareClear.style.display = 'flex';
    } else {
      compareGrid.style.display = 'none';
      compareGrid.innerHTML = '';
      btnCompareClear.style.display = 'none';
    }
  }
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

  // Reset trend range to 1 Month when selecting a month
  currentTrendRange = 1;
  const rangeSelect = document.getElementById('trendRange');
  if (rangeSelect) {
    rangeSelect.value = "1";
  }

  triggerUIUpdates();
}

function changeMonthOffset(offset) {
  const current = currentMonthYear();
  const d = new Date(current.year, current.month + offset, 1);
  selectedMonthYear = { month: d.getMonth(), year: d.getFullYear() };

  // Reset trend range to 1 Month when navigating months
  currentTrendRange = 1;
  const rangeSelect = document.getElementById('trendRange');
  if (rangeSelect) {
    rangeSelect.value = "1";
  }

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

  list.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    const aTime = a.createdAt || '';
    const bTime = b.createdAt || '';
    if (aTime && bTime) return bTime.localeCompare(aTime);
    if (aTime) return -1;
    if (bTime) return 1;
    return b.id.localeCompare(a.id);
  });

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
  // Opt 4: Re-apply current auto-sort after data changes (new txn, import, etc.)
  if (currentBudgetSort) {
    sortBudgets(currentBudgetSort);
  } else {
    renderBudgetPanel();
  }
  updateChart();
  renderMonthSelector();
  updateAnalyticsSummary();
  renderMonthTxnFeed();
}

function changeTrendRange(months) {
  currentTrendRange = months;
  updateTrendChart();
  updateAnalyticsSummary();
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

/** Apply active sort to a cloned list and return sorted result */
function applySort(list) {
  const sorted = [...list];
  switch (currentSort) {
    case 'date-asc':
      sorted.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        
        const aTime = a.createdAt || '';
        const bTime = b.createdAt || '';
        if (aTime && bTime) return aTime.localeCompare(bTime);
        if (aTime) return 1;
        if (bTime) return -1;
        return a.id.localeCompare(b.id);
      });
      break;
    case 'amount-desc':
      sorted.sort((a, b) => {
        const amtCompare = b.amount - a.amount;
        if (amtCompare !== 0) return amtCompare;
        
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        
        const aTime = a.createdAt || '';
        const bTime = b.createdAt || '';
        if (aTime && bTime) return bTime.localeCompare(aTime);
        if (aTime) return -1;
        if (bTime) return 1;
        return b.id.localeCompare(a.id);
      });
      break;
    case 'amount-asc':
      sorted.sort((a, b) => {
        const amtCompare = a.amount - b.amount;
        if (amtCompare !== 0) return amtCompare;
        
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        
        const aTime = a.createdAt || '';
        const bTime = b.createdAt || '';
        if (aTime && bTime) return aTime.localeCompare(bTime);
        if (aTime) return -1;
        if (bTime) return 1;
        return b.id.localeCompare(a.id);
      });
      break;
    case 'date-desc':
    default:
      sorted.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        
        const aTime = a.createdAt || '';
        const bTime = b.createdAt || '';
        if (aTime && bTime) return bTime.localeCompare(aTime);
        if (aTime) return -1;
        if (bTime) return 1;
        return b.id.localeCompare(a.id);
      });
      break;
  }
  return sorted;
}

function renderFeed() {
  const feed = document.getElementById('txnFeed');
  if (!feed) return;

  let list = [...transactions];

  if (currentPeriodFilter === 'month') {
    const today = new Date();
    const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    list = list.filter(tx => tx.date.startsWith(currentMonthPrefix));
  }

  if (currentFilter !== 'all') {
    list = list.filter(tx => tx.type === currentFilter);
  }

  list = applySort(list);

  // Re-render dropdown items only when it's already open (keep active state in sync)
  const sortWrapper = document.getElementById('feedSortWrapper');
  if (sortWrapper && sortWrapper.classList.contains('open')) {
    renderFeedSortDropdown();
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
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Filter ── */
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
  btn.classList.add('filter-btn--active');
  renderFeed();
}

function setPeriodFilter(p, btn) {
  currentPeriodFilter = p;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('period-btn--active'));
  btn.classList.add('period-btn--active');
  renderFeed();
}

/* ============================================================
   SORT DROPDOWN
   ============================================================ */

/** Render the sort dropdown options based on current language */
function renderFeedSortDropdown() {
  const dropdown = document.getElementById('feedSortDropdown');
  if (!dropdown) return;

  const sortOptions = [
    {
      group: t('sortGroupDate'),
      items: [
        { key: 'date-desc', icon: '↓', label: t('sortDateDesc') },
        { key: 'date-asc',  icon: '↑', label: t('sortDateAsc')  },
      ]
    },
    {
      group: t('sortGroupAmount'),
      items: [
        { key: 'amount-desc', icon: '↓', label: t('sortAmountDesc') },
        { key: 'amount-asc',  icon: '↑', label: t('sortAmountAsc')  },
      ]
    }
  ];

  dropdown.innerHTML = sortOptions.map((group, gi) => `
    ${gi > 0 ? '<div class="feed-sort-divider"></div>' : ''}
    <div class="feed-sort-section-label">${escHtml(group.group)}</div>
    ${group.items.map(opt => `
      <button
        class="feed-sort-option${currentSort === opt.key ? ' active' : ''}"
        onclick="changeFeedSort('${opt.key}')"
        role="option"
        aria-selected="${currentSort === opt.key ? 'true' : 'false'}">
        <span class="feed-sort-option__icon">${opt.icon}</span>
        ${escHtml(opt.label)}
      </button>
    `).join('')}
  `).join('');
}

/** Toggle the sort dropdown open / closed */
function toggleFeedSort(e) {
  if (e) e.stopPropagation();
  const wrapper = document.getElementById('feedSortWrapper');
  const btn = document.getElementById('feedSortBtn');
  if (!wrapper) return;

  const isOpen = wrapper.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

  if (isOpen) {
    renderFeedSortDropdown();
  }
}

/** Set a new sort mode, re-render feed, close dropdown */
function changeFeedSort(sortKey) {
  currentSort = sortKey;
  closeFeedSort();
  renderFeed();
}

/** Close the sort dropdown */
function closeFeedSort() {
  const wrapper = document.getElementById('feedSortWrapper');
  const btn = document.getElementById('feedSortBtn');
  if (wrapper) wrapper.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

/* ============================================================
   BUDGET SORT DROPDOWN
   ============================================================ */
let currentBudgetSort = null; // null means custom drag order

function renderBudgetSortDropdown() {
  const dropdown = document.getElementById('budgetSortDropdown');
  if (!dropdown) return;

  const sortOptions = [
    { key: 'limit-desc',  label: t('budgetSortLimitDesc')  },
    { key: 'limit-asc',   label: t('budgetSortLimitAsc')   },
    { key: 'remain-desc', label: t('budgetSortRemainDesc') },
    { key: 'remain-asc',  label: t('budgetSortRemainAsc')  }
  ];

  dropdown.innerHTML = `
    <div class="feed-sort-section-label">${escHtml(t('budgetSortTitle'))}</div>
    ${sortOptions.map(opt => `
      <button
        class="budget-sort-option${currentBudgetSort === opt.key ? ' active' : ''}"
        onclick="changeBudgetSort('${opt.key}')"
        role="option"
        aria-selected="${currentBudgetSort === opt.key ? 'true' : 'false'}">
        ${escHtml(opt.label)}
      </button>
    `).join('')}
  `;
}

function toggleBudgetSort(e) {
  if (e) e.stopPropagation();
  const wrapper = document.getElementById('budgetSortWrapper');
  const btn = document.getElementById('budgetSortBtn');
  if (!wrapper) return;

  const isOpen = wrapper.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

  if (isOpen) {
    renderBudgetSortDropdown();
  }
}

function changeBudgetSort(sortKey) {
  currentBudgetSort = sortKey;
  closeBudgetSort();
  if (sortKey) {
    sortBudgets(sortKey);
  } else {
    loadCategoryOrder();
    renderBudgetPanel();
    updateCategoryDropdown('txnCat', currentType === 'income' ? 'income' : 'expense');
    updateCategoryDropdown('qlCat', 'expense');
  }
}

function closeBudgetSort() {
  const wrapper = document.getElementById('budgetSortWrapper');
  const btn = document.getElementById('budgetSortBtn');
  if (wrapper) wrapper.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function sortBudgets(criteria) {
  const activeCats = getAllCategories().filter(c => budgets[c] && budgets[c] > 0);
  const spent = calcCategorySpend();

  activeCats.sort((a, b) => {
    const limitA = budgets[a] || 0;
    const limitB = budgets[b] || 0;
    const remainA = limitA - (spent[a] || 0);
    const remainB = limitB - (spent[b] || 0);

    switch (criteria) {
      case 'limit-desc':
        return limitB - limitA;

      case 'limit-asc':
        return limitA - limitB;

      case 'remain-desc':
        // Positive remaining first (most first), over-budget pushed to end
        if (remainA > 0 && remainB <= 0) return -1;
        if (remainA <= 0 && remainB > 0) return 1;
        if (remainA <= 0 && remainB <= 0) return limitB - limitA; // both over: sort by limit desc
        return remainB - remainA;

      case 'remain-asc':
        // Positive remaining ONLY sorted ascending (least remaining = most urgent first).
        // Over-budget categories are pushed to the END, sorted by how much they exceeded (worst last).
        if (remainA > 0 && remainB <= 0) return -1; // a has money left, goes before over-budget b
        if (remainA <= 0 && remainB > 0) return 1;  // b has money left, goes before over-budget a
        if (remainA <= 0 && remainB <= 0) return remainA - remainB; // both over: most over goes last
        return remainA - remainB; // both positive: smallest remaining first (most urgent)

      default:
        return 0;
    }
  });

  const allCats = getAllCategories();
  const otherCats = allCats.filter(c => !activeCats.includes(c));
  categoryOrder = [...activeCats, ...otherCats];
  saveCategoryOrder();

  renderBudgetPanel();

  updateCategoryDropdown('txnCat', currentType === 'income' ? 'income' : 'expense');
  updateCategoryDropdown('qlCat', 'expense');
}

/* ============================================================
   UNDO DELETE
   ============================================================ */
let _deletedTxn = null;
let _deletedCustomCat = null;
let _deletedCustomCatBudget = null;
let _hiddenDefaultCat = null;  // undo for hide-default-category
let _hiddenDefaultCatBudget = null;  // undo budget for hide-default-category
let _hiddenDefaultCatOrderIdx = -1;  // undo position in categoryOrder
let _undoTimer = null;
const UNDO_DELAY = 5000; // ms before permanent deletion

/**
 * Flush current budget modal input values into the `budgets` object.
 * Must be called BEFORE any action that rebuilds the modal grid
 * (delete/hide/add category) so that unsaved user edits are preserved.
 */
function saveCurrentInputValuesToBudgets() {
  const grid = document.getElementById('budgetFormGrid');
  if (!grid) return;
  grid.querySelectorAll('.budget-form-row[data-cat]').forEach(row => {
    const cat = row.dataset.cat;
    const inp = row.querySelector('.budget-form-input');
    if (!inp) return;
    const raw = parseFloat(inp.value);
    if (!isNaN(raw) && raw > 0) {
      budgets[cat] = currentCurrency === 'USD'
        ? Math.round(raw * EXCHANGE_RATE)
        : currentCurrency === 'CNY'
          ? Math.round(raw * CNY_RATE)
          : Math.round(raw);
    } else {
      delete budgets[cat];
    }
  });
  saveBudgets();
}

/**
 * Ẩn một danh mục MẶC ĐỊNH (soft-hide, không xóa hẳn).
 * User có thể Undo trong 5 giây.
 */
function hideDefaultCategory(name) {
  if (!CATEGORIES.includes(name)) return; // Chỉ áp dụng cho danh mục mặc định

  // Flush unsaved form edits so other inputs are not lost on modal rebuild
  saveCurrentInputValuesToBudgets();

  _hiddenDefaultCat = name;
  // Save budget for undo restore
  _hiddenDefaultCatBudget = budgets[name] !== undefined ? budgets[name] : null;

  // Thêm vào danh sách ẩn
  if (!hiddenDefaultCategories.includes(name)) {
    hiddenDefaultCategories.push(name);
    saveHiddenCategories();
  }

  // Xóa budget của danh mục này
  if (budgets[name] !== undefined) {
    delete budgets[name];
    saveBudgets();
  }

  // Xóa khỏi categoryOrder, lưu vị trí cũ để khôi phục
  _hiddenDefaultCatOrderIdx = categoryOrder.indexOf(name);
  if (_hiddenDefaultCatOrderIdx !== -1) {
    categoryOrder.splice(_hiddenDefaultCatOrderIdx, 1);
    saveCategoryOrder();
  }

  // Rebuild modal + UI
  openBudgetModal();
  renderBudgetPanel();
  updateChart();

  // Undo toast
  showUndoToast(
    `"${tCat(name)}" đã được ẩn`,
    () => {
      // Restore: bỏ khỏi danh sách ẩn
      const toRestore = _hiddenDefaultCat;
      if (!toRestore) return;
      hiddenDefaultCategories = hiddenDefaultCategories.filter(c => c !== toRestore);
      saveHiddenCategories();

      // Restore budget
      if (_hiddenDefaultCatBudget !== null) {
        budgets[toRestore] = _hiddenDefaultCatBudget;
        saveBudgets();
      }

      // Restore position in categoryOrder
      if (!categoryOrder.includes(toRestore)) {
        if (_hiddenDefaultCatOrderIdx !== -1 && _hiddenDefaultCatOrderIdx <= categoryOrder.length) {
          categoryOrder.splice(_hiddenDefaultCatOrderIdx, 0, toRestore);
        } else {
          categoryOrder.push(toRestore);
        }
        saveCategoryOrder();
      }

      _hiddenDefaultCat = null;
      _hiddenDefaultCatBudget = null;
      _hiddenDefaultCatOrderIdx = -1;
      openBudgetModal();
      renderBudgetPanel();
      updateChart();
    }
  );

  // Start permanent-deletion timer (use shared _undoTimer)
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => {
    _hiddenDefaultCat = null;
    _hiddenDefaultCatBudget = null;
    _hiddenDefaultCatOrderIdx = -1;
    hideUndoToast();
  }, UNDO_DELAY);
}



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
    transactions.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      const aTime = a.createdAt || '';
      const bTime = b.createdAt || '';
      if (aTime && bTime) return bTime.localeCompare(aTime);
      if (aTime) return -1;
      if (bTime) return 1;
      return b.id.localeCompare(a.id);
    });
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
  transactions.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    const aTime = a.createdAt || '';
    const bTime = b.createdAt || '';
    if (aTime && bTime) return bTime.localeCompare(aTime);
    if (aTime) return -1;
    if (bTime) return 1;
    return b.id.localeCompare(a.id);
  });
  _deletedTxn = null;
  saveTransactions();
  triggerUIUpdates();
  hideUndoToast();
  showToast('↩ ' + t('undoSuccess'));
}

function deleteCustomCategory(name) {
  const idx = customCategories.findIndex(c => c.name === name);
  if (idx === -1) return;

  // Flush unsaved form edits so other inputs are not lost on modal rebuild
  saveCurrentInputValuesToBudgets();

  // Soft-remove: hold in temp variables
  _deletedCustomCat = name;
  _deletedCustomCatBudget = budgets[name] !== undefined ? budgets[name] : null;
  const deletedCatObj = customCategories[idx]; // save full object for undo restore

  // Remove from customCategories
  customCategories.splice(idx, 1);
  saveCustomCategories();

  // Remove from budgets
  if (budgets[name] !== undefined) {
    delete budgets[name];
    saveBudgets();
  }

  // Bug 3: Xóa khỏi categoryOrder để tránh rác trong localStorage
  const orderIdx = categoryOrder.indexOf(name);
  if (orderIdx !== -1) {
    categoryOrder.splice(orderIdx, 1);
    saveCategoryOrder();
  }

  // Refresh
  openBudgetModal();
  renderBudgetPanel();
  updateChart();

  // Show undo toast
  showUndoToast(t('categoryDeleted'), () => {
    if (!_deletedCustomCat) return;

    // Restore custom category (as full object with type)
    if (!customCategories.find(c => c.name === _deletedCustomCat)) {
      customCategories.push(deletedCatObj);
      saveCustomCategories();
    }

    // Restore budget
    if (_deletedCustomCatBudget !== null) {
      budgets[_deletedCustomCat] = _deletedCustomCatBudget;
      saveBudgets();
    }

    // Restore vị trí trong categoryOrder (thêm lại vào cuối nếu chưa có)
    if (!categoryOrder.includes(_deletedCustomCat)) {
      // Cố gắng chèn lại đúng vị trí cũ; nếu không biết thì thêm vào cuối
      if (orderIdx !== -1 && orderIdx <= categoryOrder.length) {
        categoryOrder.splice(orderIdx, 0, _deletedCustomCat);
      } else {
        categoryOrder.push(_deletedCustomCat);
      }
      saveCategoryOrder();
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
/* ── Focus Trap cleanup references (populated when modals open) ── */
let _trapModal      = null;
let _trapSettings   = null;
let _trapBudget     = null;
let _trapQuickLog   = null;
let _trapNumpad     = null;

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
  if (window.FocusTrap) {
    _trapModal = window.FocusTrap.trap(document.getElementById('modal').querySelector('.modal-card') || document.getElementById('modal'));
  } else {
    document.getElementById('txnDesc').focus();
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  if (_trapModal) { _trapModal(); _trapModal = null; }
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
  const linkInstId = document.getElementById('txnInstallmentLink')?.value || '';

  if (isNaN(amount) || amount <= 0) { 
    showFormError(t('enterValidAmount')); 
    return; 
  }
  if (!date) { showFormError(t('dateRequired')); return; }

  const finalDesc = desc || tCat(cat);

  const txn = { 
    id: uid(), 
    type: currentType, 
    desc: finalDesc, 
    amount, 
    category: cat, 
    date, 
    createdAt: new Date().toISOString() 
  };
  if (cat === 'Installment' && linkInstId) {
    txn.installmentId = linkInstId;
  }

  transactions.push(txn);
  saveTransactions();
  syncAddTransactionToServer(txn);

  // Nếu là thanh toán định kỳ liên kết, tự động cập nhật khoản định kỳ đó
  if (cat === 'Installment' && linkInstId) {
    const inst = installments.find(i => i.id === linkInstId);
    if (inst) {
      inst.nextDueDate = advanceNextDueDate(inst.nextDueDate, inst.cycle);
      inst.totalPaid = (inst.totalPaid || 0) + amount;
      saveInstallments();
      syncPayInstallmentToServer(inst.id);
      if (typeof refreshInstallmentsPanel === 'function') {
        refreshInstallmentsPanel();
      }
    }
  }

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
  if (window.FocusTrap) {
    _trapQuickLog = window.FocusTrap.trap(document.getElementById('quickLogModal').querySelector('.modal-card') || document.getElementById('quickLogModal'));
  } else {
    if (amtInput) amtInput.focus();
  }
}

function closeQuickLog() {
  document.getElementById('quickLogModal').classList.remove('open');
  if (_trapQuickLog) { _trapQuickLog(); _trapQuickLog = null; }
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

  const txn = { id: uid(), type: _qlType, desc: finalDesc, amount: amountVND, category: cat, date: todayISO(), createdAt: new Date().toISOString() };
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
  if (window.FocusTrap) {
    _trapNumpad = window.FocusTrap.trap(document.getElementById('numpadModal').querySelector('.modal-card') || document.getElementById('numpadModal'));
  }
}

function closeNumpad() {
  document.getElementById('numpadModal').classList.remove('open');
  if (_trapNumpad) { _trapNumpad(); _trapNumpad = null; }
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
    date: todayISO(),
    createdAt: new Date().toISOString()
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
    sortGroupDate: 'Sort by Date',
    sortGroupAmount: 'Sort by Amount',
    sortDateDesc: 'Newest First',
    sortDateAsc: 'Oldest First',
    sortAmountDesc: 'Highest Amount',
    sortAmountAsc: 'Lowest Amount',
    budgetSortTitle: 'Sort Budgets',
    budgetSortLimitDesc: 'Highest Limit',
    budgetSortLimitAsc: 'Lowest Limit',
    budgetSortRemainDesc: 'Highest Remaining',
    budgetSortRemainAsc: 'Lowest Remaining',
    budgetSortCustom: 'Custom (Drag & Drop)',
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
    jarHistoryBtn: 'History',
    jarHistoryTitle: 'Jar Transaction History',
    jarHistoryAll: 'All Jars',
    jarHistoryEmpty: 'No history yet.',
    jarTxnReason: 'Reason (optional)',
    jarTxnRecentHistory: 'Recent history',
    Installment: 'Recurring Payment',
    installmentLink: 'Link to recurring item',
    installmentSelectPlaceholder: 'Select a recurring item...',
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
    budgetLeft: 'left',
    budgetOver: 'over',
    overBudgetTip: 'Everything is better in moderation',
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
    greenTheme: 'Green',
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
    trendControls: 'CHART OPTIONS',
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
    gFeat6_title: 'Month Comparison',
    gFeat6_desc: 'Click the [+] button in the Analytics Summary section to compare data with previous months.',
    gFeat7_title: 'Month Detail',
    gFeat7_desc: 'Click on the month row in the Analytics Summary to view all transactions for that specific month.',
    /* Settings tab */
    gSettings_title: '⚙️ Settings & Customisation',
    gSettings_intro: 'Tap the <strong>Settings</strong> (⚙️) button in the top bar to open settings.',
    gRow_account_key: '👤 Account',
    gRow_account_val: 'Manage your profile: change display name, avatar, or log out.',
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
    gTip7_title: 'Filter by Month',
    gTip7_desc: 'In the transaction list, use the THIS MONTH / ALL TIME buttons to view only the current month\'s data or the entire history.',
    gTipsNote: '<strong>Get started:</strong> Close this window and tap <kbd>+ ADD TRANSACTION</kbd> to log your first transaction!',
    monthlyWrapUp: 'MONTHLY WRAP-UP',
    healthScore: 'Budget Health',
    startFresh: 'START FRESH',
    periodThisMonth: 'THIS MONTH',
    periodAllTime: 'ALL TIME',
    noPreviousData: 'No data available from previous months.',
    resetBoxTitle: 'Balance Display Mode',
    resetBoxDesc: 'Keep accumulated balance from previous months, or reset to zero each new month?',
    resetModeKeep: 'Keep Running Total',
    resetModeReset: 'Reset Each Month',
    reportSavingsRate: 'Savings Rate',
    reportTopSpend: 'Top Spend',
    reportNetSavings: 'Net Savings',
    reportTxnCount: 'Transactions',
    reportPrevMonth: 'Previous Month',
    reportThisMonth: 'This Month',
    reportNoData: 'No transaction data for this period.',
    /* Wrap-up tabs & period picker */
    reportTabMonth: 'MONTH',
    reportTabQuarter: 'QUARTER',
    reportTabYear: 'YEAR',
    quarterlyWrapUp: 'QUARTERLY WRAP-UP',
    annualWrapUp: 'ANNUAL WRAP-UP',
    wrapupBtnClose: 'CLOSE',
    wrapupBtnStartFresh: 'START FRESH',
    noDataForPeriod: 'No transaction data for this period.',
    /* Quarter labels */
    q1Label: 'Q1', q2Label: 'Q2', q3Label: 'Q3', q4Label: 'Q4',
    /* Enhanced period badge labels */
    reportThisQuarter: 'This Quarter',
    reportThisYear: 'This Year',
    /* Enhanced stats labels */
    reportAvgMonthly: 'Monthly Avg',
    reportTopCats: 'Top Spending Categories',
    reportBestSavingsMonth: 'Best Savings Month',
    reportPeakSpendMonth: 'Peak Spend Month',
    reportPeakIncomeMonth: 'Peak Income Month',
    /* Footer */
    gFooterClose: 'Close Guide ✕',
    quarterTooltipNoData: "You forgot about me this quarter! 😢",
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
    sortGroupDate: 'Sắp xếp theo thời gian',
    sortGroupAmount: 'Sắp xếp theo số tiền',
    sortDateDesc: 'Mới nhất trước',
    sortDateAsc: 'Cũ nhất trước',
    sortAmountDesc: 'Số tiền lớn nhất',
    sortAmountAsc: 'Số tiền nhỏ nhất',
    budgetSortTitle: 'Sắp xếp ngân sách',
    budgetSortLimitDesc: 'Hạn mức lớn nhất',
    budgetSortLimitAsc: 'Hạn mức bé nhất',
    budgetSortRemainDesc: 'Còn lại nhiều nhất',
    budgetSortRemainAsc: 'Còn lại ít nhất',
    budgetSortCustom: 'Tùy chỉnh (Kéo thả)',
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
    jarHistoryBtn: 'Lịch sử',
    jarHistoryTitle: 'Lịch Sử Nạp / Rút Hũ',
    jarHistoryAll: 'Tất cả hũ',
    jarHistoryEmpty: 'Chưa có lịch sử giao dịch.',
    jarTxnReason: 'Lý do (không bắt buộc)',
    jarTxnRecentHistory: 'Lịch sử gần đây',
    Installment: 'Thanh toán định kỳ',
    installmentLink: 'Liên kết khoản định kỳ',
    installmentSelectPlaceholder: 'Chọn khoản định kỳ...',
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
    budgetLeft: 'còn lại',
    budgetOver: 'vượt',
    overBudgetTip: 'Mọi thứ đều chỉ tốt khi đều ở mức vừa phải',
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
    greenTheme: 'Xanh Lá',
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
    trendControls: 'TÙY CHỌN BIỂU ĐỒ',
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
    gFeat6_title: 'So Sánh Tháng',
    gFeat6_desc: 'Bấm nút [+] trong phần Analytics Summary để so sánh số liệu với các tháng trước đó.',
    gFeat7_title: 'Chi Tiết Tháng',
    gFeat7_desc: 'Bấm vào hàng thông tin tháng trong phần Analytics Summary để xem danh sách toàn bộ giao dịch của tháng đó.',
    /* Settings tab */
    gSettings_title: '⚙️ Cài Đặt & Tùy Chỉnh',
    gSettings_intro: 'Bấm nút <strong>Cài Đặt</strong> (⚙️) trên thanh trên để mở cài đặt.',
    gRow_account_key: '👤 Tài Khoản',
    gRow_account_val: 'Quản lý hồ sơ cá nhân: đổi tên hiển thị, ảnh đại diện (avatar), hoặc đăng xuất.',
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
    gTip7_title: 'Lọc Theo Tháng',
    gTip7_desc: 'Ở danh sách giao dịch, dùng nút THÁNG NÀY / TẤT CẢ để xem riêng dữ liệu tháng hiện tại hoặc toàn bộ lịch sử.',
    gTipsNote: '<strong>Bắt đầu ngay:</strong> Đóng cửa sổ này và bấm <kbd>+ THÊM GIAO DỊCH</kbd> để ghi giao dịch đầu tiên của bạn!',
    monthlyWrapUp: 'BÁO CÁO THÁNG',
    healthScore: 'Sức Khoẻ Ngân Sách',
    startFresh: 'BẮT ĐẦU THÁNG MỚI',
    periodThisMonth: 'THÁNG NÀY',
    periodAllTime: 'TẤT CẢ',
    noPreviousData: 'Chưa có dữ liệu từ tháng trước đó.',
    resetBoxTitle: 'Chế Độ Hiển Thị Số Dư',
    resetBoxDesc: 'Bạn muốn giữ dữ liệu cũ từ tháng trước hay tiến hành reset về con số 0?',
    resetModeKeep: 'Giữ lũy kế',
    resetModeReset: 'Bắt đầu từ 0',
    reportSavingsRate: 'Tỉ lệ tích luỹ',
    reportTopSpend: 'Chi nhiều nhất',
    reportNetSavings: 'Tích luỹ ròng',
    reportTxnCount: 'Tổng giao dịch',
    reportPrevMonth: 'Tháng trước đó',
    reportThisMonth: 'Tháng vừa qua',
    reportNoData: 'Không có dữ liệu giao dịch trong kỳ này.',
    /* Wrap-up tabs & period picker */
    reportTabMonth: 'THÁNG',
    reportTabQuarter: 'QUÝ',
    reportTabYear: 'NĂM',
    quarterlyWrapUp: 'TỔNG KẾT QUÝ',
    annualWrapUp: 'TỔNG KẾT NĂM',
    wrapupBtnClose: 'ĐÓNG',
    wrapupBtnStartFresh: 'BẮT ĐẦU THÁNG MỚI',
    noDataForPeriod: 'Chưa có dữ liệu giao dịch trong kỳ này.',
    /* Quarter labels */
    q1Label: 'Q1', q2Label: 'Q2', q3Label: 'Q3', q4Label: 'Q4',
    /* Enhanced period badge labels */
    reportThisQuarter: 'Quý vừa qua',
    reportThisYear: 'Năm vừa qua',
    /* Enhanced stats labels */
    reportAvgMonthly: 'TB / tháng',
    reportTopCats: 'Top hạng mục chi tiêu',
    reportBestSavingsMonth: 'Tích luỹ tốt nhất',
    reportPeakSpendMonth: 'Chi nhiều nhất',
    reportPeakIncomeMonth: 'Thu nhập cao nhất',
    /* Footer */
    gFooterClose: 'Đóng Hướng Dẫn ✕',
    quarterTooltipNoData: "Bạn bỏ quên tui vào quý này rồi 😢",
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
    sortGroupDate: '按时间排序',
    sortGroupAmount: '按金额排序',
    sortDateDesc: '最新优先',
    sortDateAsc: '最早优先',
    sortAmountDesc: '金额从大到小',
    sortAmountAsc: '金额从小到大',
    budgetSortTitle: '预算排序',
    budgetSortLimitDesc: '限额最高',
    budgetSortLimitAsc: '限额最低',
    budgetSortRemainDesc: '余额最多',
    budgetSortRemainAsc: '余额最少',
    budgetSortCustom: '自定义（拖拽）',
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
    jarHistoryBtn: '历史记录',
    jarHistoryTitle: '存取记录',
    jarHistoryAll: '全部储蓄罐',
    jarHistoryEmpty: '暂无交易记录。',
    jarTxnReason: '原因（可选）',
    jarTxnRecentHistory: '近期记录',
    Installment: '定期付款',
    installmentLink: '关联定期项目',
    installmentSelectPlaceholder: '选择定期项目...',
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
    budgetLeft: '剩余',
    budgetOver: '超支',
    overBudgetTip: '凡事适度，方为上策',
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
    greenTheme: '绿色',
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
    trendControls: '图表选项',
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
    gFeat6_title: '月份比较',
    gFeat6_desc: '点击分析摘要中的 [+] 按钮即可与之前月份的数据进行比较。',
    gFeat7_title: '本月明细',
    gFeat7_desc: '在分析摘要中点击月份行，即可查看该特定月份的所有交易。',
    /* Settings tab */
    gSettings_title: '⚙️ 设置与自定义',
    gSettings_intro: '点击顶栏中的<strong>设置</strong>（⚙️）按钮打开设置。',
    gRow_account_key: '👤 账户',
    gRow_account_val: '管理您的个人资料：更改显示名称、头像或注销。',
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
    gTip7_title: '按月过滤',
    gTip7_desc: '在交易列表中，使用“本月”/“全部时间”按钮可仅查看当月数据或整个历史记录。',
    gTipsNote: '<strong>立即开始：</strong>关闭此窗口，点击 <kbd>添加交易</kbd> 记录您的第一笔交易！',
    monthlyWrapUp: '月度总结',
    healthScore: '预算健康',
    startFresh: '开始新的月份',
    periodThisMonth: '本月',
    periodAllTime: '全部时间',
    noPreviousData: '没有以往月份的数据。',
    resetBoxTitle: '余额显示模式',
    resetBoxDesc: '是否保留上月数据，还是每月重新归零？',
    resetModeKeep: '保留累计余额',
    resetModeReset: '每月重置',
    reportSavingsRate: '储蓄率',
    reportTopSpend: '最高消费',
    reportNetSavings: '净储蓄',
    reportTxnCount: '交易笔数',
    reportPrevMonth: '上上月',
    reportThisMonth: '上月',
    reportNoData: '此周期内没有交易数据。',
    /* Wrap-up tabs & period picker */
    reportTabMonth: '月度',
    reportTabQuarter: '季度',
    reportTabYear: '年度',
    quarterlyWrapUp: '季度总结',
    annualWrapUp: '年度总结',
    wrapupBtnClose: '关闭',
    wrapupBtnStartFresh: '开始新月份',
    noDataForPeriod: '此周期内没有交易数据。',
    /* Quarter labels */
    q1Label: 'Q1', q2Label: 'Q2', q3Label: 'Q3', q4Label: 'Q4',
    /* Enhanced period badge labels */
    reportThisQuarter: '本季',
    reportThisYear: '今年',
    /* Enhanced stats labels */
    reportAvgMonthly: '月均',
    reportTopCats: '消费最多类别',
    reportBestSavingsMonth: '最佳储蓄月',
    reportPeakSpendMonth: '消费最高月',
    reportPeakIncomeMonth: '收入最高月',
    /* Footer */
    gFooterClose: '关闭指南 ✕',
    quarterTooltipNoData: "你在这个季度把我忘啦！😢",
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
  // Update user welcoming and current date
  updateWelcomeAndDate();
  // i18n: CSS pseudo-element text (::after) cannot be translated via data-i18n,
  // so we update the data-hover-label attribute which is read via attr() in CSS
  const avatarLabels = { en: 'CHANGE PHOTO', vi: 'ĐỔI ẢNH', zh: '更换头像' };
  const avatarWrapper = document.getElementById('accountAvatarPreview');
  if (avatarWrapper) {
    avatarWrapper.dataset.hoverLabel = avatarLabels[currentLang] || 'ĐỔI ẢNH';
  }
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
  /* Focus trap for keyboard/screen reader users */
  if (window.FocusTrap) {
    _trapSettings = window.FocusTrap.trap(document.getElementById('settingsModal').querySelector('.modal-card') || document.getElementById('settingsModal'));
  }
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
  if (_trapSettings) { _trapSettings(); _trapSettings = null; }
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
const THEME_ICONS   = { dark: '\ud83c\udf19', light: '\u2600\ufe0f', cream: '\u2615', green: '\ud83c\udf3f' };
const THEME_ORDER   = ['dark', 'light', 'cream', 'green'];
const THEME_CLASSES = ['dark-theme', 'light-theme', 'cream-theme', 'green-theme'];

function _getSavedTheme() {
  try { return localStorage.getItem('caltdhy_theme') || 'dark'; } catch (_) { return 'dark'; }
}

function syncThemeCards() {
  const cur = _getSavedTheme();
  document.querySelectorAll('.theme-card').forEach(card => {
    const active = card.id === 'theme-btn-' + cur;
    card.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (window.ThemeManager && typeof window.ThemeManager.set === 'function') {
    window.ThemeManager.set(theme);
  } else {
    THEME_CLASSES.forEach(c => html.classList.remove(c));
    if (theme !== 'dark') {
      html.classList.add(theme + '-theme');
    }
    try { localStorage.setItem('caltdhy_theme', theme); } catch (_) {}
  }
  syncThemeCards();
  updateChart();
  updateTrendChart();
}

function setTheme(theme) {
  applyTheme(theme);
}

function loadTheme() {
  const saved = _getSavedTheme();
  applyTheme(saved);
}

/** Cycle to next theme */
function cycleTheme() {
  const cur = _getSavedTheme();
  const idx = THEME_ORDER.indexOf(cur);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  setTheme(next);
}

/** Select a specific theme — called by theme-card buttons in settings */
function pickTheme(theme) {
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
  const keysToRemove = [
    'caltdhy_token',
    'caltdhy_user',
    'caltdhy_txns',
    'caltdhy_budgets',
    'caltdhy_custom_cats',
    'caltdhy_hidden_cats',
    'caltdhy_last_reported_month',
    'caltdhy_is_new_user'
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));
  window.location.href = 'index.html';
}

function getInitials(name) {
  if (!name) return 'US';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] || '';
  const last = parts[parts.length - 1][0] || '';
  return (first + last).toUpperCase();
}

function initUser() {
  updateWelcomeAndDate();
}

function updateWelcomeAndDate() {
  try {
    const raw = localStorage.getItem('caltdhy_user');
    const u = raw ? JSON.parse(raw) : null;
    const name = u ? (u.name || u.username || 'USER') : 'USER';
    
    // 1. Update user welcoming greeting
    const greetingEl = document.getElementById('userGreeting');
    if (greetingEl) {
      let greeting = '';
      if (currentLang === 'vi') {
        greeting = `Xin chào, ${name}!`;
      } else if (currentLang === 'zh') {
        greeting = `你好，${name}！`;
      } else {
        greeting = `Welcome, ${name}!`;
      }
      greetingEl.textContent = greeting;
    }
    
    // 2. Update userChip avatar and name
    const chipNameEl = document.getElementById('userChipName');
    if (chipNameEl) {
      chipNameEl.textContent = name.toUpperCase().slice(0, 14);
    }
    
    const chipAvatarEl = document.getElementById('userChipAvatar');
    if (chipAvatarEl) {
      if (u && u.avatar) {
        chipAvatarEl.style.backgroundImage = `url(${u.avatar})`;
        chipAvatarEl.textContent = '';
      } else {
        chipAvatarEl.style.backgroundImage = 'none';
        chipAvatarEl.textContent = getInitials(name);
      }
    }
    
    // 3. Update system date
    const dateEl = document.getElementById('systemDate');
    if (dateEl) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const locale = currentLang === 'vi' ? 'vi-VN' : (currentLang === 'zh' ? 'zh-CN' : 'en-US');
      let dateStr = new Date().toLocaleDateString(locale, options);
      if (dateStr) {
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      }
      dateEl.textContent = dateStr;
    }
  } catch (e) {
    /* ignore */
  }
}

let selectedAvatarBase64 = '';

function openAccountModal() {
  try {
    const raw = localStorage.getItem('caltdhy_user');
    const u = raw ? JSON.parse(raw) : null;
    
    // Clear passwords
    const curPass = document.getElementById('accountCurrentPassword');
    const newPass = document.getElementById('accountNewPassword');
    if (curPass) curPass.value = '';
    if (newPass) newPass.value = '';
    
    // Clear alerts
    const errEl = document.getElementById('accountAlertError');
    const succEl = document.getElementById('accountAlertSuccess');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (succEl) { succEl.textContent = ''; succEl.style.display = 'none'; }
    
    if (u) {
      const name = u.name || u.username || 'USER';
      const email = u.email || '';
      
      const nameEl = document.getElementById('accountName');
      const emailEl = document.getElementById('accountEmail');
      if (nameEl) nameEl.value = name;
      if (emailEl) emailEl.value = email;
      
      selectedAvatarBase64 = u.avatar || '';
      
      updateAccountAvatarPreview(name);
    }
    
    const modal = document.getElementById('accountModal');
    if (modal) modal.classList.add('open');
  } catch (e) {
    console.error('Error opening account modal:', e);
  }
}

function updateAccountAvatarPreview(name) {
  const preview = document.getElementById('accountAvatarPreview');
  const placeholder = document.getElementById('accountAvatarPlaceholder');
  if (preview && placeholder) {
    if (selectedAvatarBase64) {
      preview.style.backgroundImage = `url(${selectedAvatarBase64})`;
      placeholder.textContent = '';
    } else {
      preview.style.backgroundImage = 'none';
      placeholder.textContent = getInitials(name);
    }
  }
}

function closeAccountModal() {
  const modal = document.getElementById('accountModal');
  if (modal) modal.classList.remove('open');
}

function closeAccountModalOnOverlay(e) {
  if (e.target === document.getElementById('accountModal')) {
    closeAccountModal();
  }
}

function triggerAvatarSelection() {
  const fileInput = document.getElementById('accountAvatarInput');
  if (fileInput) fileInput.click();
}

function handleAvatarChange(e) {
  try {
    const fileInput = e.target;
    const file = fileInput.files[0];
    if (!file) return;
    
    const errEl = document.getElementById('accountAlertError');
    const succEl = document.getElementById('accountAlertSuccess');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (succEl) { succEl.textContent = ''; succEl.style.display = 'none'; }
    
    // Check file size limit: 1MB = 1,048,576 bytes
    if (file.size > 1024 * 1024) {
      if (errEl) {
        errEl.textContent = currentLang === 'vi' 
          ? 'Dung lượng ảnh vượt quá 1MB. Vui lòng chọn ảnh khác nhẹ hơn.'
          : (currentLang === 'zh' ? '图片大小超过 1MB。请选择较小的图片。' : 'Image size exceeds 1MB. Please choose a smaller image.');
        errEl.style.display = 'block';
      }
      fileInput.value = ''; // Reset input
      return;
    }
    
    // Validate it's an image file
    if (!file.type.startsWith('image/')) {
      if (errEl) {
        errEl.textContent = currentLang === 'vi'
          ? 'Tệp đã chọn không phải định dạng hình ảnh hợp lệ.'
          : (currentLang === 'zh' ? '所选文件不是有效的图片格式。' : 'Selected file is not a valid image format.');
        errEl.style.display = 'block';
      }
      fileInput.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
      selectedAvatarBase64 = event.target.result;
      const nameEl = document.getElementById('accountName');
      updateAccountAvatarPreview(nameEl ? nameEl.value : 'USER');
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Error handling avatar change:', error);
  }
}

async function handleSaveProfile(e) {
  e.preventDefault();
  
  const errEl = document.getElementById('accountAlertError');
  const succEl = document.getElementById('accountAlertSuccess');
  const btnSave = document.getElementById('btnSaveAccount');
  
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (succEl) { succEl.textContent = ''; succEl.style.display = 'none'; }
  
  const nameEl = document.getElementById('accountName');
  const emailEl = document.getElementById('accountEmail');
  const curPassEl = document.getElementById('accountCurrentPassword');
  const newPassEl = document.getElementById('accountNewPassword');
  
  const name = nameEl ? nameEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const currentPassword = curPassEl ? curPassEl.value : '';
  const newPassword = newPassEl ? newPassEl.value : '';
  
  if (!name || !email) {
    if (errEl) {
      errEl.textContent = currentLang === 'vi' ? 'Vui lòng nhập đầy đủ tên và email.' : (currentLang === 'zh' ? '请输入姓名和电子邮件。' : 'Please enter your name and email.');
      errEl.style.display = 'block';
    }
    return;
  }
  
  // Disable button and show loading state
  const originalBtnText = btnSave ? btnSave.textContent : 'LƯU THAY ĐỔI';
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = currentLang === 'vi' ? 'ĐANG LƯU...' : (currentLang === 'zh' ? '正在保存...' : 'SAVING...');
  }
  
  try {
    const payload = {
      name,
      email,
      avatar: selectedAvatarBase64,
      currentPassword,
      newPassword
    };
    
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    
    const resData = await response.json();
    
    if (response.ok && resData.success) {
      // Lưu token và user mới vào localStorage
      localStorage.setItem('caltdhy_user', JSON.stringify(resData.user));
      localStorage.setItem('caltdhy_token', resData.token);
      
      // Update UI immediately
      updateWelcomeAndDate();
      
      if (succEl) {
        succEl.textContent = currentLang === 'vi' ? 'Cập nhật tài khoản thành công!' : (currentLang === 'zh' ? '账户更新成功！' : 'Account updated successfully!');
        succEl.style.display = 'block';
      }
      
      // Close modal after 1s
      setTimeout(() => {
        closeAccountModal();
      }, 1000);
    } else {
      if (errEl) {
        errEl.textContent = resData.message || (currentLang === 'vi' ? 'Cập nhật thất bại. Vui lòng kiểm tra lại.' : 'Update failed.');
        errEl.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    if (errEl) {
      errEl.textContent = currentLang === 'vi' ? 'Đã xảy ra lỗi kết nối máy chủ.' : 'Server connection error.';
      errEl.style.display = 'block';
    }
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = originalBtnText;
    }
  }
}

/* ============================================================
   BUDGET MODAL (Set Budgets)
   ============================================================ */
function openBudgetModal() {
  const grid = document.getElementById('budgetFormGrid');
  const modal = document.getElementById('budgetModal');
  if (!grid) {
    if (modal) modal.classList.add('open');
    return;
  }

  // Reset category type selection if the modal is currently closed
  const isAlreadyOpen = modal && modal.classList.contains('open');
  if (!isAlreadyOpen) {
    setNewCatType('expense');
  }

  // Use getCategoryType() to correctly group default AND custom categories
  const allCats = getAllCategories();
  const expenseCats = allCats.filter(c => getCategoryType(c) === 'expense');
  const incomeCats  = allCats.filter(c => getCategoryType(c) === 'income');

  /* Helper: convert stored VND to display currency for pre-fill */
  function toDisplay(vnd) {
    if (!vnd) return '';
    if (currentCurrency === 'USD') return +(vnd / EXCHANGE_RATE).toFixed(2);
    if (currentCurrency === 'CNY') return +(vnd / CNY_RATE).toFixed(2);
    return vnd;
  }

  function renderRow(cat) {
    const safeId = 'budget-input-' + cat.replace(/[^a-z0-9]/gi, '_');
    const icon = CAT_ICONS[cat] || '\u2713';
    const label = escHtml(tCat(cat));
    const val = toDisplay(budgets[cat]);
    const isCustom = customCategories.findIndex(c => c.name === cat) !== -1;

    // Custom → xóa vĩnh viễn | Default → ẩn (có undo 5 giây)
    const xBtn = isCustom
      ? `<button type="button" class="btn-delete-cat btn-delete-cat--custom"
            onclick="deleteCustomCategory('${escHtml(cat)}')"
            title="Xóa danh mục" aria-label="Xóa danh mục tùy chỉnh">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>`
      : `<button type="button" class="btn-delete-cat btn-delete-cat--default"
            onclick="hideDefaultCategory('${escHtml(cat)}')"
            title="Ẩn danh mục này" aria-label="Ẩn danh mục mặc định">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>`;

    return `
      <div class="budget-form-row" data-cat="${escHtml(cat)}">
        <label class="budget-form-label" for="${safeId}">${icon} ${label}</label>
        <div class="budget-input-wrapper">
          <input class="budget-form-input" id="${safeId}" type="number" min="0" step="1" placeholder="0" value="${val}" />
          ${xBtn}
        </div>
      </div>`;
  }

  /* Divider header cho mỗi nhóm */
  function groupHeader(labelText, type) {
    return `<div class="budget-group-header budget-group-header--${type}">${labelText}</div>`;
  }

  let html = '';
  if (expenseCats.length > 0) {
    html += groupHeader('💸 Chi tiêu', 'expense');
    html += expenseCats.map(renderRow).join('');
  }
  if (incomeCats.length > 0) {
    html += groupHeader('💰 Thu nhập', 'income');
    html += incomeCats.map(renderRow).join('');
  }

  grid.innerHTML = html;
  document.getElementById('budgetModal').classList.add('open');
  /* Focus trap */
  if (window.FocusTrap) {
    _trapBudget = window.FocusTrap.trap(document.getElementById('budgetModal').querySelector('.modal-card') || document.getElementById('budgetModal'));
  }
}


function closeBudgetModal() {
  document.getElementById('budgetModal').classList.remove('open');
  if (_trapBudget) { _trapBudget(); _trapBudget = null; }
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

  // Flush unsaved form edits so other inputs are not lost on modal rebuild
  saveCurrentInputValuesToBudgets();

  const name = nameEl.value.trim();
  const raw = parseFloat(limitEl.value);

  if (!name) { showToast('\u26a0 Enter a category name.'); return; }
  const allExisting = [...CATEGORIES, ...customCategories.map(c => c.name)];
  if (allExisting.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
    showToast('\u26a0 Category already exists.'); return;
  }

  // Store as { name, type } object using currently selected type
  customCategories.push({ name, type: newCatType });
  saveCustomCategories();

  if (!isNaN(raw) && raw > 0) {
    budgets[name] = currentCurrency === 'USD' ? Math.round(raw * EXCHANGE_RATE)
      : currentCurrency === 'CNY' ? Math.round(raw * CNY_RATE)
        : Math.round(raw);
    saveBudgets();
  }

  // Bug 2: Sync danh mục mới vào categoryOrder để thứ tự custom không bị mất.
  // Danh mục mới được thêm vào cuối thứ tự hiện tại.
  if (!categoryOrder.includes(name)) {
    categoryOrder.push(name);
    saveCategoryOrder();
  }

  nameEl.value = '';
  limitEl.value = '';
  // Close type dropdown if open
  const dd = document.getElementById('newCatTypeDropdown');
  if (dd) dd.classList.remove('open');

  showToast('\u2713 "' + name + '" ' + t('categoryAdded'));
  openBudgetModal();    // rebuild grid rows to include new cat
  renderBudgetPanel();
}

function setNewCatType(type) {
  newCatType = type;

  // Update trigger button class and label text
  const btn = document.getElementById('btnNewCatType');
  if (btn) {
    btn.className = 'btn-new-cat-type is-' + type;
  }

  const labelSpan = document.getElementById('newCatTypeLabel');
  if (labelSpan) {
    const icon = type === 'expense' ? '💸' : '💰';
    const textKey = type === 'expense' ? 'typeExpense' : 'typeIncome';
    labelSpan.innerHTML = icon + ' <span data-i18n="' + textKey + '">' + t(textKey) + '</span>';
  }

  // Update selected class inside the options list
  const optExpense = document.getElementById('typeOptExpense');
  const optIncome = document.getElementById('typeOptIncome');
  if (optExpense && optIncome) {
    if (type === 'expense') {
      optExpense.classList.add('selected');
      optExpense.setAttribute('aria-selected', 'true');
      optIncome.classList.remove('selected');
      optIncome.setAttribute('aria-selected', 'false');
    } else {
      optIncome.classList.add('selected');
      optIncome.setAttribute('aria-selected', 'true');
      optExpense.classList.remove('selected');
      optExpense.setAttribute('aria-selected', 'false');
    }
  }

  // Close the dropdown
  const dd = document.getElementById('newCatTypeDropdown');
  if (dd) {
    dd.classList.remove('open');
  }
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
  }
}

function toggleNewCatTypeDropdown(event) {
  if (event) event.stopPropagation();
  const dd = document.getElementById('newCatTypeDropdown');
  const btn = document.getElementById('btnNewCatType');
  if (!dd) return;

  const isOpen = dd.classList.toggle('open');
  if (btn) {
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
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
  // Load rail collapse preference
  if (localStorage.getItem('railCollapsed') === 'true') {
    const body = document.querySelector('.app-body');
    if (body) body.classList.add('rail-collapsed');
  }

  initUser();
  loadHiddenCategories();  // Load trước để getAllCategories() filter đúng
  loadCustomCategories();
  loadCategoryOrder();     // Load thứ tự danh mục do user tùy chỉnh
  loadTransactions();
  loadBudgets();
  loadBalanceResetMode(); // Load trước calcMetrics để số dư tính đúng chế độ
  calcMetrics();
  renderFeed();
  renderBudgetPanel();
  updateChart();
  loadLang();
  loadCurrency();
  loadTheme();
  checkNewPeriodTransitions();

  /* Initialize premium custom selects */
  initCustomDropdown('txnCat');
  initCustomDropdown('qlCat');
  initCustomDropdown('txnInstallmentLink');

  const txnCatSel = document.getElementById('txnCat');
  if (txnCatSel) {
    txnCatSel.addEventListener('change', (e) => {
      onCatChange(e.target.value);
    });
  }

  const linkSel = document.getElementById('txnInstallmentLink');
  if (linkSel) {
    linkSel.addEventListener('change', (e) => {
      const instId = e.target.value;
      const inst = installments.find(i => i.id === instId);
      if (inst) {
        const amtEl = document.getElementById('txnAmount');
        const descEl = document.getElementById('txnDesc');
        if (amtEl) amtEl.value = inst.amount;
        if (descEl) descEl.value = `Thanh toán: ${inst.name}`;
      }
    });
  }

  // Try to sync with MacBook local file-server
  syncLoadFromServer();

  /* Quick Log form — Enter key support */
  const qlForm = document.getElementById('qlForm');
  if (qlForm) qlForm.addEventListener('submit', handleQuickLog);

  /* Budget form */
  const bForm = document.getElementById('budgetForm');
  if (bForm) bForm.addEventListener('submit', handleSaveBudgets);

  /* Sort dropdown — init and close on outside click */
  renderFeedSortDropdown();
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('feedSortWrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeFeedSort();
    }

    const bSortWrapper = document.getElementById('budgetSortWrapper');
    if (bSortWrapper && !bSortWrapper.contains(e.target)) {
      closeBudgetSort();
    }

    // Close new category type dropdown when clicking outside
    const dd = document.getElementById('newCatTypeDropdown');
    const trigger = document.getElementById('btnNewCatType');
    if (dd && !dd.contains(e.target) && trigger && !trigger.contains(e.target)) {
      dd.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  /* Lần đầu tiên đăng ký tài khoản -> hiển thị hướng dẫn sử dụng */
  if (localStorage.getItem('caltdhy_is_new_user') === 'true') {
    openGuide();
    localStorage.removeItem('caltdhy_is_new_user');
  }
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
window.toggleFeedSort = toggleFeedSort;
window.changeFeedSort = changeFeedSort;
window.closeFeedSort = closeFeedSort;
window.renderFeedSortDropdown = renderFeedSortDropdown;
window.toggleBudgetSort = toggleBudgetSort;
window.changeBudgetSort = changeBudgetSort;
window.closeBudgetSort = closeBudgetSort;
window.renderBudgetSortDropdown = renderBudgetSortDropdown;
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
window.hideDefaultCategory  = hideDefaultCategory;
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
window.setNewCatType = setNewCatType;
window.toggleNewCatTypeDropdown = toggleNewCatTypeDropdown;

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

// Account Management Exposures
window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.closeAccountModalOnOverlay = closeAccountModalOnOverlay;
window.triggerAvatarSelection = triggerAvatarSelection;
window.handleAvatarChange = handleAvatarChange;
window.handleSaveProfile = handleSaveProfile;

/* ============================================================
   ANALYTICS COMPARE
   ============================================================ */
function toggleCompareMenu(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('compareDropdown');
  if (!dropdown) return;

  // Build list of months that have data, excluding current selected month
  const { month: activeM, year: activeY } = currentMonthYear();
  const dataMonths = new Set();
  transactions.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    dataMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
  });

  const available = Array.from(dataMonths).filter(my => my !== `${activeY}-${activeM}`);
  available.sort((a, b) => b.localeCompare(a)); // Descending

  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';

  if (available.length === 0) {
    dropdown.innerHTML = `<div style="padding: 10px 12px; font-size: 12px; color: var(--accent); font-weight: 500; text-align: center;">${t('noPreviousData')}</div>`;
    dropdown.classList.add('show');
    // Auto-hide after 3 seconds
    setTimeout(() => {
      dropdown.classList.remove('show');
    }, 3000);
  } else {
    dropdown.innerHTML = available.map(my => {
      const [y, m] = my.split('-');
      const d = new Date(y, m, 1);
      const name = d.toLocaleString(locale, { month: 'short' }).toUpperCase() + ' ' + y;
      return `<button class="compare-item" onclick="selectCompareMonth(${m}, ${y})">${name}</button>`;
    }).join('');
    dropdown.classList.toggle('show');
  }
}

function selectCompareMonth(m, y) {
  compareMonthYear = { month: parseInt(m), year: parseInt(y) };
  const dropdown = document.getElementById('compareDropdown');
  if (dropdown) dropdown.classList.remove('show');
  updateAnalyticsSummary();
}

function clearCompareMonth(e) {
  if (e) e.stopPropagation();
  compareMonthYear = null;
  updateAnalyticsSummary();
}

// Close compare dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('compareDropdown');
  if (dropdown && dropdown.classList.contains('show') && !e.target.closest('#compareWrapper')) {
    dropdown.classList.remove('show');
  }
});

window.toggleCompareMenu = toggleCompareMenu;
window.selectCompareMonth = selectCompareMonth;
window.clearCompareMonth = clearCompareMonth;

/* ============================================================
   MONTHLY WRAP-UP MODAL
   ============================================================ */

/**
 * Tính toán các chỉ số tổng hợp của một tháng cụ thể.
 * Trả về: { totalIncome, totalExpense, savings, savingsRate, topCat, topCatAmt, txnCount }
 */
function calcMonthStats(month, year) {
  let totalIncome = 0;
  let totalExpense = 0;
  const totalsByCat = {};
  let txnCount = 0;

  transactions.forEach(txn => {
    const d = new Date(txn.date + 'T00:00:00');
    if (d.getMonth() !== month || d.getFullYear() !== year) return;
    txnCount++;
    if (txn.type === 'income') {
      totalIncome += txn.amount;
    } else {
      totalExpense += txn.amount;
      totalsByCat[txn.category] = (totalsByCat[txn.category] || 0) + txn.amount;
    }
  });

  const savings = totalIncome - totalExpense;
  const savingsRate = totalExpense > 0 ? - (totalIncome / totalExpense) * 100 : 0;

  let topCat = null;
  let topCatAmt = 0;
  Object.keys(totalsByCat).forEach(c => {
    if (totalsByCat[c] > topCatAmt) {
      topCat = c;
      topCatAmt = totalsByCat[c];
    }
  });

  return { totalIncome, totalExpense, savings, savingsRate, topCat, topCatAmt, txnCount };
}

/**
 * Render HTML cho một cột trong báo cáo tháng.
 * @param {string} headerLabel – Tiêu đề cột (tên tháng/năm)
 * @param {boolean} isCurrent – true nếu là cột tháng chính (Month A)
 * @param {object} stats – object từ calcMonthStats()
 * @param {object|null} compareStats – stats của tháng kia để so sánh (nếu có)
 */
function buildReportColumnHTML(headerLabel, isCurrent, stats, compareStats) {
  const hasData = stats.txnCount > 0;

  function winner(field) {
    if (!isCurrent || !compareStats) return false;
    if (field === 'savingsRate') return stats.savingsRate > compareStats.savingsRate;
    if (field === 'topCatAmt') return stats.topCatAmt < compareStats.topCatAmt && stats.topCatAmt > 0;
    if (field === 'savings') return stats.savings > compareStats.savings;
    return false;
  }

  const savingsRateDisplay = hasData ? `${stats.savingsRate.toFixed(1)}%` : '--';
  const topSpendDisplay = stats.topCat
    ? `${tCat(stats.topCat)}: ${fmt(stats.topCatAmt)}`
    : (hasData ? t('reportNoData').split('.')[0] : '--');
  const netSavingsDisplay = hasData ? `${stats.savings >= 0 ? '+' : ''}${fmt(stats.savings)}` : '--';
  const txnCountDisplay = stats.txnCount.toString();

  const colClass = isCurrent ? 'report-col report-col--current' : 'report-col report-col--prev';

  // Dynamic badge label based on active tab
  const badgeKey = currentReportTab === 'year'
    ? 'reportThisYear'
    : currentReportTab === 'quarter'
      ? 'reportThisQuarter'
      : 'reportThisMonth';
  const badgeHTML = isCurrent
    ? `<span class="report-col__header-badge">${t(badgeKey)}</span>`
    : '';

  // ── Monthly view: simple 4-row layout ──
  if (currentReportTab === 'month') {
    return `
    <div class="${colClass}">
      <div class="report-col__header">
        ${escHtml(headerLabel)} ${badgeHTML}
      </div>
      <div class="report-stat ${winner('savingsRate') ? 'report-stat--winner' : ''}">
        <span class="report-stat__label">${t('reportSavingsRate')}</span>
        <span class="report-stat__value">${savingsRateDisplay}</span>
      </div>
      <div class="report-stat ${winner('topCatAmt') ? 'report-stat--winner' : ''}">
        <span class="report-stat__label">${t('reportTopSpend')}</span>
        <span class="report-stat__value" style="font-size:12px;">${escHtml(topSpendDisplay)}</span>
      </div>
      <div class="report-stat ${winner('savings') ? 'report-stat--winner' : ''}">
        <span class="report-stat__label">${t('reportNetSavings')}</span>
        <span class="report-stat__value" style="color: ${stats.savings >= 0 ? 'var(--green)' : 'var(--accent)'}">${netSavingsDisplay}</span>
      </div>
      <div class="report-stat">
        <span class="report-stat__label">${t('reportTxnCount')}</span>
        <span class="report-stat__value">${txnCountDisplay}</span>
      </div>
    </div>`;
  }

  // ── Quarter / Year view: enhanced layout ──
  const numMonths = stats.activeMonths || (currentReportTab === 'year' ? 12 : 3);
  const avgIncome  = hasData ? fmt(Math.round(stats.totalIncome  / numMonths)) : '--';
  const avgExpense = hasData ? fmt(Math.round(stats.totalExpense / numMonths)) : '--';

  // Top 3 categories progress bars
  const topCatsHTML = (() => {
    if (!hasData || !stats.topCategories || stats.topCategories.length === 0) {
      return `<span style="font-size:10px; color: var(--muted)">--</span>`;
    }
    return stats.topCategories.map(cat => `
      <div class="report-cat-row">
        <div class="report-cat-info">
          <span class="report-cat-name">${escHtml(tCat(cat.category))}</span>
          <span class="report-cat-pct">${cat.percent.toFixed(0)}%</span>
          <span class="report-cat-amt">${fmt(cat.amount)}</span>
        </div>
        <div class="report-cat-bar-bg">
          <div class="report-cat-bar-fill" style="width:${Math.min(100, cat.percent).toFixed(1)}%"></div>
        </div>
      </div>`).join('');
  })();

  // Monthly extremes rows
  const isYear = currentReportTab === 'year';
  const extremesHTML = (() => {
    if (!hasData) return '';
    const rows = [];
    if (stats.bestSavingsMonthLabel && stats.bestSavingsMonthLabel !== '--') {
      rows.push(`<div class="report-extreme-row">
        <span class="report-extreme-label">${t('reportBestSavingsMonth')}</span>
        <span class="report-extreme-value report-extreme-value--positive">${escHtml(stats.bestSavingsMonthLabel)}</span>
      </div>`);
    }
    if (stats.peakSpendMonthLabel && stats.peakSpendMonthLabel !== '--') {
      rows.push(`<div class="report-extreme-row">
        <span class="report-extreme-label">${t('reportPeakSpendMonth')}</span>
        <span class="report-extreme-value report-extreme-value--accent">${escHtml(stats.peakSpendMonthLabel)}</span>
      </div>`);
    }
    if (isYear && stats.peakIncomeMonthLabel && stats.peakIncomeMonthLabel !== '--') {
      rows.push(`<div class="report-extreme-row">
        <span class="report-extreme-label">${t('reportPeakIncomeMonth')}</span>
        <span class="report-extreme-value report-extreme-value--positive">${escHtml(stats.peakIncomeMonthLabel)}</span>
      </div>`);
    }
    return rows.length ? `<div class="report-extremes">${rows.join('')}</div>` : '';
  })();

  return `
    <div class="${colClass}">
      <div class="report-col__header">
        ${escHtml(headerLabel)} ${badgeHTML}
      </div>
      <div class="report-col-body">
        <div class="report-col-body-left">
          <div class="report-stat ${winner('savingsRate') ? 'report-stat--winner' : ''}">
            <span class="report-stat__label">${t('reportSavingsRate')}</span>
            <span class="report-stat__value">${savingsRateDisplay}</span>
          </div>
          <div class="report-stat ${winner('savings') ? 'report-stat--winner' : ''}">
            <span class="report-stat__label">${t('reportNetSavings')}</span>
            <span class="report-stat__value" style="color: ${stats.savings >= 0 ? 'var(--green)' : 'var(--accent)'}">${netSavingsDisplay}</span>
          </div>
          <div class="report-stat">
            <span class="report-stat__label">INCOME</span>
            <span class="report-stat__value" style="color:var(--green)">${hasData ? fmt(stats.totalIncome) : '--'}</span>
            ${hasData ? `<span class="report-stat__sub">${t('reportAvgMonthly')}: ${avgIncome}</span>` : ''}
          </div>
          <div class="report-stat">
            <span class="report-stat__label">EXPENSE</span>
            <span class="report-stat__value" style="color:var(--accent)">${hasData ? fmt(stats.totalExpense) : '--'}</span>
            ${hasData ? `<span class="report-stat__sub">${t('reportAvgMonthly')}: ${avgExpense}</span>` : ''}
          </div>
          <div class="report-stat">
            <span class="report-stat__label">${t('reportTxnCount')}</span>
            <span class="report-stat__value">${txnCountDisplay}</span>
          </div>
        </div>
        <div class="report-col-body-right">
          <div class="report-stat">
            <span class="report-stat__label">${t('reportTopCats')}</span>
            <div class="report-top-cats">${topCatsHTML}</div>
          </div>
          ${extremesHTML}
        </div>
      </div>
    </div>`;
}


function checkNewMonthTransition() {
  const lastReported = localStorage.getItem('caltdhy_last_reported_month');
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  if (!lastReported) {
    // First time running, just set it and skip
    localStorage.setItem('caltdhy_last_reported_month', currentMonthKey);
    return;
  }

  if (lastReported !== currentMonthKey) {
    // We crossed into a new month!
    const [lastY, lastM] = lastReported.split('-');
    showMonthlyReport(parseInt(lastM), parseInt(lastY));
    localStorage.setItem('caltdhy_last_reported_month', currentMonthKey);
  }
}

function showMonthlyReport(month, year) {
  const modal = document.getElementById('monthlyReportModal');
  if (!modal) return;

  // Sync tab to 'month' and set modal as auto-popup (not manual)
  currentReportTab = 'month';
  _wrapupIsManual = false;
  const closeBtn = document.getElementById('reportCloseBtn');
  if (closeBtn) closeBtn.style.display = 'none';
  const actionBtn = document.getElementById('reportActionBtn');
  if (actionBtn) actionBtn.textContent = t('startFresh');
  const resetBox = document.getElementById('reportResetBox');
  if (resetBox) resetBox.style.display = '';
  ['month', 'quarter', 'year'].forEach(k => {
    const btn = document.getElementById(`rtab-${k}`);
    if (!btn) return;
    btn.classList.toggle('active', k === 'month');
    btn.setAttribute('aria-selected', String(k === 'month'));
  });

  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';

  // Tiêu đề modal: tháng/năm vừa qua (Month A)
  const monthADate = new Date(year, month, 1);
  const monthAName = monthADate.toLocaleString(locale, { month: 'long' }).toUpperCase();
  document.getElementById('reportMonthLabel').innerText = `${monthAName} ${year}`;

  // Populate period dropdown and pre-select current month
  const sel = document.getElementById('reportPeriodSelect');
  if (sel) {
    const seen = new Set();
    transactions.forEach(txn => {
      const d = new Date(txn.date + 'T00:00:00');
      seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    // Ensure the reported month is always in the list
    const reportedKey = `${year}-${month}`;
    seen.add(reportedKey);
    const sorted = Array.from(seen).sort((a, b) => b.localeCompare(a));
    sel.innerHTML = '';
    sorted.forEach(key => {
      const [y, m] = key.split('-');
      const d = new Date(parseInt(y), parseInt(m), 1);
      const label = d.toLocaleString(locale, { month: 'long', year: 'numeric' }).toUpperCase();
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      if (key === reportedKey) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // Tính stats Month A (tháng vừa qua)
  const statsA = calcMonthStats(month, year);

  // Tính Month B (tháng trước đó)
  const monthBDate = new Date(year, month - 1, 1);
  const prevMonth = monthBDate.getMonth();
  const prevYear = monthBDate.getFullYear();
  const statsB = calcMonthStats(prevMonth, prevYear);
  const hasPrevData = statsB.txnCount > 0;

  // Render comparison grid
  const grid = document.getElementById('reportComparisonGrid');
  if (grid) {
    if (hasPrevData) {
      grid.className = 'report-comparison-grid';
      const monthBName = monthBDate.toLocaleString(locale, { month: 'short' }).toUpperCase() + ' ' + prevYear;
      const monthALabel = monthADate.toLocaleString(locale, { month: 'short' }).toUpperCase() + ' ' + year;
      // Cột trái = tháng trước đó (Month B), cột phải = tháng vừa qua (Month A)
      grid.innerHTML =
        buildReportColumnHTML(monthBName, false, statsB, statsA) +
        buildReportColumnHTML(monthALabel, true, statsA, statsB);
    } else {
      grid.className = 'report-comparison-grid single-column';
      const monthALabel = monthADate.toLocaleString(locale, { month: 'short' }).toUpperCase() + ' ' + year;
      grid.innerHTML = buildReportColumnHTML(monthALabel, true, statsA, null);
    }
  }

  // Render message động
  const msgEl = document.getElementById('reportMessage');
  if (msgEl) {
    let msg = '';
    if (statsA.txnCount === 0) {
      msg = t('reportNoData');
    } else if (statsA.savings >= 0) {
      if (statsA.savingsRate >= 30) {
        msg = currentLang === 'vi'
          ? `🎉 Xuất sắc! Bạn đã tích luỹ <strong>${statsA.savingsRate.toFixed(0)}%</strong> thu nhập tháng này. Hãy tiếp tục phong độ đó!`
          : currentLang === 'zh'
          ? `🎉 出色！本月储蓄率达 <strong>${statsA.savingsRate.toFixed(0)}%</strong>。继续保持！`
          : `🎉 Excellent! You saved <strong>${statsA.savingsRate.toFixed(0)}%</strong> of your income this month. Keep it up!`;
      } else {
        msg = currentLang === 'vi'
          ? `✅ Tháng ${monthAName} kết thúc với tích luỹ ròng <strong>${fmt(statsA.savings)}</strong>. Tốt lắm!`
          : currentLang === 'zh'
          ? `✅ 本月净储蓄 <strong>${fmt(statsA.savings)}</strong>。干得漂亮！`
          : `✅ You finished ${monthAName} with a net saving of <strong>${fmt(statsA.savings)}</strong>. Well done!`;
      }
    } else {
      msg = currentLang === 'vi'
        ? `⚠️ Chi tiêu vượt thu nhập <strong>${fmt(Math.abs(statsA.savings))}</strong> trong tháng này. Hãy cân nhắc điều chỉnh ngân sách tháng tới nhé!`
        : currentLang === 'zh'
        ? `⚠️ 本月支出超出收入 <strong>${fmt(Math.abs(statsA.savings))}</strong>。下月注意调整预算！`
        : `⚠️ Spending exceeded income by <strong>${fmt(Math.abs(statsA.savings))}</strong> this month. Consider adjusting your budget next month.`;
    }
    msgEl.innerHTML = msg;
  }

  // Sync segmented control to current mode
  syncResetModeUI();

  modal.style.display = 'flex';
  modal.classList.add('open');
}

function closeMonthlyReport() {
  const modal = document.getElementById('monthlyReportModal');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
  }
  // Reset quarter grid year so next open re-inits to most-recent year
  window._qGridYear = null;
}

/* ============================================================
   BALANCE RESET MODE
   ============================================================ */
function loadBalanceResetMode() {
  const saved = localStorage.getItem(BALANCE_RESET_KEY);
  balanceResetMode = (saved === 'reset') ? 'reset' : 'keep';
  syncResetModeUI();
}

function syncResetModeUI() {
  const btnKeep = document.getElementById('segBtnKeep');
  const btnReset = document.getElementById('segBtnReset');
  if (!btnKeep || !btnReset) return;
  if (balanceResetMode === 'reset') {
    btnReset.classList.add('active');
    btnKeep.classList.remove('active');
  } else {
    btnKeep.classList.add('active');
    btnReset.classList.remove('active');
  }
}

function setBalanceResetMode(mode) {
  if (mode !== 'keep' && mode !== 'reset') return;
  balanceResetMode = mode;
  localStorage.setItem(BALANCE_RESET_KEY, mode);
  syncResetModeUI();
  // Cập nhật lại số dư ngay lập tức
  calcMetrics();
  const modeLabel = mode === 'reset'
    ? (currentLang === 'vi' ? 'Bắt đầu từ 0 ✓' : currentLang === 'zh' ? '已设为每月重置 ✓' : 'Reset each month ✓')
    : (currentLang === 'vi' ? 'Giữ lũy kế ✓' : currentLang === 'zh' ? '已设为保留累计 ✓' : 'Running total kept ✓');
  showToast(modeLabel);
}

window.checkNewMonthTransition = checkNewMonthTransition; // kept for backward compat
window.showMonthlyReport = showMonthlyReport;
window.closeMonthlyReport = closeMonthlyReport;
window.setBalanceResetMode = setBalanceResetMode;
window.loadBalanceResetMode = loadBalanceResetMode;

/* ============================================================
   PERIOD TRANSITION CHECKER (Month / Quarter / Year)
   ============================================================ */

/**
 * Checks all three cycle keys (month, quarter, year).
 * Triggers wrapup modal auto-popup for the largest changed cycle.
 */
function checkNewPeriodTransitions() {
  const now = new Date();
  const curMonth   = `${now.getFullYear()}-${now.getMonth()}`;
  const curQ       = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  const curYear    = `${now.getFullYear()}`;

  const lastMonth  = localStorage.getItem('caltdhy_last_reported_month');
  const lastQ      = localStorage.getItem('caltdhy_last_reported_quarter');
  const lastYear   = localStorage.getItem('caltdhy_last_reported_year');

  // First-time init — just save and exit
  if (!lastMonth && !lastQ && !lastYear) {
    localStorage.setItem('caltdhy_last_reported_month',   curMonth);
    localStorage.setItem('caltdhy_last_reported_quarter', curQ);
    localStorage.setItem('caltdhy_last_reported_year',    curYear);
    return;
  }

  const monthChanged   = lastMonth  && lastMonth  !== curMonth;
  const quarterChanged = lastQ      && lastQ      !== curQ;
  const yearChanged    = lastYear   && lastYear   !== curYear;

  // Always update storage first
  localStorage.setItem('caltdhy_last_reported_month',   curMonth);
  localStorage.setItem('caltdhy_last_reported_quarter', curQ);
  localStorage.setItem('caltdhy_last_reported_year',    curYear);

  // Handle first-time init for individual keys (partial migration)
  if (!lastMonth)  { return; }
  if (!lastQ)      { localStorage.setItem('caltdhy_last_reported_quarter', curQ); }
  if (!lastYear)   { localStorage.setItem('caltdhy_last_reported_year',    curYear); }

  // If the month has changed, we ALWAYS show the Monthly Report because it has the action: "Bắt đầu tháng mới" (Start Fresh/Reset budget)
  if (monthChanged) {
    const [lastY, lastM] = lastMonth.split('-');
    _wrapupIsManual = false;
    showMonthlyReport(parseInt(lastM), parseInt(lastY));

    // Show optional toast to notify user that Quarterly or Annual reports are also ready
    if (yearChanged) {
      setTimeout(() => {
        const msg = currentLang === 'vi'
          ? '🎉 Báo cáo Năm mới đã sẵn sàng! Nhấp vào tab NĂM để xem.'
          : currentLang === 'zh'
          ? '🎉 新年度总结已准备就绪！点击“年”标签查看。'
          : '🎉 New Annual Report is ready! Click on the YEAR tab to view.';
        showToast(msg, 4000);
      }, 1000);
    } else if (quarterChanged) {
      setTimeout(() => {
        const msg = currentLang === 'vi'
          ? '🎉 Báo cáo Quý mới đã sẵn sàng! Nhấp vào tab QUÝ để xem.'
          : currentLang === 'zh'
          ? '🎉 新季度总结已准备就绪！点击“季”标签查看。'
          : '🎉 New Quarterly Report is ready! Click on the QUARTER tab to view.';
        showToast(msg, 4000);
      }, 1000);
    }
  } else if (quarterChanged) {
    // Show the PREVIOUS quarter's report (fallback if quarter changes without month)
    const [prevQY, qPart] = lastQ.split('-Q');
    _wrapupIsManual = false;
    openWrapupModal('quarter', parseInt(prevQY), parseInt(qPart));
  } else if (yearChanged) {
    // Show the PREVIOUS year's annual report (fallback if year changes without month)
    const [prevY] = lastYear.split('-');
    _wrapupIsManual = false;
    openWrapupModal('year', parseInt(prevY));
  }
}

/* ============================================================
   QUARTERLY & ANNUAL STATS CALCULATORS
   ============================================================ */

/**
 * Returns aggregated stats for a given quarter of a year.
 * quarter: 1-4
 */
function calcQuarterStats(quarter, year) {
  let totalIncome = 0;
  let totalExpense = 0;
  const totalsByCat = {};
  let txnCount = 0;
  const firstMonth = (quarter - 1) * 3;
  const lastMonth  = firstMonth + 2;

  // Per-month breakdown for extremes
  const byMonth = {};
  for (let m = firstMonth; m <= lastMonth; m++) {
    byMonth[m] = { income: 0, expense: 0, savings: 0 };
  }

  transactions.forEach(txn => {
    const d = new Date(txn.date + 'T00:00:00');
    if (d.getFullYear() !== year) return;
    const m = d.getMonth();
    if (m < firstMonth || m > lastMonth) return;
    txnCount++;
    if (txn.type === 'income') {
      totalIncome += txn.amount;
      byMonth[m].income += txn.amount;
    } else {
      totalExpense += txn.amount;
      byMonth[m].expense += txn.amount;
      totalsByCat[txn.category] = (totalsByCat[txn.category] || 0) + txn.amount;
    }
  });

  // Compute per-month savings
  Object.keys(byMonth).forEach(m => {
    byMonth[m].savings = byMonth[m].income - byMonth[m].expense;
  });

  const savings = totalIncome - totalExpense;
  const savingsRate = totalExpense > 0 ? - (totalIncome / totalExpense) * 100 : 0;

  // Top 3 categories
  const sortedCats = Object.keys(totalsByCat)
    .sort((a, b) => totalsByCat[b] - totalsByCat[a])
    .slice(0, 3);
  const topCategories = sortedCats.map(c => ({
    category: c,
    amount: totalsByCat[c],
    percent: totalExpense > 0 ? (totalsByCat[c] / totalExpense) * 100 : 0,
  }));

  let topCat = sortedCats[0] || null;
  let topCatAmt = topCat ? totalsByCat[topCat] : 0;

  // Monthly extremes
  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';
  const monthEntries = Object.entries(byMonth);

  const hasMonthlySavingsData = monthEntries.some(([, d]) => d.income > 0 || d.expense > 0);
  let bestSavingsMonthLabel = '--';
  let peakSpendMonthLabel = '--';

  if (hasMonthlySavingsData) {
    const bestM = monthEntries.reduce((best, cur) =>
      cur[1].savings > best[1].savings ? cur : best, monthEntries[0]);
    const peakSpendM = monthEntries.reduce((best, cur) =>
      cur[1].expense > best[1].expense ? cur : best, monthEntries[0]);
    const toMonthName = m => new Date(year, parseInt(m), 1).toLocaleString(locale, { month: 'short' }).toUpperCase();
    bestSavingsMonthLabel = toMonthName(bestM[0]);
    peakSpendMonthLabel = toMonthName(peakSpendM[0]);
  }

  // Count months that actually had transactions
  const activeMonths = monthEntries.filter(([, d]) => d.income > 0 || d.expense > 0).length || 1;

  return { totalIncome, totalExpense, savings, savingsRate, topCat, topCatAmt, txnCount,
           topCategories, bestSavingsMonthLabel, peakSpendMonthLabel, activeMonths };
}

/**
 * Returns aggregated stats for an entire calendar year.
 */
function calcYearStats(year) {
  let totalIncome = 0;
  let totalExpense = 0;
  const totalsByCat = {};
  let txnCount = 0;

  // Per-month breakdown for extremes
  const byMonth = {};
  for (let m = 0; m < 12; m++) {
    byMonth[m] = { income: 0, expense: 0, savings: 0 };
  }

  transactions.forEach(txn => {
    const d = new Date(txn.date + 'T00:00:00');
    if (d.getFullYear() !== year) return;
    const m = d.getMonth();
    txnCount++;
    if (txn.type === 'income') {
      totalIncome += txn.amount;
      byMonth[m].income += txn.amount;
    } else {
      totalExpense += txn.amount;
      byMonth[m].expense += txn.amount;
      totalsByCat[txn.category] = (totalsByCat[txn.category] || 0) + txn.amount;
    }
  });

  // Compute per-month savings
  Object.keys(byMonth).forEach(m => {
    byMonth[m].savings = byMonth[m].income - byMonth[m].expense;
  });

  const savings = totalIncome - totalExpense;
  const savingsRate = totalExpense > 0 ? - (totalIncome / totalExpense) * 100 : 0;

  // Top 3 categories
  const sortedCats = Object.keys(totalsByCat)
    .sort((a, b) => totalsByCat[b] - totalsByCat[a])
    .slice(0, 3);
  const topCategories = sortedCats.map(c => ({
    category: c,
    amount: totalsByCat[c],
    percent: totalExpense > 0 ? (totalsByCat[c] / totalExpense) * 100 : 0,
  }));

  let topCat = sortedCats[0] || null;
  let topCatAmt = topCat ? totalsByCat[topCat] : 0;

  // Monthly extremes
  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';
  const monthEntries = Object.entries(byMonth);

  const hasMonthlySavingsData = monthEntries.some(([, d]) => d.income > 0 || d.expense > 0);
  let bestSavingsMonthLabel = '--';
  let peakSpendMonthLabel = '--';
  let peakIncomeMonthLabel = '--';

  if (hasMonthlySavingsData) {
    const toMonthName = m => new Date(year, parseInt(m), 1).toLocaleString(locale, { month: 'short' }).toUpperCase();
    const activeEntries = monthEntries.filter(([, d]) => d.income > 0 || d.expense > 0);
    const bestM = activeEntries.reduce((best, cur) =>
      cur[1].savings > best[1].savings ? cur : best, activeEntries[0]);
    const peakSpendM = activeEntries.reduce((best, cur) =>
      cur[1].expense > best[1].expense ? cur : best, activeEntries[0]);
    const peakIncomeM = activeEntries.reduce((best, cur) =>
      cur[1].income > best[1].income ? cur : best, activeEntries[0]);
    bestSavingsMonthLabel = toMonthName(bestM[0]);
    peakSpendMonthLabel = toMonthName(peakSpendM[0]);
    peakIncomeMonthLabel = toMonthName(peakIncomeM[0]);
  }

  // Count months with actual data
  const activeMonths = monthEntries.filter(([, d]) => d.income > 0 || d.expense > 0).length || 1;

  return { totalIncome, totalExpense, savings, savingsRate, topCat, topCatAmt, txnCount,
           topCategories, bestSavingsMonthLabel, peakSpendMonthLabel, peakIncomeMonthLabel, activeMonths };
}

/* ============================================================
   WRAPUP MODAL — UNIFIED OPEN / SWITCH / RENDER
   ============================================================ */

/**
 * Opens the wrapup modal in manual mode (from history button)
 * or with a specific tab pre-selected and period pre-set for auto-popup.
 * @param {string} [tab='month']  - 'month' | 'quarter' | 'year'
 * @param {number} [year]         - Override year for auto-popup
 * @param {number} [quarter]      - Override quarter (1-4) for auto-popup (only for tab='quarter')
 */
function openWrapupModal(tab, year, quarter) {
  const modal = document.getElementById('monthlyReportModal');
  if (!modal) return;

  // Determine mode
  _wrapupIsManual = (tab === undefined || tab === null);
  currentReportTab = tab || 'month';

  // Show/hide the X close button (manual mode only)
  const closeBtn = document.getElementById('reportCloseBtn');
  if (closeBtn) closeBtn.style.display = _wrapupIsManual ? '' : 'none';

  // Show/hide the Reset Box (auto month-change only)
  const resetBox = document.getElementById('reportResetBox');
  if (resetBox) resetBox.style.display = (currentReportTab === 'month' && !_wrapupIsManual) ? '' : 'none';

  // Sync action button label
  const actionBtn = document.getElementById('reportActionBtn');
  if (actionBtn) {
    actionBtn.textContent = _wrapupIsManual ? t('wrapupBtnClose') : t('wrapupBtnStartFresh');
  }

  // Sync tab UI
  ['month', 'quarter', 'year'].forEach(k => {
    const btn = document.getElementById(`rtab-${k}`);
    if (!btn) return;
    const isActive = k === currentReportTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  // Populate period dropdown, then render
  _populatePeriodDropdown(currentReportTab, year, quarter);
  _renderWrapupFromDropdown();
  _syncSelectorVisibility(currentReportTab);

  modal.style.display = 'flex';
  modal.classList.add('open');
  syncResetModeUI();
}

/**
 * Switches the active tab (Tháng / Quý / Năm) inside the wrapup modal.
 */
function switchReportTab(tab, btnEl) {
  currentReportTab = tab;

  // Sync tab buttons
  ['month', 'quarter', 'year'].forEach(k => {
    const btn = document.getElementById(`rtab-${k}`);
    if (!btn) return;
    const isActive = k === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  // Show/hide reset box
  const resetBox = document.getElementById('reportResetBox');
  if (resetBox) resetBox.style.display = (tab === 'month' && !_wrapupIsManual) ? '' : 'none';

  // Repopulate and rerender
  _populatePeriodDropdown(tab);
  _renderWrapupFromDropdown();
  _syncSelectorVisibility(tab);
}

/**
 * Shows/hides the correct selector UI depending on the active tab.
 * Tab 'month'   → Month Slider
 * Tab 'quarter' → Quarter Grid
 * Tab 'year'    → Year Dropdown
 */
function _syncSelectorVisibility(tab) {
  const yearWrapper  = document.getElementById('reportPeriodSelectorWrapper');
  const monthWrapper = document.getElementById('reportMonthSliderWrapper');
  const quarterWrapper = document.getElementById('reportQuarterSelector');

  if (yearWrapper)    yearWrapper.style.display    = (tab === 'year')    ? '' : 'none';
  if (monthWrapper)   monthWrapper.style.display   = (tab === 'month')   ? '' : 'none';
  if (quarterWrapper) quarterWrapper.style.display = (tab === 'quarter') ? '' : 'none';
}

/**
 * Called when user changes the period dropdown value.
 */
function handleReportPeriodChange() {
  _renderWrapupFromDropdown();
}

/**
 * Populates the period dropdown with available periods having transactions.
 * @param {string} tab - 'month' | 'quarter' | 'year'
 * @param {number} [preYear] - pre-select this year
 * @param {number} [preQ]    - pre-select this quarter
 */
function _populatePeriodDropdown(tab, preYear, preQ) {
  const sel = document.getElementById('reportPeriodSelect');
  if (!sel) return;

  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';

  sel.innerHTML = '';

  if (tab === 'month') {
    // ── Build month slider chips ────────────────────────────────
    const seen = new Set();
    transactions.forEach(txn => {
      const d = new Date(txn.date + 'T00:00:00');
      seen.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    const sorted = Array.from(seen).sort((a, b) => b.localeCompare(a));

    // Populate the hidden native <select> as well (for _renderWrapupFromDropdown)
    sorted.forEach(key => {
      const [y, m] = key.split('-');
      const d = new Date(parseInt(y), parseInt(m), 1);
      const label = d.toLocaleString(locale, { month: 'long', year: 'numeric' }).toUpperCase();
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      sel.appendChild(opt);
    });

    // Build slider chips
    const track = document.getElementById('monthSliderTrack');
    const triggerText = document.getElementById('activeMonthText');
    if (track) {
      track.innerHTML = '';
      // Active key = currently selected option (first by default)
      const activeKey = sel.value || (sorted.length > 0 ? sorted[0] : null);
      sorted.forEach((key, idx) => {
        const [y, m] = key.split('-');
        const d = new Date(parseInt(y), parseInt(m), 1);
        const shortLabel = d.toLocaleString(locale, { month: 'short' }).toUpperCase();
        const yearLabel  = d.toLocaleString(locale, { year: 'numeric' });
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'month-chip' + (key === activeKey ? ' active' : '');
        chip.setAttribute('role', 'option');
        chip.setAttribute('aria-selected', String(key === activeKey));
        chip.dataset.key = key;
        chip.style.setProperty('--i', idx);
        chip.innerHTML = `<span>${shortLabel}</span><span style="opacity:0.6;font-size:8px;">${yearLabel}</span>`;
        chip.style.flexDirection = 'column';
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '1px';
        chip.onclick = () => {
          // Update select
          sel.value = key;
          // Re-active chips
          track.querySelectorAll('.month-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.key === key);
            c.setAttribute('aria-selected', String(c.dataset.key === key));
          });
          // Update trigger label
          const nd = new Date(parseInt(y), parseInt(m), 1);
          if (triggerText) triggerText.textContent = nd.toLocaleString(locale, { month: 'long', year: 'numeric' }).toUpperCase();
          handleReportPeriodChange();
          // Collapse slider by removing hover (blur trick)
          document.activeElement?.blur();
        };
        track.appendChild(chip);
      });

      // Update trigger label to show active month
      if (triggerText && activeKey) {
        const [ay, am] = activeKey.split('-');
        const ad = new Date(parseInt(ay), parseInt(am), 1);
        triggerText.textContent = ad.toLocaleString(locale, { month: 'long', year: 'numeric' }).toUpperCase();
      } else if (triggerText) {
        triggerText.textContent = t('noDataForPeriod');
      }
    }

  } else if (tab === 'quarter') {
    // ── Build quarter grid ──────────────────────────────────────
    // Collect which quarters have data
    const quartersWithData = new Set();
    transactions.forEach(txn => {
      const d = new Date(txn.date + 'T00:00:00');
      const q = Math.floor(d.getMonth() / 3) + 1;
      quartersWithData.add(`${d.getFullYear()}-${q}`);
    });

    // Also populate native select
    const seen = new Set();
    transactions.forEach(txn => {
      const d = new Date(txn.date + 'T00:00:00');
      const q = Math.floor(d.getMonth() / 3) + 1;
      seen.add(`${d.getFullYear()}-${q}`);
    });
    const sorted = Array.from(seen).sort((a, b) => b.localeCompare(a));
    sorted.forEach(key => {
      const [y, q] = key.split('-');
      const qLabel = t(`q${q}Label`) || `Q${q}`;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${qLabel} / ${y}`;
      if (preYear !== undefined && preQ !== undefined && parseInt(y) === preYear && parseInt(q) === preQ) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });

    // Determine display year for the grid
    const allYears = Array.from(new Set(transactions.map(txn => new Date(txn.date + 'T00:00:00').getFullYear()))).sort((a, b) => b - a);
    let displayYear = preYear || (allYears.length > 0 ? allYears[0] : new Date().getFullYear());

    // Initialise _qGridYear if not set
    if (!window._qGridYear) window._qGridYear = displayYear;
    else displayYear = window._qGridYear;

    _updateQuarterGrid(displayYear, quartersWithData, preQ);

    // Wire year stepper buttons (only once)
    const btnPrev = document.getElementById('qYearPrev');
    const btnNext = document.getElementById('qYearNext');
    if (btnPrev) {
      btnPrev.onclick = () => {
        window._qGridYear = (window._qGridYear || new Date().getFullYear()) - 1;
        _updateQuarterGrid(window._qGridYear, quartersWithData);
      };
    }
    if (btnNext) {
      btnNext.onclick = () => {
        window._qGridYear = (window._qGridYear || new Date().getFullYear()) + 1;
        _updateQuarterGrid(window._qGridYear, quartersWithData);
      };
    }

  } else if (tab === 'year') {
    // Collect unique years
    const seen = new Set();
    transactions.forEach(txn => {
      const d = new Date(txn.date + 'T00:00:00');
      seen.add(d.getFullYear());
    });
    const sorted = Array.from(seen).sort((a, b) => b - a);
    sorted.forEach(y => {
      const opt = document.createElement('option');
      opt.value = `${y}`;
      opt.textContent = `${y}`;
      if (preYear !== undefined && y === preYear) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // If nothing in dropdown, add a disabled placeholder
  if (sel.options.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('noDataForPeriod');
    opt.disabled = true;
    opt.selected = true;
    sel.appendChild(opt);
  }

  _syncCustomDropdown();
}

/**
 * Updates the quarter grid UI for a specific display year.
 * @param {number} year
 * @param {Set<string>} quartersWithData  - Set of "year-q" strings
 * @param {number|undefined} [activeQ]    - Pre-select this quarter if provided
 */
function _updateQuarterGrid(year, quartersWithData, activeQ) {
  const yearDisplay = document.getElementById('qYearDisplay');
  if (yearDisplay) yearDisplay.textContent = year;

  // Determine active quarter from native select if not provided
  const sel = document.getElementById('reportPeriodSelect');
  if (!activeQ && sel && sel.value) {
    const parts = sel.value.split('-');
    if (parts.length === 2 && parseInt(parts[0]) === year) activeQ = parseInt(parts[1]);
  }

  const tooltipMsg = t('quarterTooltipNoData');

  for (let q = 1; q <= 4; q++) {
    const btn = document.getElementById(`qBtn${q}`);
    if (!btn) continue;

    const hasData = quartersWithData.has(`${year}-${q}`);
    const isActive = (q === activeQ) && hasData;

    btn.classList.toggle('no-data', !hasData);
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-disabled', String(!hasData));
    btn.setAttribute('aria-pressed', String(isActive));

    // Update tooltip text (supports i18n change)
    const tooltip = btn.querySelector('.q-btn-tooltip');
    if (tooltip) tooltip.textContent = tooltipMsg;

    // Wire click (replace each time to keep year fresh)
    btn.onclick = hasData ? () => {
      // Update native select
      if (sel) sel.value = `${year}-${q}`;
      // Update visual active state
      for (let j = 1; j <= 4; j++) {
        const b = document.getElementById(`qBtn${j}`);
        if (b) {
          b.classList.toggle('active', j === q && quartersWithData.has(`${year}-${j}`));
        }
      }
      handleReportPeriodChange();
    } : (e) => {
      // No-data: don't navigate, just show tooltip (CSS handles it)
      e.preventDefault();
    };
  }
}

/**
 * Synchronizes the custom styled dropdown with the hidden native select.
 */
function _syncCustomDropdown() {
  const nativeSel = document.getElementById('reportPeriodSelect');
  const customDropdown = document.getElementById('reportPeriodDropdown');
  if (!nativeSel || !customDropdown) return;

  const triggerVal = customDropdown.querySelector('.custom-dropdown-value');
  const menu = customDropdown.querySelector('.custom-dropdown-menu');
  if (!triggerVal || !menu) return;

  const selectedOpt = nativeSel.options[nativeSel.selectedIndex];
  triggerVal.textContent = selectedOpt ? selectedOpt.textContent : '--';

  menu.innerHTML = '';
  Array.from(nativeSel.options).forEach(opt => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'custom-dropdown-item';
    if (opt.selected) item.classList.add('active');
    if (opt.disabled) item.disabled = true;
    item.textContent = opt.textContent;
    item.onclick = (e) => {
      e.stopPropagation();
      nativeSel.value = opt.value;
      handleReportPeriodChange();
      _syncCustomDropdown();
      customDropdown.classList.remove('open');
    };
    menu.appendChild(item);
  });
}

// Global click event to open/close custom dropdown
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('reportPeriodDropdown');
  if (!dropdown) return;
  const trigger = dropdown.querySelector('.custom-dropdown-trigger');
  
  if (trigger && trigger.contains(e.target)) {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  } else {
    dropdown.classList.remove('open');
  }
});

/**
 * Renders the wrapup report based on current tab + selected dropdown value.
 */
function _renderWrapupFromDropdown() {
  const sel = document.getElementById('reportPeriodSelect');
  const titleEl = document.getElementById('report-title');
  const subtitleEl = document.getElementById('reportMonthLabel');
  const grid = document.getElementById('reportComparisonGrid');
  const msgEl = document.getElementById('reportMessage');

  if (!sel || !grid) return;

  const localeMap = { en: 'en-US', vi: 'vi-VN', zh: 'zh-CN' };
  const locale = localeMap[currentLang] || 'en-US';

  const val = sel.value;
  if (!val) {
    if (titleEl) titleEl.textContent = t('quarterlyWrapUp');
    if (subtitleEl) subtitleEl.textContent = '';
    grid.innerHTML = `<div class="report-stat" style="text-align:center;padding:24px;color:var(--muted);">${t('noDataForPeriod')}</div>`;
    if (msgEl) msgEl.textContent = '';
    return;
  }

  let stats, prevStats, periodLabel, titleKey;

  if (currentReportTab === 'month') {
    const [y, m] = val.split('-').map(Number);
    stats = calcMonthStats(m, y);
    // Previous month
    const prevDate = new Date(y, m - 1, 1);
    prevStats = calcMonthStats(prevDate.getMonth(), prevDate.getFullYear());
    const d = new Date(y, m, 1);
    periodLabel = d.toLocaleString(locale, { month: 'long', year: 'numeric' }).toUpperCase();
    titleKey = 'monthlyWrapUp';

  } else if (currentReportTab === 'quarter') {
    const [y, q] = val.split('-').map(Number);
    stats = calcQuarterStats(q, y);
    // Previous quarter
    let prevQ = q - 1, prevY = y;
    if (prevQ < 1) { prevQ = 4; prevY = y - 1; }
    prevStats = calcQuarterStats(prevQ, prevY);
    periodLabel = `${t(`q${q}Label`)} / ${y}`;
    titleKey = 'quarterlyWrapUp';

  } else {
    const y = parseInt(val);
    stats = calcYearStats(y);
    prevStats = calcYearStats(y - 1);
    periodLabel = `${y}`;
    titleKey = 'annualWrapUp';
  }

  if (titleEl) titleEl.textContent = t(titleKey);
  if (subtitleEl) subtitleEl.textContent = periodLabel;

  // Build comparison grid (same HTML as monthly report)
  const hasPrev = prevStats.txnCount > 0;
  const curLabel = periodLabel;
  const prevLabel = (() => {
    if (currentReportTab === 'month') {
      const [y, m] = val.split('-').map(Number);
      const pd = new Date(y, m - 1, 1);
      return pd.toLocaleString(locale, { month: 'short', year: 'numeric' }).toUpperCase();
    } else if (currentReportTab === 'quarter') {
      const [y, q] = val.split('-').map(Number);
      let prevQ = q - 1, prevY = y;
      if (prevQ < 1) { prevQ = 4; prevY = y - 1; }
      return `${t(`q${prevQ}Label`)} / ${prevY}`;
    } else {
      return `${parseInt(val) - 1}`;
    }
  })();

  if (hasPrev) {
    grid.className = 'report-comparison-grid';
    grid.innerHTML =
      buildReportColumnHTML(prevLabel, false, prevStats, stats) +
      buildReportColumnHTML(curLabel, true, stats, prevStats);
  } else {
    grid.className = 'report-comparison-grid single-column';
    grid.innerHTML = buildReportColumnHTML(curLabel, true, stats, null);
  }

  // Dynamic message
  if (msgEl) {
    let msg = '';
    if (stats.txnCount === 0) {
      msg = t('noDataForPeriod');
    } else if (stats.savings >= 0) {
      if (stats.savingsRate >= 30) {
        msg = currentLang === 'vi'
          ? `🎉 Xuất sắc! Bạn đã tích luỹ <strong>${stats.savingsRate.toFixed(0)}%</strong> thu nhập trong kỳ này. Hãy tiếp tục phong độ đó!`
          : currentLang === 'zh'
          ? `🎉 出色！本周期储蓄率达 <strong>${stats.savingsRate.toFixed(0)}%</strong>。继续保持！`
          : `🎉 Excellent! You saved <strong>${stats.savingsRate.toFixed(0)}%</strong> of your income this period. Keep it up!`;
      } else {
        msg = currentLang === 'vi'
          ? `✅ Kỳ này kết thúc với tích luỹ ròng <strong>${fmt(stats.savings)}</strong>. Tốt lắm!`
          : currentLang === 'zh'
          ? `✅ 本周期净储蓄 <strong>${fmt(stats.savings)}</strong>。干得漂亮！`
          : `✅ You finished this period with a net saving of <strong>${fmt(stats.savings)}</strong>. Well done!`;
      }
    } else {
      msg = currentLang === 'vi'
        ? `⚠️ Chi tiêu vượt thu nhập <strong>${fmt(Math.abs(stats.savings))}</strong> trong kỳ này. Hãy cân nhắc điều chỉnh ngân sách!`
        : currentLang === 'zh'
        ? `⚠️ 本周期支出超出收入 <strong>${fmt(Math.abs(stats.savings))}</strong>。注意调整预算！`
        : `⚠️ Spending exceeded income by <strong>${fmt(Math.abs(stats.savings))}</strong> this period. Consider adjusting your budget.`;
    }
    msgEl.innerHTML = msg;
  }
}

/**
 * Closes the wrapup modal when clicking on the overlay background.
 */
function closeWrapupOnOverlay(e) {
  if (e.target === document.getElementById('monthlyReportModal')) {
    closeMonthlyReport();
  }
}

window.openWrapupModal = openWrapupModal;
window.switchReportTab = switchReportTab;
window.handleReportPeriodChange = handleReportPeriodChange;
window.closeWrapupOnOverlay = closeWrapupOnOverlay;
window.checkNewPeriodTransitions = checkNewPeriodTransitions;


/* ============================================================
   HŨ CHI TIÊU — JARS & INSTALLMENTS
   Tiền trong hũ HOÀN TOÀN tách biệt với balance/transactions.
   ============================================================ */

/* ── Jars State & Storage Keys ── */
const JARS_KEY         = 'caltdhy_jars';
const INSTALLMENTS_KEY = 'caltdhy_installments';

let jars         = [];  // [{ id, name, icon, target, current, targetDate, color }]
let installments = [];  // [{ id, name, icon, amount, cycle, nextDueDate, active, totalPaid }]

/* ── Emoji Picker Data ── */
const JAR_EMOJIS = [
  '🫙', '🏠', '🚗', '✈️', '🎓', '🏥', '🛍️', '🎯', '💰', '💼', '🎁', '🚨'
];

const INSTALLMENT_EMOJIS = [
  '💳','📱','🎬','🏋️','🌐','🎵','📦','⚡','🌊','🏥',
  '📺','🎮','🚗','🏠','🍜','☕','🛡️','📰','🎓','🔑'
];

/* ── Palette for Jar cards ── */
const JAR_PALETTE = [
  '#3498db','#2ecc71','#e74c3c','#9b59b6','#f39c12',
  '#1abc9c','#e67e22','#e91e63','#00bcd4','#8bc34a'
];

/* ── Load / Save helpers ── */
function loadJars() {
  try {
    const raw = localStorage.getItem(JARS_KEY);
    jars = raw ? JSON.parse(raw) : [];
  } catch (e) { jars = []; }
}

function saveJars() {
  try {
    localStorage.setItem(JARS_KEY, JSON.stringify(jars));
  } catch (e) { showToast('⚠ Storage full.'); }
}

function loadInstallments() {
  try {
    const raw = localStorage.getItem(INSTALLMENTS_KEY);
    installments = raw ? JSON.parse(raw) : [];
  } catch (e) { installments = []; }
}

function saveInstallments() {
  try {
    localStorage.setItem(INSTALLMENTS_KEY, JSON.stringify(installments));
  } catch (e) { showToast('⚠ Storage full.'); }
}

/* ── Server Sync ── */
async function syncLoadJarsFromServer() {
  if (!isServerConnected) return;
  try {
    const headers = getAuthHeaders();
    const [jarRes, instRes] = await Promise.all([
      fetch('/api/jars', { headers }),
      fetch('/api/jars/installments', { headers })
    ]);
    if (jarRes.ok) {
      const data = await jarRes.json();
      if (data.success) { jars = data.data; saveJars(); }
    }
    if (instRes.ok) {
      const data = await instRes.json();
      if (data.success) { installments = data.data; saveInstallments(); }
    }
    renderJarsView();
  } catch (e) {
    console.warn('⚠️ Jars sync failed (offline mode).', e);
  }
}

async function syncAddJarToServer(jar) {
  if (!isServerConnected) return null;
  try {
    const res = await fetch('/api/jars', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name: jar.name, icon: jar.icon, target: jar.target, current: jar.current, targetDate: jar.targetDate, color: jar.color })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data.data.id;
    }
  } catch (e) { console.warn('⚠️ syncAddJar failed.', e); }
  return null;
}

async function syncJarTransactionToServer(jarId, type, amount, reason) {
  if (!isServerConnected) return;
  try {
    await fetch(`/api/jars/${jarId}/${type}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount, reason: reason || '' })
    });
  } catch (e) { console.warn('⚠️ syncJarTransaction failed.', e); }
}

async function syncDeleteJarFromServer(jarId) {
  if (!isServerConnected) return;
  try {
    await fetch(`/api/jars/${jarId}`, { method: 'DELETE', headers: getAuthHeaders() });
  } catch (e) { console.warn('⚠️ syncDeleteJar failed.', e); }
}

async function syncAddInstallmentToServer(inst) {
  if (!isServerConnected) return null;
  try {
    const res = await fetch('/api/jars/installments', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name: inst.name, icon: inst.icon, amount: inst.amount, cycle: inst.cycle, nextDueDate: inst.nextDueDate })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data.data.id;
    }
  } catch (e) { console.warn('⚠️ syncAddInstallment failed.', e); }
  return null;
}

async function syncPayInstallmentToServer(instId) {
  if (!isServerConnected) return;
  try {
    const res = await fetch(`/api/jars/installments/${instId}/pay`, {
      method: 'PATCH', headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data.data;
    }
  } catch (e) { console.warn('⚠️ syncPayInstallment failed.', e); }
  return null;
}

async function syncDeleteInstallmentFromServer(instId) {
  if (!isServerConnected) return;
  try {
    await fetch(`/api/jars/installments/${instId}`, { method: 'DELETE', headers: getAuthHeaders() });
  } catch (e) { console.warn('⚠️ syncDeleteInstallment failed.', e); }
}

/* Fix #9: Dùng 'đ' thường thay vì '₫' để tránh glyph gạch chân lạ trên Mac/Windows */
function fmtJar(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B đ';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M đ';
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + 'K đ';
  return n.toLocaleString('vi-VN') + ' đ';
}

function parseCurrencyInput(val) {
  // Strip K / M / B suffixes for easy input
  const str = String(val).trim().replace(/,/g, '');
  if (/k$/i.test(str)) return parseFloat(str) * 1000;
  if (/m$/i.test(str)) return parseFloat(str) * 1_000_000;
  if (/b$/i.test(str)) return parseFloat(str) * 1_000_000_000;
  return parseFloat(str);
}

/* ── Days until due date ── */
function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

/* ── Advance nextDueDate locally (for offline) ── */
function advanceNextDueDate(dateStr, cycle) {
  const d = new Date(dateStr + 'T00:00:00');
  switch (cycle) {
    case 'monthly':   d.setMonth(d.getMonth() + 1);   break;
    case 'quarterly': d.setMonth(d.getMonth() + 3);   break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ── Cycle label ── */
function cycleLabel(cycle) {
  return { monthly: 'Hàng tháng', quarterly: 'Hàng quý', yearly: 'Hàng năm' }[cycle] || cycle;
}

/* ── Generate a local ID ── */
function genJarId() {
  return 'jar_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/* ============================================================
   RENDER — VIEW JARS
   ============================================================ */
function renderJarsView() {
  renderJarSummary();
  renderJarCards();
  renderInstallmentList();
}

function renderJarSummary() {
  const leftSummaryEl = document.getElementById('jarsLeftSummary');
  const rightSummaryEl = document.getElementById('jarsRightSummary');

  const totalSaved = jars.reduce((sum, j) => sum + (j.current || 0), 0);
  const totalTarget = jars.reduce((sum, j) => sum + (j.target || 0), 0);
  const avgProgress = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

  // Find next active upcoming installment
  const activeInst = installments.filter(i => i.active);
  let nextBillStr = 'Không có hóa đơn';
  let nextBillAmount = '';
  if (activeInst.length > 0) {
    const sorted = [...activeInst].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
    const nextBill = sorted[0];
    const days = daysUntil(nextBill.nextDueDate);
    const dayLabel = days < 0 ? `Trễ ${Math.abs(days)} ngày` : days === 0 ? 'Hôm nay!' : `Còn ${days} ngày`;
    nextBillStr = `${nextBill.icon} ${nextBill.name} (${dayLabel})`;
    nextBillAmount = fmtJar(nextBill.amount);
  }

  // Fix #4: Logic adaptive dựa theo số lượng hũ
  if (leftSummaryEl) {
    if (jars.length === 0) {
      // Ẩn hẳn summary khi chưa có hũ nào
      leftSummaryEl.innerHTML = '';
      leftSummaryEl.style.display = 'none';
    } else if (jars.length === 1) {
      // Khi chỉ có 1 hũ: hiện "Tổng tích lũy" + Insight "Còn cần" thay vì lặp lại %
      const singleJar = jars[0];
      const stillNeed = Math.max(0, (singleJar.target || 0) - (singleJar.current || 0));
      const capJarName = singleJar.name.charAt(0).toUpperCase() + singleJar.name.slice(1);
      leftSummaryEl.style.display = '';
      leftSummaryEl.innerHTML = `
        <div class="summary-card">
          <div class="summary-card__label">Tổng Tích Lũy</div>
          <div class="summary-card__value value--emerald">${fmtJar(totalSaved)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__label">Để đạt mục tiêu "${capJarName}"</div>
          <div class="summary-card__value value--blue">${stillNeed > 0 ? `Còn thiếu ${fmtJar(stillNeed)}` : '🎉 Đã đạt mục tiêu!'}</div>
        </div>
      `;
    } else {
      // 2+ hũ: hiện tổng hợp chuẩn
      leftSummaryEl.style.display = '';
      leftSummaryEl.innerHTML = `
        <div class="summary-card">
          <div class="summary-card__label">Tổng Tích Lũy</div>
          <div class="summary-card__value value--emerald">${fmtJar(totalSaved)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card__label">Tiến Độ Trung Bình</div>
          <div class="summary-card__value value--blue">${avgProgress.toFixed(0)}%</div>
        </div>
      `;
    }
  }

  // Render right metrics (Hóa đơn sắp tới)
  if (rightSummaryEl) {
    rightSummaryEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-card__label">Hóa Đơn Sắp Tới</div>
        <div class="summary-card__value value--rose">
          <span class="value-title" title="${nextBillStr}" onmouseenter="initScrollText(this)">${nextBillStr}</span>
          ${nextBillAmount ? `<span class="value-sub">${nextBillAmount}</span>` : ''}
        </div>
      </div>
    `;
  }
}

function initScrollText(el) {
  const dist = el.scrollWidth - el.clientWidth;
  if (dist > 0) {
    el.style.setProperty('--scroll-dist', `-${dist + 10}px`);
    el.classList.add('can-scroll');
  } else {
    el.classList.remove('can-scroll');
  }
}
window.initScrollText = initScrollText;

function triggerJarSlosh(jarId, element) {
  const container = element.querySelector('.jar-glass-container');
  if (!container) return;
  container.classList.remove('slosh');
  void container.offsetWidth; // trigger reflow
  container.classList.add('slosh');
  setTimeout(() => {
    container.classList.remove('slosh');
  }, 800);
}

function renderJarCards() {
  const grid = document.getElementById('jarsGrid');
  if (!grid) return;

  if (jars.length === 0) {
    grid.innerHTML = `
      <div class="jars-empty-state">
        <span class="jars-empty-icon">🫙</span>
        <p class="jars-empty-text">Chưa có hũ nào. Tạo hũ đầu tiên!</p>
      </div>`;
    return;
  }

  const cardsHTML = jars.map(jar => {
    const pct = jar.target > 0 ? Math.min(100, (jar.current / jar.target) * 100) : 0;
    const pctDisplay = pct.toFixed(0);
    const daysLeft = jar.targetDate ? daysUntil(jar.targetDate) : null;
    const daysStr = daysLeft !== null
      ? (daysLeft > 0 ? `còn ${daysLeft} ngày` : daysLeft === 0 ? 'Hôm nay!' : `quá hạn ${Math.abs(daysLeft)} ngày`)
      : '';
    const isOverdue = daysLeft !== null && daysLeft < 0;
    const isComplete = pct >= 100;
    const capName = jar.name.charAt(0).toUpperCase() + jar.name.slice(1);
    // Fix #5: Hiển thị % và ngày dưới dạng text nhỏ gọn cạnh số tiền, bỏ thanh progress bar ngang
    const progressText = `<span class="jar-card__pct">${pctDisplay}%</span>${daysStr ? ` · <span class="jar-card__days ${isOverdue ? 'overdue' : ''}">${daysStr}</span>` : ''}`;

    return `
      <div class="jar-card ${isComplete ? 'jar-card--complete' : ''}" style="--jar-color:${jar.color};" data-jar-id="${jar.id}">
        <div class="jar-card__glow" aria-hidden="true"></div>

        <!-- Fix #7: Inline delete confirm overlay thay vì window.confirm -->
        <div class="jar-card__confirm-overlay" role="alertdialog" aria-modal="true" aria-label="Xác nhận xóa hũ">
          <div class="jar-card__confirm-text">
            <strong>Xóa hũ "${capName}"?</strong>
            ${jar.current > 0 ? `${fmtJar(jar.current)} đã tích lũy sẽ không được cộng lại vào số dư.` : 'Hành động này không thể hoàn tác.'}
          </div>
          <div class="jar-card__confirm-actions">
            <button class="jar-card__confirm-cancel" onclick="cancelDeleteJar('${jar.id}')" aria-label="Hủy xóa">Hủy</button>
            <button class="jar-card__confirm-delete-btn" onclick="executeDeleteJar('${jar.id}')" aria-label="Xác nhận xóa hũ ${jar.name}">🗑 Xóa hũ</button>
          </div>
        </div>

        <!-- Nút xóa - trigger overlay thay vì window.confirm -->
        <button class="jar-card__delete" onclick="confirmDeleteJar('${jar.id}')" aria-label="Xóa hũ ${jar.name}" title="Xóa hũ">✕</button>
        
        <div class="jar-card__content">
          <div class="jar-card__info-section">
            <div class="jar-card__header-row">
              <span class="jar-card__icon">${jar.icon}</span>
              <h3 class="jar-card__name">${capName}</h3>
            </div>
            
            <div class="jar-card__amounts">
              <span class="jar-card__current">${fmtJar(jar.current)}</span>
              <span class="jar-card__sep">/</span>
              <span class="jar-card__target">${fmtJar(jar.target)}</span>
            </div>

            <!-- Fix #5: Chỉ giữ text % nhỏ gọn, bỏ thanh progress bar ngang -->
            <div class="jar-card__meta-info">${progressText}</div>

            ${isComplete
              ? `<div class="jar-card__complete-badge">🎉 Đạt mục tiêu!</div>`
              : `<div class="jar-card__actions">
                  <button class="jar-btn jar-btn--deposit" onclick="openJarTxnModal('${jar.id}','deposit')" aria-haspopup="dialog">+ Nạp</button>
                  <button class="jar-btn jar-btn--withdraw" onclick="openJarTxnModal('${jar.id}','withdraw')" aria-haspopup="dialog" ${jar.current <= 0 ? 'disabled' : ''}>− Rút</button>
                </div>`
            }
          </div>

          <!-- Fix #3: Glass Jar Visual Column với nắp gỗ bần và nơ cói -->
          <div class="jar-card__visual-section" onclick="triggerJarSlosh('${jar.id}', this)">
            <div class="jar-glass-container">
              <div class="jar-lid" aria-hidden="true"></div>
              <div class="jar-thread" aria-hidden="true"></div>
              <div class="jar-neck"></div>
              <div class="jar-body">
                <div class="jar-water-fill" style="height: ${pct}%;">
                  <svg class="jar-water-waves" viewBox="0 0 120 28" preserveAspectRatio="none">
                    <path class="jar-wave-path wave-back" d="M0 15 Q 30 10, 60 15 T 120 15 L 120 28 L 0 28 Z"></path>
                    <path class="jar-wave-path wave-front" d="M0 15 Q 30 20, 60 15 T 120 15 L 120 28 L 0 28 Z"></path>
                  </svg>
                  <div class="jar-water-body"></div>
                  <div class="water-bubble bubble-1"></div>
                  <div class="water-bubble bubble-2"></div>
                  <div class="water-bubble bubble-3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  // Fix #10: Thêm dashed placeholder card để lấp khoảng trống, mời tạo hũ mới
  const dashedCard = `
    <button class="jar-card--dashed" onclick="openAddJarModal()" aria-label="Tạo hũ tiết kiệm mới">
      <span class="jar-dashed__icon">+</span>
      <span class="jar-dashed__text">Tạo Hũ Tiết Kiệm Mới</span>
    </button>`;

  grid.innerHTML = cardsHTML + dashedCard;
}

function formatTimelineDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const [_, m, d] = parts;
  if (typeof currentLang !== 'undefined' && currentLang === 'en') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1] || m} ${parseInt(d, 10)}`;
  } else {
    return `${parseInt(d, 10)} thg ${parseInt(m, 10)}`;
  }
}

function renderInstallmentList() {
  const list = document.getElementById('installmentList');
  if (!list) return;

  const active = installments.filter(i => i.active);
  const inactive = installments.filter(i => !i.active);
  const sorted = [...active].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));

  if (installments.length === 0) {
    list.innerHTML = `
      <div class="inst-empty">
        <span>💳</span>
        <p>Chưa có khoản định kỳ nào. Thêm ngay!</p>
      </div>`;
    return;
  }

  const renderItem = (inst) => {
    const days = daysUntil(inst.nextDueDate);
    const isOverdue = days < 0;
    const isSoon = days >= 0 && days <= 7;

    // Xác định xem khoản định kỳ đã được thanh toán cho tháng hiện tại chưa
    const today = new Date();
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const dueDate = new Date(inst.nextDueDate + 'T00:00:00');
    const isPaidThisMonth = dueDate >= nextMonthStart;

    let statusClass = '';
    let countdownStr = '';
    if (!inst.active) {
      statusClass = 'inst-item--inactive';
      countdownStr = `<span class="inst-badge inst-badge--paused">⏸ Tạm dừng</span>`;
    } else if (isOverdue) {
      statusClass = 'inst-item--overdue';
      countdownStr = `<span class="inst-badge inst-badge--overdue">⚠️ Trễ ${Math.abs(days)} ngày</span>`;
    } else if (isSoon) {
      statusClass = 'inst-item--soon';
      countdownStr = days === 0
        ? `<span class="inst-badge inst-badge--today">🔔 Hôm nay!</span>`
        : `<span class="inst-badge inst-badge--soon">⏰ Còn ${days} ngày</span>`;
    } else {
      countdownStr = `<span class="inst-badge inst-badge--ok">✓ Còn ${days} ngày</span>`;
    }

    const dateBubble = formatTimelineDate(inst.nextDueDate);
    const capName = inst.name.charAt(0).toUpperCase() + inst.name.slice(1);

    return `
      <div class="inst-timeline-node">
        <div class="inst-date-bubble">${dateBubble}</div>
        <div class="inst-item ${statusClass}" data-inst-id="${inst.id}">
          <!-- Lớp phủ xác nhận xóa khoản định kỳ -->
          <div class="inst-item__confirm-overlay" role="alertdialog" aria-modal="true" aria-label="Xác nhận xóa khoản định kỳ">
            <span class="inst-item__confirm-text">Xóa "${capName}"?</span>
            <div class="inst-item__confirm-actions">
              <button class="inst-confirm-cancel" onclick="cancelDeleteInstallment('${inst.id}')">Hủy</button>
              <button class="inst-confirm-delete" onclick="executeDeleteInstallment('${inst.id}')">Xóa</button>
            </div>
          </div>

          <div class="inst-item__dot ${isOverdue ? 'dot--overdue' : isSoon ? 'dot--soon' : 'dot--ok'}"></div>
          <span class="inst-item__icon">${inst.icon}</span>
          <div class="inst-item__info">
            <span class="inst-item__name">${capName}</span>
            <span class="inst-item__meta">${fmtJar(inst.amount)} · ${cycleLabel(inst.cycle)}</span>
          </div>
          <div class="inst-item__right">
            ${countdownStr}
            ${inst.active ? (isPaidThisMonth ? `
              <button class="inst-pay-btn inst-pay-btn--paid" disabled title="Đã thanh toán tháng này">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <span>Đã trả</span>
              </button>` : `
              <button class="inst-pay-btn" onclick="payInstallment('${inst.id}')" title="Đánh dấu đã trả">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Trả</span>
              </button>`) : ''
            }
            <button class="inst-toggle-btn" onclick="toggleInstallmentActive('${inst.id}')" title="${inst.active ? 'Tạm dừng theo dõi' : 'Kích hoạt lại'}">
              ${inst.active 
                ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
                : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
              }
            </button>
            <button class="inst-delete-btn" onclick="confirmDeleteInstallment('${inst.id}')" title="Xóa">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  };

  list.innerHTML = sorted.map(renderItem).join('')
    + (inactive.length > 0
      ? `<div class="inst-section-label">Đã tạm dừng</div>` + inactive.map(renderItem).join('')
      : '');

  // Cập nhật màu nền panel theo trạng thái tháng
  checkInstallmentsStatus();
}

/* ============================================================
   SWITCH VIEW — extend for 'jars'
   ============================================================ */
const _originalSwitchView = window.switchView;
window.switchView = function switchViewExtended(view) {
  // Update nav buttons (add jars button handling)
  const btnJars = document.getElementById('nav-jars');
  if (btnJars) btnJars.classList.toggle('active', view === 'jars');

  const viewJars = document.getElementById('view-jars');
  if (viewJars) viewJars.classList.toggle('active', view === 'jars');

  if (view === 'jars') {
    currentView = 'jars';
    // Hide/show home-only elements
    const btnHome = document.getElementById('nav-home');
    const btnAnalytics = document.getElementById('nav-analytics');
    const viewHome = document.getElementById('view-home');
    const viewAnalytics = document.getElementById('view-analytics');
    if (btnHome) btnHome.classList.remove('active');
    if (btnAnalytics) btnAnalytics.classList.remove('active');
    if (viewHome) viewHome.classList.remove('active');
    if (viewAnalytics) viewAnalytics.classList.remove('active');
    const budgetSortWrapper = document.getElementById('budgetSortWrapper');
    if (budgetSortWrapper) budgetSortWrapper.style.display = 'none';
    renderJarsView();
    return;
  }

  // Restore budget sort wrapper when leaving jars
  const budgetSortWrapper = document.getElementById('budgetSortWrapper');
  if (budgetSortWrapper && view === 'home') budgetSortWrapper.style.display = '';

  _originalSwitchView(view);
};

function toggleRail() {
  const body = document.querySelector('.app-body');
  if (!body) return;
  const isCollapsed = body.classList.toggle('rail-collapsed');
  localStorage.setItem('railCollapsed', isCollapsed ? 'true' : 'false');
}
window.toggleRail = toggleRail;

/* ============================================================
   MODAL — ADD JAR
   ============================================================ */
let _jarEmojiPickerOpen = false;
let _selectedJarEmoji = '🫙';
let _selectedJarColor = JAR_PALETTE[0];

function updateJarPreview() {
  const preview = document.querySelector('#addJarModal .jar-live-preview');
  if (!preview) return;
  preview.textContent = _selectedJarEmoji;
  // Nền mờ 13% (hex alpha '22') và border nét chính
  preview.style.background = _selectedJarColor + '22';
  preview.style.borderColor = _selectedJarColor;
  // Shadow tỏa ra theo tông màu hũ (opacity ~40% - hex alpha '66')
  preview.style.boxShadow = `0 6px 18px -4px ${_selectedJarColor}66`;

  // Nút CTA tạo hũ tiệp màu gradient
  const btn = document.getElementById('btnSubmitJar');
  if (btn) {
    btn.style.background = `linear-gradient(135deg, ${_selectedJarColor}, ${_selectedJarColor}cc)`;
    btn.style.boxShadow = `0 4px 18px ${_selectedJarColor}4d`; // ~30% opacity
  }
}

function toggleTargetDate() {
  const dateGroup = document.getElementById('jarTargetDateGroup');
  const toggleBtn = document.getElementById('btnToggleTargetDate');
  if (!dateGroup || !toggleBtn) return;

  const isHidden = dateGroup.style.display === 'none' || !dateGroup.style.display;
  if (isHidden) {
    dateGroup.style.display = 'block';
    toggleBtn.textContent = '− Bỏ ngày mục tiêu';
    const dateInput = document.getElementById('jarTargetDateInput');
    if (dateInput) dateInput.focus();
  } else {
    dateGroup.style.display = 'none';
    toggleBtn.textContent = '+ Thêm ngày mục tiêu (tùy chọn)';
    const dateInput = document.getElementById('jarTargetDateInput');
    if (dateInput) dateInput.value = '';
  }
}

function openAddJarModal() {
  _selectedJarEmoji = '🫙';
  _selectedJarColor = JAR_PALETTE[0];
  const overlay = document.getElementById('addJarModal');
  if (!overlay) return;

  // Reset form
  ['jarNameInput','jarTargetInput','jarTargetDateInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Khởi tạo trạng thái Ngày mục tiêu (progressive disclosure) - mặc định ẩn
  const dateGroup = document.getElementById('jarTargetDateGroup');
  const toggleBtn = document.getElementById('btnToggleTargetDate');
  if (dateGroup) dateGroup.style.display = 'none';
  if (toggleBtn) toggleBtn.textContent = '+ Thêm ngày mục tiêu (tùy chọn)';

  // Build emoji picker grid
  const picker = overlay.querySelector('.jar-emoji-grid');
  if (picker) {
    picker.innerHTML = JAR_EMOJIS.map(e =>
      `<button type="button" class="emoji-opt ${e === _selectedJarEmoji ? 'selected' : ''}" onclick="selectJarEmoji('${e}')">${e}</button>`
    ).join('');
  }

  // Build color picker
  const colorPicker = overlay.querySelector('.jar-color-picker');
  if (colorPicker) {
    colorPicker.innerHTML = JAR_PALETTE.map(c =>
      `<button type="button" class="color-dot ${c === _selectedJarColor ? 'selected' : ''}" style="background:${c}" onclick="selectJarColor('${c}')" aria-label="Màu ${c}"></button>`
    ).join('');
  }

  // Cập nhật preview lần đầu
  updateJarPreview();

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const el = document.getElementById('jarNameInput'); if (el) el.focus(); }, 100);
}

function closeAddJarModal() {
  const overlay = document.getElementById('addJarModal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function closeAddJarOnOverlay(e) {
  if (e.target === document.getElementById('addJarModal')) closeAddJarModal();
}

function selectJarEmoji(emoji) {
  _selectedJarEmoji = emoji;
  document.querySelectorAll('#addJarModal .emoji-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent === emoji);
  });
  updateJarPreview();
}

function selectJarColor(color) {
  _selectedJarColor = color;
  document.querySelectorAll('#addJarModal .color-dot').forEach(btn => {
    // Chuẩn hoá để so sánh cả màu RGB và HEX
    const bg = btn.style.background || btn.style.backgroundColor;
    btn.classList.toggle('selected', bg === color || bg.replace(/\s/g, '') === color.replace(/\s/g, ''));
  });
  updateJarPreview();
}

async function submitAddJar() {
  const name = (document.getElementById('jarNameInput')?.value || '').trim();
  const targetRaw = document.getElementById('jarTargetInput')?.value || '';
  
  // Chỉ đọc ngày nếu container đang hiển thị (người dùng chọn dùng)
  const dateGroup = document.getElementById('jarTargetDateGroup');
  const targetDate = (dateGroup && dateGroup.style.display !== 'none')
    ? (document.getElementById('jarTargetDateInput')?.value || null)
    : null;

  if (!name) { showToast('⚠ Vui lòng nhập tên hũ.'); return; }
  const target = parseCurrencyInput(targetRaw);
  if (isNaN(target) || target <= 0) { showToast('⚠ Vui lòng nhập mục tiêu hợp lệ.'); return; }

  const newJar = {
    id: genJarId(),
    name,
    icon: _selectedJarEmoji,
    target,
    current: 0,
    targetDate: targetDate || null,
    color: _selectedJarColor
  };

  jars.push(newJar);
  saveJars();
  closeAddJarModal();
  renderJarCards();
  showToast(`🫙 Đã tạo hũ "${name}"!`);

  // Sync to server
  const serverId = await syncAddJarToServer(newJar);
  if (serverId && serverId !== newJar.id) {
    const local = jars.find(j => j.id === newJar.id);
    if (local) { local.id = serverId; saveJars(); renderJarCards(); }
  }
}


/* ============================================================
   MODAL — JAR TRANSACTION (Deposit / Withdraw)
   ============================================================ */
let _activeJarId = null;
let _activeJarTxnType = 'deposit'; // 'deposit' | 'withdraw'

function openJarTxnModal(jarId, type) {
  _activeJarId = jarId;
  _activeJarTxnType = type;
  const jar = jars.find(j => j.id === jarId);
  if (!jar) return;

  const overlay = document.getElementById('jarTxnModal');
  if (!overlay) return;

  const titleEl   = overlay.querySelector('.jar-txn-title');
  const subtitleEl = overlay.querySelector('.jar-txn-subtitle');
  const labelEl   = overlay.querySelector('.jar-txn-label');
  const amtInput  = document.getElementById('jarTxnAmount');
  const reasonInput = document.getElementById('jarTxnReason');
  const iconEl    = overlay.querySelector('.jar-txn-icon');

  if (titleEl)   titleEl.textContent   = type === 'deposit' ? `Nạp vào "${jar.name}"` : `Rút từ "${jar.name}"`;
  if (subtitleEl) subtitleEl.textContent = `Số dư hiện tại: ${fmtJar(jar.current)}`;
  if (labelEl)   labelEl.textContent   = type === 'deposit' ? 'Số tiền nạp' : 'Số tiền rút';
  if (iconEl)    iconEl.textContent    = jar.icon;
  if (amtInput)  { amtInput.value = ''; }
  if (reasonInput) { reasonInput.value = ''; }

  // Render mini history của hũ này
  renderJarMiniHistory(jar);

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { if (amtInput) amtInput.focus(); }, 100);
}

function closeJarTxnModal() {
  const overlay = document.getElementById('jarTxnModal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  _activeJarId = null;
}

function closeJarTxnOnOverlay(e) {
  if (e.target === document.getElementById('jarTxnModal')) closeJarTxnModal();
}

async function submitJarTxn() {
  if (!_activeJarId) return;
  const jar = jars.find(j => j.id === _activeJarId);
  if (!jar) return;

  const raw = document.getElementById('jarTxnAmount')?.value || '';
  const amount = parseCurrencyInput(raw);
  if (isNaN(amount) || amount <= 0) { showToast('⚠ Vui lòng nhập số tiền hợp lệ.'); return; }

  const reason = (document.getElementById('jarTxnReason')?.value || '').trim();

  if (_activeJarTxnType === 'withdraw') {
    if (amount > jar.current) {
      showToast(`⚠ Số dư hũ chỉ còn ${fmtJar(jar.current)}. Không thể rút nhiều hơn.`);
      return;
    }
    jar.current -= amount;
  } else {
    jar.current += amount;
  }

  // Lưu lịch sử local
  if (!Array.isArray(jar.history)) jar.history = [];
  jar.history.unshift({ type: _activeJarTxnType, amount, reason, date: new Date().toISOString() });
  if (jar.history.length > 200) jar.history = jar.history.slice(0, 200);

  saveJars();

  // ── ĐỒNG BỘ VỚI SỐ DƯ CHÍNH ──────────────────────────────────────────────
  // Nạp vào hũ  → chi tiêu (tiền rời ví chính)
  // Rút từ hũ   → thu nhập (tiền về ví chính)
  const isDeposit = _activeJarTxnType === 'deposit';
  const txnDesc = isDeposit
    ? `Nạp vào hũ: ${jar.name}${reason ? ` — ${reason}` : ''}`
    : `Rút từ hũ: ${jar.name}${reason ? ` — ${reason}` : ''}`;

  const linkedTxn = {
    id: uid(),
    type: isDeposit ? 'expense' : 'income',
    desc: txnDesc,
    amount,
    category: isDeposit ? 'Savings' : 'Savings',
    date: todayISO(),
    createdAt: new Date().toISOString(),
    jarId: jar.id   // liên kết ngược với hũ để truy xuất sau
  };
  transactions.push(linkedTxn);
  saveTransactions();
  syncAddTransactionToServer(linkedTxn);
  // ──────────────────────────────────────────────────────────────────────────

  closeJarTxnModal();
  renderJarCards();
  triggerUIUpdates(); // Đồng bộ số dư tổng + lịch sử giao dịch

  const action = _activeJarTxnType === 'deposit' ? 'Đã nạp' : 'Đã rút';
  showToast(`✓ ${action} ${fmtJar(amount)} ${_activeJarTxnType === 'deposit' ? 'vào' : 'từ'} "${jar.name}"!`);

  await syncJarTransactionToServer(jar.id, _activeJarTxnType, amount, reason);
}

/* Fix #7: confirmDeleteJar hiện chỉ hiện overlay inline, không dùng window.confirm */
function confirmDeleteJar(jarId) {
  const card = document.querySelector(`[data-jar-id="${jarId}"]`);
  if (!card) return;
  card.classList.add('jar-card--confirm-delete');
}

function cancelDeleteJar(jarId) {
  const card = document.querySelector(`[data-jar-id="${jarId}"]`);
  if (!card) return;
  card.classList.remove('jar-card--confirm-delete');
}

function executeDeleteJar(jarId) {
  const jar = jars.find(j => j.id === jarId);
  if (!jar) return;
  jars = jars.filter(j => j.id !== jarId);
  saveJars();
  renderJarCards();
  showToast(`🗑 Đã xóa hũ "${jar.name}".`);
  syncDeleteJarFromServer(jarId);
}

/* ============================================================
   MODAL — ADD INSTALLMENT
   ============================================================ */
let _selectedInstEmoji = '💳';

function openAddInstallmentModal() {
  _selectedInstEmoji = '💳';
  const overlay = document.getElementById('addInstallmentModal');
  if (!overlay) return;

  ['instNameInput','instAmountInput','instDueDateInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const cycleEl = document.getElementById('instCycleSelect');
  if (cycleEl) cycleEl.value = 'monthly';

  const preview = overlay.querySelector('.inst-emoji-preview');
  if (preview) preview.textContent = _selectedInstEmoji;

  const picker = overlay.querySelector('.inst-emoji-grid');
  if (picker) {
    picker.innerHTML = INSTALLMENT_EMOJIS.map(e =>
      `<button type="button" class="emoji-opt ${e === _selectedInstEmoji ? 'selected' : ''}" onclick="selectInstEmoji('${e}')">${e}</button>`
    ).join('');
  }

  // Set today's date + 1 month as default
  const today = new Date();
  today.setMonth(today.getMonth() + 1);
  const p = n => String(n).padStart(2, '0');
  const defaultDate = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  const dueDateEl = document.getElementById('instDueDateInput');
  if (dueDateEl) dueDateEl.value = defaultDate;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const el = document.getElementById('instNameInput'); if (el) el.focus(); }, 100);
}

function closeAddInstallmentModal() {
  const overlay = document.getElementById('addInstallmentModal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function closeAddInstallmentOnOverlay(e) {
  if (e.target === document.getElementById('addInstallmentModal')) closeAddInstallmentModal();
}

function selectInstEmoji(emoji) {
  _selectedInstEmoji = emoji;
  const preview = document.querySelector('#addInstallmentModal .inst-emoji-preview');
  if (preview) preview.textContent = emoji;
  document.querySelectorAll('#addInstallmentModal .emoji-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent === emoji);
  });
}

async function submitAddInstallment() {
  const name = (document.getElementById('instNameInput')?.value || '').trim();
  const amtRaw = document.getElementById('instAmountInput')?.value || '';
  const cycle = document.getElementById('instCycleSelect')?.value || 'monthly';
  const nextDueDate = document.getElementById('instDueDateInput')?.value || '';

  if (!name) { showToast('⚠ Vui lòng nhập tên khoản định kỳ.'); return; }
  const amount = parseCurrencyInput(amtRaw);
  if (isNaN(amount) || amount <= 0) { showToast('⚠ Vui lòng nhập số tiền hợp lệ.'); return; }
  if (!nextDueDate) { showToast('⚠ Vui lòng chọn ngày đến hạn.'); return; }

  const newInst = {
    id: genJarId(),
    name,
    icon: _selectedInstEmoji,
    amount,
    cycle,
    nextDueDate,
    active: true,
    totalPaid: 0
  };

  installments.push(newInst);
  saveInstallments();
  closeAddInstallmentModal();
  refreshInstallmentsPanel();
  showToast(`✓ Đã thêm "${name}"!`);

  const serverId = await syncAddInstallmentToServer(newInst);
  if (serverId && serverId !== newInst.id) {
    const local = installments.find(i => i.id === newInst.id);
    if (local) { local.id = serverId; saveInstallments(); }
  }
}

/* ── MỚI: refreshInstallmentsPanel ── */
function refreshInstallmentsPanel() {
  renderJarSummary();
  renderInstallmentList();
}

/* ── Installment Actions ── */
async function payInstallment(instId) {
  const inst = installments.find(i => i.id === instId);
  if (!inst) return;

  const prevDate = inst.nextDueDate;
  inst.nextDueDate = advanceNextDueDate(inst.nextDueDate, inst.cycle);
  inst.totalPaid = (inst.totalPaid || 0) + inst.amount;
  saveInstallments();

  // Tự động tạo giao dịch chi tiêu tương ứng
  const finalDesc = `Thanh toán: ${inst.name}`;
  const txn = {
    id: uid(),
    type: 'expense',
    desc: finalDesc,
    amount: inst.amount,
    category: 'Installment',
    date: todayISO(),
    createdAt: new Date().toISOString(),
    installmentId: inst.id
  };
  transactions.push(txn);
  saveTransactions();
  syncAddTransactionToServer(txn);

  // Cập nhật giao diện
  refreshInstallmentsPanel();
  triggerUIUpdates();

  showToast(`✓ Đã thanh toán ${fmtJar(inst.amount)} cho "${inst.name}"! Kỳ tiếp: ${inst.nextDueDate}`);

  const serverData = await syncPayInstallmentToServer(inst.id);
  if (serverData && serverData.nextDueDate) {
    inst.nextDueDate = serverData.nextDueDate;
    inst.totalPaid = serverData.totalPaid;
    saveInstallments();
    refreshInstallmentsPanel();
  }
}

function toggleInstallmentActive(instId) {
  const inst = installments.find(i => i.id === instId);
  if (!inst) return;
  inst.active = !inst.active;
  saveInstallments();
  refreshInstallmentsPanel();
  showToast(inst.active ? `▶ Đã kích hoạt "${inst.name}"` : `⏸ Đã tạm dừng "${inst.name}"`);
}

function confirmDeleteInstallment(instId) {
  const card = document.querySelector(`.inst-item[data-inst-id="${instId}"]`);
  if (card) card.classList.add('inst-item--confirm-delete');
}

function cancelDeleteInstallment(instId) {
  const card = document.querySelector(`.inst-item[data-inst-id="${instId}"]`);
  if (card) card.classList.remove('inst-item--confirm-delete');
}

function executeDeleteInstallment(instId) {
  const inst = installments.find(i => i.id === instId);
  const name = inst ? inst.name : '';
  installments = installments.filter(i => i.id !== instId);
  saveInstallments();
  refreshInstallmentsPanel();
  showToast(`🗑 Đã xóa "${name}".`);
  syncDeleteInstallmentFromServer(instId);
}

/* ── Init Jars on page load ── */
(function initJars() {
  loadJars();
  loadInstallments();
  // Sync from server after main load (non-blocking)
  // Called via syncLoadJarsFromServer() after auth is confirmed
})();

/* ============================================================
   MỚI: Render mini history trong jar txn modal
   ============================================================ */
function renderJarMiniHistory(jar) {
  const listEl = document.getElementById('jarMiniHistoryList');
  const wrapEl = document.getElementById('jarMiniHistory');
  if (!listEl) return;

  const history = Array.isArray(jar.history) ? jar.history : [];
  if (history.length === 0) {
    if (wrapEl) wrapEl.style.display = 'none';
    return;
  }
  if (wrapEl) wrapEl.style.display = 'block';

  const recent = history.slice(0, 5);
  listEl.innerHTML = recent.map(h => {
    const isDeposit = h.type === 'deposit';
    const icon = isDeposit ? '⬆️' : '⬇️';
    const cls  = isDeposit ? 'jar-mini-hist--deposit' : 'jar-mini-hist--withdraw';
    const dateStr = h.date ? new Date(h.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
    const reasonStr = h.reason ? `<span class="jar-mini-hist__reason">— ${h.reason}</span>` : '';
    return `
      <li class="jar-mini-hist-item ${cls}">
        <span class="jar-mini-hist__icon">${icon}</span>
        <span class="jar-mini-hist__amount">${fmtJar(h.amount)}</span>
        ${reasonStr}
        <span class="jar-mini-hist__date">${dateStr}</span>
      </li>`;
  }).join('');
}

/* ============================================================
   MỚI: Modal Lịch sử tập trung #jarHistoryModal
   ============================================================ */
let _jarHistoryAllData = []; // [{jarId, jarName, jarIcon, ...entry}]

function openJarHistoryModal() {
  const overlay = document.getElementById('jarHistoryModal');
  if (!overlay) return;

  // Build merged history from all jars
  _jarHistoryAllData = [];
  jars.forEach(jar => {
    if (!Array.isArray(jar.history)) return;
    jar.history.forEach(h => {
      _jarHistoryAllData.push({ ...h, jarId: jar.id, jarName: jar.name, jarIcon: jar.icon });
    });
  });
  _jarHistoryAllData.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Populate filter dropdown
  const sel = document.getElementById('jarHistoryFilterSelect');
  if (sel) {
    const tObj = I18N[currentLang] || I18N.en;
    sel.innerHTML = `<option value="">${tObj.jarHistoryAll || 'Tất cả hũ'}</option>`
      + jars.map(j => `<option value="${j.id}">${j.icon} ${j.name}</option>`).join('');
    sel.value = '';
  }

  renderJarHistory('');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeJarHistoryModal() {
  const overlay = document.getElementById('jarHistoryModal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function closeJarHistoryOnOverlay(e) {
  if (e.target === document.getElementById('jarHistoryModal')) closeJarHistoryModal();
}

function filterJarHistory(jarId) {
  renderJarHistory(jarId);
}

function renderJarHistory(filterJarId) {
  const body = document.getElementById('jarHistoryBody');
  if (!body) return;
  const tObj = I18N[currentLang] || I18N.en;

  const data = filterJarId
    ? _jarHistoryAllData.filter(h => h.jarId === filterJarId)
    : _jarHistoryAllData;

  if (data.length === 0) {
    body.innerHTML = `<p class="jar-history-empty">${tObj.jarHistoryEmpty || 'Chưa có lịch sử giao dịch.'}</p>`;
    return;
  }

  body.innerHTML = data.map(h => {
    const isDeposit = h.type === 'deposit';
    const icon   = isDeposit ? '⬆️' : '⬇️';
    const cls    = isDeposit ? 'jar-hist-row--deposit' : 'jar-hist-row--withdraw';
    const dateStr = h.date
      ? new Date(h.date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    return `
      <div class="jar-hist-row ${cls}">
        <span class="jar-hist-row__icon">${icon}</span>
        <div class="jar-hist-row__info">
          <span class="jar-hist-row__jar">${h.jarIcon} ${h.jarName}</span>
          ${h.reason ? `<span class="jar-hist-row__reason">${h.reason}</span>` : ''}
        </div>
        <div class="jar-hist-row__right">
          <span class="jar-hist-row__amount">${isDeposit ? '+' : '−'}${fmtJar(h.amount)}</span>
          <span class="jar-hist-row__date">${dateStr}</span>
        </div>
      </div>`;
  }).join('');
}

/* ============================================================
   MỚI: onCatChange — hiện/ẩn dropdown installment
   ============================================================ */
function onCatChange(value) {
  const grp = document.getElementById('installmentSelectGroup');
  if (!grp) return;

  if (value === 'Installment') {
    grp.style.display = 'block';
    // Populate dropdown với các khoản định kỳ active
    const sel = document.getElementById('txnInstallmentLink');
    if (sel) {
      const tObj = I18N[currentLang] || I18N.en;
      const active = installments.filter(i => i.active);
      sel.innerHTML = `<option value="">${tObj.installmentSelectPlaceholder || 'Chọn khoản định kỳ...'}</option>`
        + active.map(i => `<option value="${i.id}" data-amount="${i.amount}">${i.icon} ${i.name} — ${fmtJar(i.amount)}</option>`).join('');

      // Đồng bộ giao diện custom select
      syncCustomDropdown('txnInstallmentLink');
    }
  } else {
    grp.style.display = 'none';
  }
}

/* ============================================================
   MỚI: checkInstallmentsStatus — cập nhật màu panel định kỳ
   ============================================================ */
function checkInstallmentsStatus() {
  const section = document.querySelector('.installments-section');
  if (!section) return;

  const activeInsts = installments.filter(i => i.active);
  if (activeInsts.length === 0) {
    section.classList.remove('status--pending', 'status--completed');
    return;
  }

  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear  = today.getFullYear();

  // Khoản được coi là "cần thanh toán trong tháng này"
  // nếu nextDueDate nằm trong tháng hiện tại hoặc đã quá hạn
  const dueSoon = activeInsts.filter(i => {
    const d = new Date(i.nextDueDate + 'T00:00:00');
    return (d.getFullYear() < thisYear)
      || (d.getFullYear() === thisYear && d.getMonth() <= thisMonth);
  });

  section.classList.remove('status--pending', 'status--completed');
  if (dueSoon.length > 0) {
    section.classList.add('status--pending');
  } else {
    section.classList.add('status--completed');
  }
}

/* ── Window exports (extended) ── */
window.renderJarsView       = renderJarsView;
window.openAddJarModal      = openAddJarModal;
window.closeAddJarModal     = closeAddJarModal;
window.closeAddJarOnOverlay = closeAddJarOnOverlay;
window.selectJarEmoji       = selectJarEmoji;
window.selectJarColor       = selectJarColor;
window.toggleTargetDate     = toggleTargetDate;
window.submitAddJar         = submitAddJar;
window.openJarTxnModal      = openJarTxnModal;
window.closeJarTxnModal     = closeJarTxnModal;
window.closeJarTxnOnOverlay = closeJarTxnOnOverlay;
window.submitJarTxn         = submitJarTxn;
window.confirmDeleteJar     = confirmDeleteJar;
window.cancelDeleteJar      = cancelDeleteJar;
window.executeDeleteJar     = executeDeleteJar;
window.openAddInstallmentModal  = openAddInstallmentModal;
window.closeAddInstallmentModal = closeAddInstallmentModal;
window.closeAddInstallmentOnOverlay = closeAddInstallmentOnOverlay;
window.selectInstEmoji      = selectInstEmoji;
window.submitAddInstallment = submitAddInstallment;
window.payInstallment       = payInstallment;
window.toggleInstallmentActive = toggleInstallmentActive;
window.confirmDeleteInstallment = confirmDeleteInstallment;
window.cancelDeleteInstallment  = cancelDeleteInstallment;
window.executeDeleteInstallment = executeDeleteInstallment;
window.syncLoadJarsFromServer = syncLoadJarsFromServer;
window.triggerJarSlosh      = triggerJarSlosh;
// MỚI: History & Installment dropdown
window.openJarHistoryModal      = openJarHistoryModal;
window.closeJarHistoryModal     = closeJarHistoryModal;
window.closeJarHistoryOnOverlay = closeJarHistoryOnOverlay;
window.filterJarHistory         = filterJarHistory;
window.onCatChange              = onCatChange;
window.checkInstallmentsStatus  = checkInstallmentsStatus;
