# CaltDHy E2E Testing Infrastructure

This document details the testing architecture, feature inventory, mock strategies, directory layout, and E2E scenarios designed for the CaltDHy UI/UX Polish and daily trend chart project.

---

## 1. Feature Inventory

### Feature 1: UI/UX Premium Experience & Theme Support
- **Multi-Theme Engine**: Dynamic switching between four distinct themes (`dark`, `light`, `cream`, `green`). Active selections are persisted in `localStorage` under `caltdhy_theme`.
- **Premium Retro Chassis Grid & Rail Layout**: Responsive side rail menu (`.rail`) toggleable via `.btn-rail-toggle` (calling `toggleRail()`), which applies classes to slide or fold the sidebar.
- **Accessible Controls**: Accessible labels (`aria-label`) and state variables (`aria-pressed`) on theme selection components.
- **Interactive UI Feedback**: Custom `.toast` notification system in `spending.js` with `showToast()`.

### Feature 2: Daily Spending Trend Chart Canvas & Live Updates
- **Canvas Rendering Context**: A target `<canvas id="dailyTrendChart">` inside the `#view-analytics` container.
- **Chart.js Integration**: Uses Chart.js (mocked via `MockChart` spy) to render visual charts.
- **Data Reactive Binding**: Instantly updates on transaction additions/deletions and month selector changes.
- **Theme-Aware Aesthetics**: Synchronizes grid lines, fonts (`JetBrains Mono`), and tooltip styling with the active theme.
- **Empty State Fallback**: Displays `#trendEmpty` or `#chartEmpty` when no transaction logs exist for the active month.

### Feature 3: Transactions CRUD (Offline-First Local Sync)
- **Transaction Ledger Entries**: Allows users to log transaction details (description, amount, income/expense toggle, category, date).
- **Offline Mode Local Fallback**: Persists transactions in `localStorage` under `caltdhy_txns` when server connection is offline.
- **Client Server Sync**: Automatically synchronizes local state with backend endpoints (`GET /api/spending`, `POST /api/spending`, `DELETE /api/spending/:id`) when connection is active.
- **Input Validation**: Rejects zero/negative amounts and future date validations.

---

## 2. Test Runner Architecture

We utilize a JSDOM-based E2E test runner executing programmatically within Node.js, complying fully with the `CODE_ONLY` network constraints.

```
+-------------------------------------------------------+
|                 tests/run-e2e.js                      |
+-------------------------------------------------------+
                           |
                           v  (Reads spending.html and strips tags)
+-------------------------------------------------------+
|                 JSDOM Window Creation                 |
+-------------------------------------------------------+
                           |
                           v  (Injects stubs & Mocks)
+-------------------------------------------------------+
|  Mocks: LocalStorage, Location, fetch, ResizeObserver  |
|  Spies: MockChart (captures all constructor/options)  |
+-------------------------------------------------------+
                           |
                           v  (Evaluates local JS files in order)
+-------------------------------------------------------+
|  theme-manager.js -> focus-trap.js -> spending.js     |
+-------------------------------------------------------+
                           |
                           v  (Appends exposure utility)
+-------------------------------------------------------+
|  Exposes internal variables (transactions, budgets)  |
+-------------------------------------------------------+
                           |
                           v  (Dispatches DOMContentLoaded)
+-------------------------------------------------------+
|  Bootstraps Application & executes E2E Assertions     |
+-------------------------------------------------------+
```

### JSDOM Mocks Setup
1. **LocalStorage**: Directly seeds the native JSDOM localStorage.
2. **Location**: Intercepts `location.href` to handle and verify login redirection behavior on session expiry (401).
3. **Fetch API**: Stubs all backend REST endpoints and provides toggleable network failures/401 payloads to test robustness.
4. **MockChart**: Captures constructor configurations (datasets, fonts, labels, styles) for precise assertions on both the category doughnut chart and the daily trend chart.
5. **Exposure Scope**: A temporary inline script appended to the evaluated JS context to bridge JSDOM lexical variables (`transactions`, `budgets`, `jars`) to the Node runner process.
6. **Virtual Console**: Suppresses noisy navigation error logs from JSDOM when verifying redirect boundaries.

---

## 3. Project Directory Layout

The E2E test suite resides inside the standard project layout as follows:

```
CaltDHy/
├── tests/
│   ├── run-e2e.js               # Main E2E test suite runner & definitions
│   └── last-run-results.json    # JSON output file of the last E2E execution
├── frontEnd/
│   ├── spending.html            # Target user dashboard HTML
│   ├── spending.js              # Application core controller
│   ├── theme-manager.js         # Theme management script
│   └── focus-trap.js            # Accessibility modal focus trapping script
├── TEST_INFRA.md                # E2E Infrastructure specifications (this file)
└── TEST_READY.md                # E2E Test Suite status & execution report
```

---

## 4. E2E Scenario List (38 Test Cases)

### Tier 1: Feature Coverage (15 tests)
- **UI/UX Premium & Theme Support**
  - **Test 1.1**: Default Theme Initialization (checks default theme is dark, moon emoji is set).
  - **Test 1.2**: Switch to Light Theme (clicks light theme button, verifies class and persistence).
  - **Test 1.3**: Switch to Cream Theme (clicks cream theme button, verifies class and persistence).
  - **Test 1.4**: Switch to Green Theme (clicks green theme button, verifies class and persistence).
  - **Test 1.5**: Side Rail Folding Toggle (clicks rail toggle, checks `.rail-collapsed` class on `.app-body`).
