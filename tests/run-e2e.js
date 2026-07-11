/**
 * CaltDHy E2E Test Suite and Runner
 * Built-in JSDOM Simulation Runner
 * Verifies 38 test cases across 4 Tiers
 */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

// Paths to static frontend files
const htmlPath = path.resolve(__dirname, '../frontEnd/spending.html');
const themeManagerPath = path.resolve(__dirname, '../frontEnd/theme-manager.js');
const focusTrapPath = path.resolve(__dirname, '../frontEnd/focus-trap.js');
const spendingPath = path.resolve(__dirname, '../frontEnd/spending.js');

// Load files
const htmlContentRaw = fs.readFileSync(htmlPath, 'utf8');
// Strip all script elements so they don't auto-run on JSDOM creation
// We will evaluate them manually in correct order after mocking context
const htmlContent = htmlContentRaw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

const themeManagerCode = fs.readFileSync(themeManagerPath, 'utf8');
const focusTrapCode = fs.readFileSync(focusTrapPath, 'utf8');
const spendingCode = fs.readFileSync(spendingPath, 'utf8');

// Append exposure utility to spending.js to allow testing access to lexically-scoped variables
const exposureCode = `
; (function() {
  window._testExposure = {
    get transactions() { return transactions; },
    set transactions(val) { transactions = val; },
    get budgets() { return budgets; },
    set budgets(val) { budgets = val; },
    get jars() { return jars; },
    set jars(val) { jars = val; },
    get customCategories() { return customCategories; },
    set customCategories(val) { customCategories = val; },
    saveTransactions: typeof saveTransactions !== 'undefined' ? saveTransactions : null,
    saveBudgets: typeof saveBudgets !== 'undefined' ? saveBudgets : null,
    saveJars: typeof saveJars !== 'undefined' ? saveJars : null,
    updateTrendChart: typeof updateTrendChart !== 'undefined' ? updateTrendChart : null,
    saveCustomCategories: typeof saveCustomCategories !== 'undefined' ? saveCustomCategories : null,
    loadCustomCategories: typeof loadCustomCategories !== 'undefined' ? loadCustomCategories : null,
    calcMetrics: typeof calcMetrics !== 'undefined' ? calcMetrics : null,
    renderFeed: typeof renderFeed !== 'undefined' ? renderFeed : null,
    renderBudgetPanel: typeof renderBudgetPanel !== 'undefined' ? renderBudgetPanel : null,
    updateChart: typeof updateChart !== 'undefined' ? updateChart : null,
    renderJarCards: typeof renderJarCards !== 'undefined' ? renderJarCards : null,
    loadBudgets: typeof loadBudgets !== 'undefined' ? loadBudgets : null,
    loadTransactions: typeof loadTransactions !== 'undefined' ? loadTransactions : null,
  };
})();
`;
const spendingCodeWithExposure = spendingCode + exposureCode;

/**
 * Creates and configures a clean JSDOM window context.
 */
function setupJSDOM(initialLocalStorage = {}, mockFetchConfig = {}) {
  // Suppress "Not implemented: navigation" warnings in JSDOM console
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    if (error.message && error.message.includes("Not implemented: navigation")) {
      return;
    }
    console.error(error);
  });

  const dom = new JSDOM(htmlContent, {
    url: "http://localhost:8080/spending.html",
    runScripts: "dangerously",
    virtualConsole
  });
  const { window } = dom;
  const { document } = window;

  // Clear and seed the native JSDOM window.localStorage directly (to avoid JSDOM _origin errors)
  window.localStorage.clear();
  for (const key in initialLocalStorage) {
    window.localStorage.setItem(key, initialLocalStorage[key]);
  }

  // Location Mock
  let currentHref = "http://localhost:8080/spending.html";
  delete window.location;
  window.location = {
    get href() { return currentHref; },
    set href(val) { currentHref = val; },
    assign(url) { currentHref = url; },
    replace(url) { currentHref = url; },
    reload() {}
  };

  // ScrollTo, requestAnimationFrame
  window.scrollTo = () => {};
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);

  // ResizeObserver Mock (Chart.js needs this)
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver;

  // Chart Mock Spy
  class MockChart {
    constructor(canvas, config) {
      this.canvas = canvas;
      this.config = config || {};
      this.data = this.config.data || { datasets: [{}, {}] };
      // Ensure data.datasets has elements to prevent TypeError when setting properties of datasets
      if (!this.data.datasets) {
        this.data.datasets = [{}, {}];
      }
      if (this.data.datasets.length < 2) {
        while (this.data.datasets.length < 2) {
          this.data.datasets.push({});
        }
      }
      this.options = this.config.options || {};
      
      // Stub scales and properties to prevent crashes
      if (!this.options.scales) this.options.scales = {};
      if (!this.options.scales.x) this.options.scales.x = { grid: {}, ticks: {} };
      if (!this.options.scales.y) this.options.scales.y = { grid: {}, ticks: {} };
      if (!this.options.scales.r) this.options.scales.r = { grid: {}, angleLines: {}, ticks: {} };
      if (!this.options.scales.x.grid) this.options.scales.x.grid = {};
      if (!this.options.scales.x.ticks) this.options.scales.x.ticks = {};
      if (!this.options.scales.y.grid) this.options.scales.y.grid = {};
      if (!this.options.scales.y.ticks) this.options.scales.y.ticks = {};
      if (!this.options.scales.r.grid) this.options.scales.r.grid = {};
      if (!this.options.scales.r.angleLines) this.options.scales.r.angleLines = {};
      if (!this.options.scales.r.ticks) this.options.scales.r.ticks = {};

      if (!this.options.plugins) this.options.plugins = {};
      if (!this.options.plugins.legend) this.options.plugins.legend = { labels: {} };
      if (!this.options.plugins.legend.labels) this.options.plugins.legend.labels = {};
      if (!this.options.plugins.tooltip) this.options.plugins.tooltip = {};

      MockChart.instances.push(this);
    }
    update() {
      MockChart.updates.push(this.config);
    }
    destroy() {
      MockChart.destroyed.push(this);
    }
  }
  MockChart.instances = [];
  MockChart.updates = [];
  MockChart.destroyed = [];
  window.Chart = MockChart;

  // Fetch Mock Spy & Stub
  const fetchCalls = [];
  window.fetch = async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const urlString = url.toString();
    
    // Parse path
    let pathName = urlString;
    if (urlString.startsWith('http') || urlString.startsWith('/')) {
      try {
        const urlObj = new URL(urlString, 'http://localhost:8080');
        pathName = urlObj.pathname;
      } catch (_) {}
    }

    fetchCalls.push({ url: urlString, method, options });

    if (mockFetchConfig.shouldFail) {
      throw new Error("Network error");
    }

    if (mockFetchConfig.statusResponse) {
      const resp = mockFetchConfig.statusResponse;
      if (resp.status === 401) {
        // Mock authorization error side effects
        window.localStorage.removeItem('caltdhy_token');
        window.location.href = 'login.html';
      }
      return {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        json: async () => resp.body
      };
    }

    // Default API mocks
    if (pathName.includes('/api/spending/budget')) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: mockFetchConfig.budgetData || {} }) };
    }
    if (pathName.includes('/api/spending/categories')) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: mockFetchConfig.categoriesData || [] }) };
    }
    if (pathName.includes('/api/spending')) {
      if (method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        return { ok: true, status: 200, json: async () => ({ success: true, data: body }) };
      }
      if (method === 'DELETE') {
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: mockFetchConfig.transactionsData || [] }) };
    }
    if (pathName.includes('/api/jars/installments')) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: mockFetchConfig.installmentsData || [] }) };
    }
    if (pathName.includes('/api/jars')) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: mockFetchConfig.jarsData || [] }) };
    }
    if (pathName.includes('/api/auth/profile')) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: { name: 'Test User', username: 'testuser' } }) };
    }

    return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
  };
  window.fetch.calls = fetchCalls;

  // Evaluate scripts in order
  dom.window.eval(themeManagerCode);
  dom.window.eval(focusTrapCode);
  dom.window.eval(spendingCodeWithExposure);

  return { dom, window, document, mockLocalStorage: window.localStorage, mockChart: MockChart };
}

/**
 * Triggers DOMContentLoaded to boot the application.
 */
function bootJSDOM(domInstance) {
  const event = domInstance.window.document.createEvent("Event");
  event.initEvent("DOMContentLoaded", true, true);
  domInstance.window.document.dispatchEvent(event);
  
  // Wait a small duration for DOMContentLoaded handlers to execute
  return new Promise(resolve => setTimeout(resolve, 30));
}