- **Daily Spending Trend Chart Canvas & Live Updates**
  - **Test 2.1**: Trend Chart Canvas Presence (verifies `#dailyTrendChart` element exists).
  - **Test 2.2**: Chart Object Instantiation (verifies daily trend chart instance is built).
  - **Test 2.3**: Reactive Chart updates on Transaction Addition (adds transaction, verifies chart `update` is triggered).
  - **Test 2.4**: Reactive Chart updates on Transaction Deletion (removes transaction, verifies chart `update` is triggered).
  - **Test 2.5**: Month Switch Refreshes Chart Scope (changes selected month, verifies chart X-axis days length matches).
- **Transactions CRUD**
  - **Test 3.1**: Load Existing Transactions (verifies seeded transactions render in the feed).
  - **Test 3.2**: Create New Transaction (fills transaction form, submits, verifies listing and local storage).
  - **Test 3.3**: Edit Existing Transaction (verifies edit form popup and transaction updates).
  - **Test 3.4**: Delete Transaction (clicks delete on slot, verifies item removal and balance recalculation).
  - **Test 3.5**: Client Server Sync When Online (verifies fetch POST request matches local entries when online).

### Tier 2: Boundary & Corner Cases (15 tests)
- **UI/UX Boundaries**
  - **Test 1.6**: Corrupted Local Storage Theme Recovery (falls back to dark theme on invalid stored key).
  - **Test 1.7**: Extreme Title/Username Length Ellipsis (ensures layout handles long usernames gracefully).
  - **Test 1.8**: Rapid Successive Theme Clicking (clicking theme cards rapidly does not cause memory leaks or chart crashes).
  - **Test 1.9**: Settings Modal Focus Trap Isolation (Tabbing cycles within modal, Escape key dismisses modal).
  - **Test 1.10**: Localization Missing Key Fallback (returns default text on missing translation dictionary key).
- **Chart Boundaries**
  - **Test 2.6**: Zero Transactions Chart Empty State (displays flat line and empty placeholder when zero transactions logged).
  - **Test 2.7**: Leap Year Date Bounds (February 2028 renders 29 labels; February 2029 renders 28 labels).
  - **Test 2.8**: Aggregation of Multi-Transaction Single Day (aggregates multiple transactions on same day to one data point).
  - **Test 2.9**: Extreme Trillion VND Financial Scale (verifies chart handles hyperinflation values without numeric overflow).
  - **Test 2.10**: Styling Contrast Update on Theme Swap (updates grid lines and tick colors before updating the chart).
- **CRUD Boundaries**
  - **Test 3.6**: Non-Positive Amount Rejection (rejects zero or negative transaction values).
  - **Test 3.7**: Future Date Bounds Rejection (rejects or filters future transaction dates).
  - **Test 3.8**: XSS Script Injection Mitigation (escapes HTML tags in transaction description to prevent XSS).
  - **Test 3.9**: Server Outage Network Fallback (saves data in localStorage and warns user of offline state when fetch fails).
  - **Test 3.10**: Session Expiry (401 Unauthorized) Redirection (clears auth token and redirects to `login.html`).

### Tier 3: Cross-Feature Combinations (3 scenarios)
- **Scenario 3.1**: Active Modal Theme Switching & Layout Preservation (switching theme while transaction form is open preserves text inputs and commits successfully under light theme palette).
- **Scenario 3.2**: Custom Category Addition & Reactive Chart Mapping (adding a custom category dynamically reflects it on the doughnut category breakdown and trend chart).
- **Scenario 3.3**: Offline Queue Operations & Language Toggle (performing offline additions/deletions and switching language preserves the pending transactions and updates interface labels correctly).

### Tier 4: Real-World Application Scenarios (5 scenarios)
- **Scenario 4.1**: Daily Budget Monitoring & Tracking Flow (sets monthly budget to 3M VND, logs 3 food expenses totaling 300k VND, verifies budget panel progress is 10% and trend chart aggregates day total to 300k VND).
- **Scenario 4.2**: Offline Session Recovery & Database Reconciliation (logs additions/deletions offline, recovers connection, triggers sync syncs additions with POST and deletions with DELETE).
- **Scenario 4.3**: Jar Allocation & Progress Tracking (creates savings jar, logs deposits, and verifies jar progress indicators show correct percentages).
- **Scenario 4.4**: Multi-Language Dashboard Audit (cycles dashboard between English, Vietnamese, and Chinese, verifying headings and currency labels translate cleanly).
- **Scenario 4.5**: Full Month-End Budget Settlement (sets limits, logs transactions exceeding category bounds, verifies exceeded envelope alert banners display).

---

## 5. Execution Protocol

To run the automated E2E simulation suite, execute:

```bash
node tests/run-e2e.js
```

### Interpreting Results
- **Passed tests** print a `[PASS]` indicator.
- **Expected failures** print a `[FAIL]` indicator detailing the exact assertion error (e.g., dailyTrendChart elements or premium theme cards missing). This is expected because the implementation track has not yet merged these features into `spending.html` and `spending.js`.
- The runner completes with an execution summary showing the total test count, pass/fail counts, and the pass rate.