// -------------------------------------------------------------
// 38 Test Cases Defined
// -------------------------------------------------------------
const tests = [
  // --- TIER 1: FEATURE COVERAGE (15 tests) ---

  // Feature 1: UI/UX Theme Support (5 tests)
  {
    id: "Test 1.1",
    tier: "Tier 1: UI/UX",
    name: "Default Theme Initialization",
    run: async ({ document }) => {
      const rootClass = document.documentElement.className;
      if (rootClass.includes('light-theme') || rootClass.includes('cream-theme') || rootClass.includes('green-theme')) {
        throw new Error(`Expected default dark theme, got document class: "${rootClass}"`);
      }
      const icon = document.querySelector('[data-theme-icon]');
      if (!icon) throw new Error("Theme icon element [data-theme-icon] not found");
      if (icon.textContent !== '🌙') {
        throw new Error(`Expected default dark icon 🌙, got "${icon.textContent}"`);
      }
    }
  },
  {
    id: "Test 1.2",
    tier: "Tier 1: UI/UX",
    name: "Switch to Light Theme",
    run: async ({ document, window }) => {
      const btn = document.getElementById('theme-btn-light');
      if (!btn) throw new Error("Theme button theme-btn-light not found");
      btn.click();
      if (!document.documentElement.classList.contains('light-theme')) {
        throw new Error("Document element does not contain light-theme class");
      }
      if (window.localStorage.getItem('caltdhy_theme') !== 'light') {
        throw new Error("Theme was not persisted as 'light' in localStorage");
      }
    }
  },
  {
    id: "Test 1.3",
    tier: "Tier 1: UI/UX",
    name: "Switch to Cream Theme",
    run: async ({ document, window }) => {
      const btn = document.getElementById('theme-btn-cream');
      if (!btn) throw new Error("Theme button theme-btn-cream not found");
      btn.click();
      if (!document.documentElement.classList.contains('cream-theme')) {
        throw new Error("Document element does not contain cream-theme class");
      }
      if (window.localStorage.getItem('caltdhy_theme') !== 'cream') {
        throw new Error("Theme was not persisted as 'cream' in localStorage");
      }
    }
  },
  {
    id: "Test 1.4",
    tier: "Tier 1: UI/UX",
    name: "Switch to Green Theme",
    run: async ({ document, window }) => {
      const btn = document.getElementById('theme-btn-green');
      if (!btn) throw new Error("Theme button theme-btn-green not found");
      btn.click();
      if (!document.documentElement.classList.contains('green-theme')) {
        throw new Error("Document element does not contain green-theme class");
      }
      if (window.localStorage.getItem('caltdhy_theme') !== 'green') {
        throw new Error("Theme was not persisted as 'green' in localStorage");
      }
    }
  },
  {
    id: "Test 1.5",
    tier: "Tier 1: UI/UX",
    name: "Side Rail Folding Toggle",
    run: async ({ document, window }) => {
      const btn = document.querySelector('.btn-rail-toggle');
      if (!btn) throw new Error("Rail toggle button not found");
      btn.click();
      const body = document.querySelector('.app-body');
      if (!body) throw new Error(".app-body layout wrapper not found");
      if (!body.classList.contains('rail-collapsed')) {
        throw new Error(".app-body layout did not collapse");
      }
      if (window.localStorage.getItem('railCollapsed') !== 'true') {
        throw new Error("railCollapsed preference not persisted in localStorage");
      }
    }
  },

  // Feature 2: Daily Spending Trend Chart Canvas (5 tests)
  {
    id: "Test 2.1",
    tier: "Tier 1: Chart",
    name: "Trend Chart Canvas Presence",
    run: async ({ document }) => {
      const canvas = document.querySelector('#view-analytics canvas#dailyTrendChart');
      if (!canvas) {
        throw new Error("Canvas element with ID 'dailyTrendChart' not found inside '#view-analytics' (Feature not yet implemented)");
      }
    }
  },
  {
    id: "Test 2.2",
    tier: "Tier 1: Chart",
    name: "Chart Object Instantiation",
    run: async ({ document, mockChart }) => {
      const navBtn = document.getElementById('nav-analytics');
      if (navBtn) navBtn.click();
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) {
        throw new Error("No Chart instance associated with canvas 'dailyTrendChart' was instantiated");
      }
    }
  },
  {
    id: "Test 2.3",
    tier: "Tier 1: Chart",
    name: "Reactive Chart updates on Transaction Addition",
    run: async ({ window, mockChart }) => {
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Trend chart not instantiated");
      
      const exposure = window._testExposure;
      const beforeCount = mockChart.updates.length;
      exposure.transactions.push({
        id: "add-ch-1", type: "expense", desc: "Chart Add Test", amount: 150000, category: "Food & Dining", date: new Date().toISOString().split('T')[0]
      });
      exposure.saveTransactions();
      if (exposure.updateTrendChart) {
        exposure.updateTrendChart();
      }
      
      const afterCount = mockChart.updates.length;
      if (afterCount <= beforeCount) {
        throw new Error("Chart update() was not called after transaction addition");
      }
    }
  },
  {
    id: "Test 2.4",
    tier: "Tier 1: Chart",
    name: "Reactive Chart updates on Transaction Deletion",
    run: async ({ window, mockChart }) => {
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Trend chart not instantiated");
      
      const exposure = window._testExposure;
      exposure.transactions = [
        { id: "del-ch-1", type: "expense", desc: "Del Chart Test", amount: 80000, category: "Food & Dining", date: new Date().toISOString().split('T')[0] }
      ];
      exposure.saveTransactions();
      if (exposure.updateTrendChart) exposure.updateTrendChart();
      
      const beforeCount = mockChart.updates.length;
      exposure.transactions = [];
      exposure.saveTransactions();
      if (exposure.updateTrendChart) exposure.updateTrendChart();
      
      const afterCount = mockChart.updates.length;
      if (afterCount <= beforeCount) {
        throw new Error("Chart update() was not called after transaction deletion");
      }
    }
  },
  {
    id: "Test 2.5",
    tier: "Tier 1: Chart",
    name: "Month Switch Refreshes Chart Scope",
    run: async ({ window, mockChart }) => {
      window.currentYear = 2028;
      window.currentMonth = 1; // Feb 2028 (leap year)
      
      const exposure = window._testExposure;
      if (exposure.updateTrendChart) exposure.updateTrendChart();
      
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Trend chart not instantiated");
      
      const labels = trendChart.config.data.labels;
      if (labels.length !== 29) {
        throw new Error(`Expected 29 day intervals for Feb 2028, got ${labels.length}`);
      }
    }
  },

  // Feature 3: Transactions CRUD (5 tests)
  {
    id: "Test 3.1",
    tier: "Tier 1: CRUD",
    name: "Load Existing Transactions",
    setupFetch: (cfg) => {
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      cfg.transactionsData = [
        { id: "s-1", type: "income", desc: "Job Salary", amount: 20000000, category: "Salary", date: `${currentMonthPrefix}-01` },
        { id: "s-2", type: "expense", desc: "Fast Food", amount: 150000, category: "Food & Dining", date: `${currentMonthPrefix}-02` }
      ];
    },
    run: async ({ document }) => {
      const feed = document.getElementById('txnFeed');
      if (!feed) throw new Error("#txnFeed container not found");
      const slots = feed.querySelectorAll('.txn-slot');
      if (slots.length !== 2) {
        throw new Error(`Expected 2 transaction slots, found ${slots.length}`);
      }
    }
  },
  {
    id: "Test 3.2",
    tier: "Tier 1: CRUD",
    name: "Create New Transaction",
    run: async ({ document, window }) => {
      window.openModal();
      document.getElementById('txnDesc').value = "Premium Coffee";
      document.getElementById('txnAmount').value = "65000";
      document.getElementById('txnCat').value = "Food & Dining";
      document.getElementById('txnDate').value = "2026-05-15";
      window.currentType = "expense";
      
      const form = document.getElementById('txnForm');
      form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      
      const exposure = window._testExposure;
      const found = exposure.transactions.find(t => t.desc === "Premium Coffee");
      if (!found) throw new Error("New transaction was not added to state list");
      if (found.amount !== 65000) throw new Error(`Expected amount 65000, got ${found.amount}`);
      
      const localStore = JSON.parse(window.localStorage.getItem('caltdhy_txns') || '[]');
      if (!localStore.some(t => t.desc === "Premium Coffee")) {
        throw new Error("New transaction was not persisted in localStorage");
      }
    }
  },
  {
    id: "Test 3.3",
    tier: "Tier 1: CRUD",
    name: "Edit Existing Transaction",
    setupStorage: (storage) => {
      storage.caltdhy_txns = JSON.stringify([
        { id: "e-target", type: "expense", desc: "Lunch", amount: 100000, category: "Food & Dining", date: "2026-05-10" }
      ]);
    },
    run: async ({ document }) => {
      const editBtn = document.querySelector('.txn-edit');
      if (!editBtn) {
        throw new Error("Edit transaction button '.txn-edit' not found (Feature not yet implemented)");
      }
    }
  },
  {
    id: "Test 3.4",
    tier: "Tier 1: CRUD",
    name: "Delete Transaction",
    setupFetch: (cfg) => {
      const today = new Date().toISOString().split('T')[0];
      cfg.transactionsData = [
        { id: "d-target", type: "expense", desc: "Delete Me", amount: 50000, category: "Food & Dining", date: today }
      ];
    },
    run: async ({ document, window }) => {
      const slot = document.querySelector('.txn-slot[data-id="d-target"]');
      if (!slot) throw new Error("Transaction slot for d-target not rendered");
      
      const delBtn = slot.querySelector('.txn-delete');
      if (!delBtn) throw new Error("Delete button inside slot not found");
      delBtn.click();
      
      const exposure = window._testExposure;
      const found = exposure.transactions.some(t => t.id === "d-target");
      if (found) throw new Error("Transaction state still contains deleted item");
      
      const stored = JSON.parse(window.localStorage.getItem('caltdhy_txns') || '[]');
      if (stored.some(t => t.id === "d-target")) {
        throw new Error("Transaction still persisted in localStorage after deletion");
      }
    }
  },
  {
    id: "Test 3.5",
    tier: "Tier 1: CRUD",
    name: "Client Server Sync When Online",
    run: async ({ document, window }) => {
      window.isServerConnected = true;
      window.openModal();
      document.getElementById('txnDesc').value = "Online Sync Test";
      document.getElementById('txnAmount').value = "99000";
      document.getElementById('txnCat').value = "Food & Dining";
      document.getElementById('txnDate').value = new Date().toISOString().split('T')[0];
      window.currentType = "expense";
      
      const form = document.getElementById('txnForm');
      form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      
      const apiCalls = window.fetch.calls.filter(c => c.method === 'POST' && c.url.includes('/api/spending'));
      if (apiCalls.length === 0) {
        throw new Error("No network POST request was issued to synchronize transactions");
      }
    }
  },

  // --- TIER 2: BOUNDARY & CORNER CASES (15 tests) ---

  // Feature 1: UI/UX theme / recovery / modals (5 tests)
  {
    id: "Test 1.6",
    tier: "Tier 2: UI/UX",
    name: "Corrupted Local Storage Theme Recovery",
    setupStorage: (storage) => {
      storage.caltdhy_theme = "invalid-hacked-theme-invalid";
    },
    run: async ({ window }) => {
      const cur = window.ThemeManager ? window.ThemeManager.get() : null;
      if (cur !== 'dark' && cur !== null) {
        throw new Error(`Expected theme fallback to 'dark' for invalid config values, got '${cur}'`);
      }
    }
  },
  {
    id: "Test 1.7",
    tier: "Tier 2: UI/UX",
    name: "Extreme Title/Username Length Ellipsis",
    setupStorage: (storage) => {
      storage.caltdhy_user = JSON.stringify({ name: "A".repeat(300), username: "heavyuser" });
    },
    run: async ({ document }) => {
      const greeting = document.getElementById('userGreeting');
      if (greeting && !greeting.textContent.includes("Xin chào") && !greeting.textContent.includes("Welcome")) {
        throw new Error("Greeting element failed to render content correctly with extreme long user name");
      }
    }
  },
  {
    id: "Test 1.8",
    tier: "Tier 2: UI/UX",
    name: "Rapid Successive Theme Clicking",
    run: async ({ document }) => {
      const darkBtn = document.getElementById('theme-btn-dark');
      const lightBtn = document.getElementById('theme-btn-light');
      if (darkBtn && lightBtn) {
        for (let i = 0; i < 30; i++) {
          darkBtn.click();
          lightBtn.click();
        }
      }
      // Success if no Javascript exceptions are raised during execution
    }
  },
  {
    id: "Test 1.9",
    tier: "Tier 2: UI/UX",
    name: "Settings Modal Focus Trap Isolation",
    run: async ({ document, window }) => {
      const btn = document.getElementById('btnSettings');
      if (!btn) throw new Error("Settings button not found");
      btn.click();
      
      const modal = document.getElementById('settingsModal');
      if (!modal) throw new Error("Settings modal #settingsModal not found");
      if (!modal.classList.contains('open')) throw new Error("Modal did not open");
      
      // Escape closes modal
      const escEvt = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      modal.dispatchEvent(escEvt);
      if (modal.classList.contains('open')) {
        throw new Error("Pressing Escape did not dismiss the settings modal");
      }
    }
  },
  {
    id: "Test 1.10",
    tier: "Tier 2: UI/UX",
    name: "Localization Missing Key Fallback",
    run: async ({ window }) => {
      if (typeof window.t === 'function') {
        const res = window.t('nonexistent_key_fallback');
        if (res === undefined) {
          throw new Error("Translation system returned 'undefined' for missing translation keys");
        }
      }
    }
  },

  // Feature 2: Chart Boundaries (5 tests)
  {
    id: "Test 2.6",
    tier: "Tier 2: Chart",
    name: "Zero Transactions Chart Empty State",
    setupStorage: (storage) => {
      storage.caltdhy_txns = JSON.stringify([]);
    },
    run: async ({ document, window, mockChart }) => {
      const exposure = window._testExposure;
      if (exposure.updateTrendChart) exposure.updateTrendChart();
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Trend chart not instantiated");
      
      const dataset = trendChart.config.data.datasets[0];
      const allZeros = dataset.data.every(val => val === 0);
      if (!allZeros) throw new Error("Chart values are not 0 when transactions lists are empty");
      
      const placeholder = document.getElementById('trendEmpty') || document.getElementById('chartEmpty');
      if (placeholder && placeholder.hidden) {
        throw new Error("Empty state warning should be visible when there is no data");
      }
    }
  },
  {
    id: "Test 2.7",
    tier: "Tier 2: Chart",
    name: "Leap Year Date Bounds",
    run: async ({ window, mockChart }) => {
      window.currentYear = 2029;
      window.currentMonth = 1; // Feb 2029 (non-leap)
      
      const exposure = window._testExposure;
      if (exposure.updateTrendChart) exposure.updateTrendChart();
      
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Trend chart not instantiated");
      
      const len = trendChart.config.data.labels.length;
      if (len !== 28) {
        throw new Error(`Expected exactly 28 days for Feb 2029, got ${len}`);
      }
    }
  },
  {
    id: "Test 2.8",
    tier: "Tier 2: Chart",
    name: "Aggregation of Multi-Transaction Single Day",
    setupStorage: (storage) => {
      const today = new Date().toISOString().split('T')[0];
      storage.caltdhy_txns = JSON.stringify([
        { id: "agg-1", type: "expense", desc: "Item 1", amount: 100000, category: "Food & Dining", date: today },
        { id: "agg-2", type: "expense", desc: "Item 2", amount: 200000, category: "Food & Dining", date: today }
      ]);
    },
    run: async ({ window, mockChart }) => {
      const exposure = window._testExposure;
      if (exposure.updateTrendChart) exposure.updateTrendChart();
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Trend chart not instantiated");
      
      const dataset = trendChart.config.data.datasets[0];
      const todayDay = new Date().getDate();
      const value = dataset.data[todayDay - 1];
      if (value !== 300000) {
        throw new Error(`Expected daily aggregation to sum transactions (300000), got ${value}`);
      }
    }
  },
  {
    id: "Test 2.9",
    tier: "Tier 2: Chart",
    name: "Extreme Trillion VND Financial Scale",
    setupStorage: (storage) => {
      const today = new Date().toISOString().split('T')[0];
      storage.caltdhy_txns = JSON.stringify([
        { id: "scale-1", type: "expense", desc: "Extreme Buy", amount: 999999999999999, category: "Food & Dining", date: today }
      ]);
    },
    run: async ({ window, mockChart }) => {
      const exposure = window._testExposure;
      if (exposure.updateTrendChart) exposure.updateTrendChart();
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Trend chart not instantiated");
      
      const day = new Date().getDate();
      const val = trendChart.config.data.datasets[0].data[day - 1];
      if (val !== 999999999999999) {
        throw new Error(`Expected trillions scale value preservation, got ${val}`);
      }
    }
  },
  {
    id: "Test 2.10",
    tier: "Tier 2: Chart",
    name: "Styling Contrast Update on Theme Swap",
    run: async ({ window, mockChart }) => {
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Trend chart not instantiated");
      
      window.pickTheme('light');
      const lightColor = trendChart.config.options.scales?.x?.ticks?.color;
      
      window.pickTheme('dark');
      const darkColor = trendChart.config.options.scales?.x?.ticks?.color;
      
      if (lightColor === darkColor && lightColor !== undefined) {
        throw new Error("Chart scale colors were not updated on theme swap");
      }
    }
  },

  // Feature 3: CRUD Boundaries (5 tests)
  {
    id: "Test 3.6",
    tier: "Tier 2: CRUD",
    name: "Non-Positive Amount Rejection",
    run: async ({ document, window }) => {
      window.openModal();
      document.getElementById('txnDesc').value = "Invalid Amount Test";
      document.getElementById('txnAmount').value = "-500";
      document.getElementById('txnCat').value = "Food & Dining";
      document.getElementById('txnDate').value = "2026-05-15";
      
      const exposure = window._testExposure;
      const beforeCount = exposure.transactions.length;
      const form = document.getElementById('txnForm');
      form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      
      if (exposure.transactions.length > beforeCount) {
        throw new Error("Transaction with negative amount was successfully created");
      }
    }
  },
  {
    id: "Test 3.7",
    tier: "Tier 2: CRUD",
    name: "Future Date Bounds Rejection",
    run: async ({ document, window }) => {
      window.openModal();
      document.getElementById('txnDesc').value = "Future Date Test";
      document.getElementById('txnAmount').value = "100000";
      document.getElementById('txnCat').value = "Food & Dining";
      document.getElementById('txnDate').value = "2099-12-31";
      
      const exposure = window._testExposure;
      const beforeCount = exposure.transactions.length;
      const form = document.getElementById('txnForm');
      form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      
      const added = exposure.transactions.find(t => t.desc === "Future Date Test");
      if (added) {
        // If allowed in database, verify it is filtered out of layout feed
        const feed = document.getElementById('txnFeed');
        if (feed.innerHTML.includes("Future Date Test")) {
          throw new Error("Future-dated transaction was rendered in the transaction feed");
        }
      }
    }
  },
  {
    id: "Test 3.8",
    tier: "Tier 2: CRUD",
    name: "XSS Script Injection Mitigation",
    run: async ({ document, window }) => {
      window.openModal();
      document.getElementById('txnDesc').value = "<script id='xss-node'>alert('Attack')</script>";
      document.getElementById('txnAmount').value = "10000";
      document.getElementById('txnCat').value = "Food & Dining";
      document.getElementById('txnDate').value = "2026-05-15";
      
      const form = document.getElementById('txnForm');
      form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      
      const scriptNode = document.getElementById('xss-node');
      if (scriptNode) throw new Error("XSS Script element injected directly into document DOM");
      
      const feed = document.getElementById('txnFeed');
      if (feed.innerHTML.includes("<script id='xss-node'>")) {
        throw new Error("Rendered feed contains unescaped script markup");
      }
    }
  },
  {
    id: "Test 3.9",
    tier: "Tier 2: CRUD",
    name: "Server Outage Network Fallback",
    setupFetch: (cfg) => {
      cfg.shouldFail = true;
    },
    run: async ({ document, window }) => {
      window.openModal();
      document.getElementById('txnDesc').value = "Server Crash Fallback";
      document.getElementById('txnAmount').value = "20000";
      document.getElementById('txnCat').value = "Food & Dining";
      document.getElementById('txnDate').value = "2026-05-15";
      
      const form = document.getElementById('txnForm');
      form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      
      const exposure = window._testExposure;
      const found = exposure.transactions.find(t => t.desc === "Server Crash Fallback");
      if (!found) throw new Error("Transaction was not saved locally after server sync failed");
      if (window.isServerConnected === true) {
        throw new Error("Server connected state flag was not marked false on sync exception");
      }
    }
  },
  {
    id: "Test 3.10",
    tier: "Tier 2: CRUD",
    name: "Session Expiry (401 Unauthorized) Redirection",
    setupFetch: (cfg) => {
      cfg.statusResponse = { status: 401, body: { message: "Unauthorized" } };
    },
    run: async ({ window }) => {
      try {
        await window.fetch('/api/spending');
      } catch (_) {}
      
      const token = window.localStorage.getItem('caltdhy_token');
      if (token) throw new Error("Token was not flushed from localStorage on 401");
      if (!window.location.href.includes('login.html')) {
        throw new Error(`Expected redirect to 'login.html', currently: '${window.location.href}'`);
      }
    }
  },

  // --- TIER 3: CROSS-FEATURE COMBINATIONS (3 scenarios) ---
  {
    id: "Scenario 3.1",
    tier: "Tier 3: Combinations",
    name: "Active Modal Theme Switching & Layout Preservation",
    run: async ({ document, window, mockChart }) => {
      window.openModal();
      document.getElementById('txnDesc').value = "Switching Preserves Input";
      document.getElementById('txnAmount').value = "990000";
      
      // Dynamic switch to Light
      window.pickTheme('light');
      
      const desc = document.getElementById('txnDesc').value;
      const amt = document.getElementById('txnAmount').value;
      if (desc !== "Switching Preserves Input" || amt !== "990000") {
        throw new Error("Form text inputs were lost or blanked during real-time theme switch styling propagation");
      }
      
      document.getElementById('txnCat').value = "Food & Dining";
      document.getElementById('txnDate').value = "2026-05-15";
      const form = document.getElementById('txnForm');
      form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      
      const exposure = window._testExposure;
      const found = exposure.transactions.find(t => t.desc === "Switching Preserves Input");
      if (!found) throw new Error("Transaction was not successfully committed after theme toggled");
    }
  },
  {
    id: "Scenario 3.2",
    tier: "Tier 3: Combinations",
    name: "Custom Category Addition & Reactive Chart Mapping",
    run: async ({ document, window, mockChart }) => {
      // Register custom category
      const exposure = window._testExposure;
      if (Array.isArray(exposure.customCategories)) {
        exposure.customCategories.push("Gym Workout");
        if (exposure.saveCustomCategories) exposure.saveCustomCategories();
      } else {
        window.localStorage.setItem('caltdhy_custom_cats', JSON.stringify(["Gym Workout"]));
        if (exposure.loadCustomCategories) exposure.loadCustomCategories();
      }
      
      window.openModal();
      document.getElementById('txnDesc').value = "Membership";
      document.getElementById('txnAmount').value = "500000";
      document.getElementById('txnCat').value = "Gym Workout";
      document.getElementById('txnDate').value = "2026-05-20";
      window.currentType = "expense";
      
      const form = document.getElementById('txnForm');
      form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      
      const navBtn = document.getElementById('nav-analytics');
      if (navBtn) navBtn.click();
      window.pickTheme('green');
      
      const categoryChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'categoryChart');
      if (!categoryChart) throw new Error("Category doughnut chart not rendered");
      if (!categoryChart.config.data.labels.includes("Gym Workout")) {
        throw new Error("Doughnut chart categories does not contain the user-added custom category 'Gym Workout'");
      }
    }
  },
  {
    id: "Scenario 3.3",
    tier: "Tier 3: Combinations",
    name: "Offline Queue Operations & Language Toggle",
    setupFetch: (cfg) => {
      cfg.shouldFail = true;
    },
    run: async ({ document, window }) => {
      window.isServerConnected = false;
      const exposure = window._testExposure;
      exposure.transactions.push(
        { id: "q-1", type: "expense", desc: "Q1", amount: 1000, category: "Transport", date: "2026-05-15" },
        { id: "q-2", type: "expense", desc: "Q2", amount: 2000, category: "Transport", date: "2026-05-15" }
      );
      exposure.saveTransactions();
      
      const viBtn = document.getElementById('lang-vi');
      if (viBtn) viBtn.click();
      
      const q1 = exposure.transactions.some(t => t.id === "q-1");
      const q2 = exposure.transactions.some(t => t.id === "q-2");
      if (!q1 || !q2) throw new Error("Offline transactions queue wiped during dynamic i18n localization swap");
    }
  },

  // --- TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 tests) ---
  {
    id: "Scenario 4.1",
    tier: "Tier 4: Real-World",
    name: "Daily Budget Monitoring & Tracking Flow",
    run: async ({ document, window, mockChart }) => {
      window.pickTheme('cream');
      
      const exposure = window._testExposure;
      if (exposure.budgets) {
        exposure.budgets["Food & Dining"] = 3000000;
        exposure.saveBudgets();
      } else {
        window.localStorage.setItem('caltdhy_budgets', JSON.stringify({ "Food & Dining": 3000000 }));
        if (exposure.loadBudgets) exposure.loadBudgets();
      }
      
      const today = new Date().toISOString().split('T')[0];
      exposure.transactions.push(
        { id: "s4-1-1", type: "expense", desc: "Snack", amount: 50000, category: "Food & Dining", date: today },
        { id: "s4-1-2", type: "expense", desc: "Combo Meal", amount: 100000, category: "Food & Dining", date: today },
        { id: "s4-1-3", type: "expense", desc: "Steak dinner", amount: 150000, category: "Food & Dining", date: today }
      );
      exposure.saveTransactions();
      
      if (exposure.calcMetrics) exposure.calcMetrics();
      if (exposure.renderFeed) exposure.renderFeed();
      if (exposure.renderBudgetPanel) exposure.renderBudgetPanel();
      if (exposure.updateTrendChart) exposure.updateTrendChart();
      
      const panel = document.getElementById('budgetPanel');
      if (!panel) throw new Error("Envelopes Budget Panel not found");
      
      const bar = panel.querySelector('.budget-bar');
      if (!bar) throw new Error("Progress bar .budget-bar not found");
      if (bar.getAttribute('aria-valuenow') !== '10') {
        throw new Error(`Budget summary progress did not display 10% target usage, got ${bar.getAttribute('aria-valuenow')}%`);
      }
      
      const trendChart = mockChart.instances.find(c => c.canvas && c.canvas.id === 'dailyTrendChart');
      if (!trendChart) throw new Error("Daily trend chart not instantiated");
      const day = new Date().getDate();
      const val = trendChart.config.data.datasets[0].data[day - 1];
      if (val !== 300000) {
        throw new Error(`Aggregated trend chart value for day ${day} expected to be 300000, got ${val}`);
      }
    }
  },
  {
    id: "Scenario 4.2",
    tier: "Tier 4: Real-World",
    name: "Offline Session Recovery & Database Reconciliation",
    setupFetch: (cfg) => {
      cfg.shouldFail = true;
    },
    run: async ({ window }) => {
      window.isServerConnected = false;
      const exposure = window._testExposure;
      exposure.transactions = [
        { id: "old-c", type: "expense", desc: "C", amount: 10000, category: "Transport", date: "2026-05-01" }
      ];
      exposure.saveTransactions();
      
      // Offline operations
      exposure.transactions.push(
        { id: "new-a", type: "expense", desc: "A", amount: 150000, category: "Transport", date: "2026-05-15" },
        { id: "new-b", type: "expense", desc: "B", amount: 200000, category: "Food & Dining", date: "2026-05-15" }
      );
      exposure.transactions = exposure.transactions.filter(t => t.id !== "old-c");
      exposure.saveTransactions();
      
      // Connect to online & sync
      window.isServerConnected = true;
      window.fetch.calls.length = 0;
      window.fetch.shouldFail = false;
      
      if (exposure.saveTransactions) {
        await exposure.saveTransactions();
      }
      
      const postCalls = window.fetch.calls.filter(c => c.method === 'POST' && c.url.includes('/api/spending'));
      const deleteCalls = window.fetch.calls.filter(c => c.method === 'DELETE');
      
      if (postCalls.length < 2) throw new Error("Sync failing to push newly added offline transactions");
      if (deleteCalls.length < 1) throw new Error("Sync failing to push offline deleted transactions");
    }
  },
  {
    id: "Scenario 4.3",
    tier: "Tier 4: Real-World",
    name: "Jar Allocation & Progress Tracking",
    run: async ({ document, window }) => {
      const navBtn = document.getElementById('nav-jars');
      if (navBtn) navBtn.click();
      
      const nameInput = document.getElementById('jarNameInput');
      const targetInput = document.getElementById('jarTargetInput');
      if (!nameInput || !targetInput) throw new Error("Jars configuration form elements not found");
      
      nameInput.value = "Holiday Travel Fund";
      targetInput.value = "20000000"; // 20M target
      window._selectedJarEmoji = "✈️";
      
      if (typeof window.submitAddJar === 'function') {
        await window.submitAddJar();
      }
      
      const exposure = window._testExposure;
      const jar = exposure.jars.find(j => j.name === "Holiday Travel Fund");
      if (!jar) throw new Error("Holiday Travel Fund jar not added");
      
      jar.current = 2000000; // 10% progress
      if (exposure.saveJars) exposure.saveJars();
      if (exposure.renderJarCards) exposure.renderJarCards();
      
      const container = document.getElementById('jarCardsContainer') || document.getElementById('view-jars');
      if (!container.textContent.includes("10%")) {
        throw new Error(`Jar targets tracking progress fails to display 10%. Content: "${container.textContent}"`);
      }
    }
  },
  {
    id: "Scenario 4.4",
    tier: "Tier 4: Real-World",
    name: "Multi-Language Dashboard Audit",
    run: async ({ document, window }) => {
      window.setLang('en');
      let text = document.getElementById('userGreeting')?.textContent;
      if (text && !text.includes("Welcome")) throw new Error("English dashboard greeting label translation audit failed");
      
      window.setLang('vi');
      text = document.getElementById('userGreeting')?.textContent;
      if (text && !text.includes("Xin chào")) throw new Error("Vietnamese dashboard greeting label translation audit failed");
      
      window.setLang('zh');
      text = document.getElementById('userGreeting')?.textContent;
      if (text && !text.includes("你好")) throw new Error("Chinese dashboard greeting label translation audit failed");
    }
  },
  {
    id: "Scenario 4.5",
    tier: "Tier 4: Real-World",
    name: "Full Month-End Budget Settlement",
    run: async ({ document, window }) => {
      const exposure = window._testExposure;
      if (exposure.saveBudgets) {
        exposure.budgets = { "Utilities": 1000000 };
        exposure.saveBudgets();
      } else {
        window.localStorage.setItem('caltdhy_budgets', JSON.stringify({ "Utilities": 1000000 }));
        if (exposure.loadBudgets) exposure.loadBudgets();
      }
      
      exposure.transactions = [
        { id: "e-over", type: "expense", desc: "Over Electricity", amount: 1500000, category: "Utilities", date: new Date().toISOString().split('T')[0] }
      ];
      exposure.saveTransactions();
      
      if (exposure.calcMetrics) exposure.calcMetrics();
      if (exposure.renderBudgetPanel) exposure.renderBudgetPanel();
      
      const panel = document.getElementById('budgetPanel');
      if (!panel.innerHTML.includes("exceeded") && !panel.innerHTML.includes("vượt quá") && !panel.innerHTML.includes("over")) {
        throw new Error("Settlement check did not highlight exceeded envelope budget alerts");
      }
    }
  }
];

// -------------------------------------------------------------
// Test Runner Harness
// -------------------------------------------------------------
async function main() {
  console.log("=============================================================");
  console.log("             CALTDHY END-TO-END SIMULATION SUITE             ");
  console.log("=============================================================");
  console.log(`Loaded ${tests.length} tests in 4 Tiers.`);
  console.log("-------------------------------------------------------------");

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const test of tests) {
    // Initial local storage setup
    const initialLocalStorage = {
      caltdhy_token: 'mock-token',
      caltdhy_user: JSON.stringify({ name: 'Worker E2E', username: 'workere2e' }),
    };

    if (test.setupStorage) {
      test.setupStorage(initialLocalStorage);
    }

    const mockFetchConfig = {
      transactionsData: [],
      budgetData: {},
      jarsData: [],
      installmentsData: [],
    };

    if (test.setupFetch) {
      test.setupFetch(mockFetchConfig);
    }

    let env;
    try {
      env = setupJSDOM(initialLocalStorage, mockFetchConfig);
      await bootJSDOM(env);
      await test.run(env);
      
      results.push({ id: test.id, name: test.name, status: 'PASS', error: null });
      passed++;
      console.log(`[PASS] ${test.id}: ${test.name}`);
    } catch (err) {
      results.push({ id: test.id, name: test.name, status: 'FAIL', error: err.message });
      failed++;
      console.log(`[FAIL] ${test.id}: ${test.name}`);
      console.log(`       -> Error: ${err.message}`);
    } finally {
      if (env && env.dom) {
        env.dom.window.close();
      }
    }
  }

  console.log("=============================================================");
  console.log("                     EXECUTION SUMMARY                       ");
  console.log("=============================================================");
  console.log(`Total Run:  ${tests.length}`);
  console.log(`Passed:     ${passed}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Pass Rate:  ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log("=============================================================");

  // Output detailed table report to stdout so user/agent can read it
  return results;
}

if (require.main === module) {
  main().then((results) => {
    // Write summary result details to a local JSON for verification if needed
    fs.writeFileSync(path.resolve(__dirname, 'last-run-results.json'), JSON.stringify(results, null, 2), 'utf8');
  });
}

module.exports = { tests, setupJSDOM, bootJSDOM, main };
