# CaltDHy E2E Testing Strategy & Test Case Specifications

## 1. Core User-Facing Features Analysis
Based on the codebase analysis of `spending.html`, `spending.js`, `theme-manager.js`, and `local-api.js`, the core user-facing features are identified as follows:

### Feature 1: UI/UX Premium Experience & Theme Support
- **Multi-Theme Engine**: Dynamic switching between four distinct themes (`dark`, `light`, `cream`, `green`). 
  - The default `dark` theme applies styling via default root variables.
  - Other themes add class overrides to `<html>` (e.g. `light-theme`, `cream-theme`, `green-theme`).
  - Active theme selections are persisted in `localStorage` under `caltdhy_theme`.
  - Setting changes are propagated globally to all sub-components including modal windows and charts.
- **Premium Retro Chassis Grid & Rail Layout**: Responsive side rail menu (`.rail`) toggleable via `.btn-rail-toggle` (calling `toggleRail()`), which applies classes to slide or fold the sidebar.
- **Accessible & Internationalized Controls**: Theme card button components feature accessible labels (`aria-label`) and state variables (`aria-pressed`). Multi-language configuration (`caltdhy_lang`) for English, Vietnamese, and Chinese.
- **Interactive UI Feedback**: Instant visual updates through toasts (custom `.toast` notification system in `spending.js` with `showToast()`), active tab highlight classes (`active`), and animated hover feedback.

### Feature 2: Daily Spending Trend Chart Canvas & Live Updates
- **Canvas Rendering Context**: A target `<canvas id="dailyTrendChart">` inside the `#view-analytics` container.
- **Chart.js Integration**: Uses Chart.js (parsed from the CDN script tag in `spending.html`) to render a visual chart representation.
- **Data Reactive Binding**:
  - The chart updates instantly on transaction additions, edits, or deletions.
  - The chart updates dynamically when the active month selection changes (re-generating labels for days 1 to N of the selected month).
- **Theme-Aware Aesthetics**: Automatically synchronizes grid line colors, font families (e.g. `'JetBrains Mono'`), font colors, and tooltip designs with the currently selected theme.
- **Empty State Fallback**: Displays a placeholder (e.g., "#chartEmpty") or gracefully shows empty graphs when no transaction logs exist for the active month.

### Feature 3: Transactions CRUD (Offline-First Local Sync)
- **Transaction Ledger Entries**: Allows users to log transaction details (description, positive amount, income/expense toggle, category select, date input).
- **Offline Mode Local Fallback**:
  - Automatically loads and persists transactions in `localStorage` under `caltdhy_txns` to provide seamless offline capabilities.
  - When connection is active (`isServerConnected` is true), the client synchronizes local state with backend endpoints (`GET /api/spending`, `POST /api/spending`, `DELETE /api/spending/:id`).
- **Input Validation**: Ensures required fields are filled, amounts are positive numerical values, and dates represent valid inputs.
- **Aggregations & Calculations**: Live-calculates balance, income, expense, and budget limit thresholds, instantly updating metric cards and feeding data into the charts.

---

## 2. E2E Testing Framework Evaluation

### Objective
Determine the optimal method for writing opaque-box End-to-End (E2E) tests given that **`jsdom`** is the only testing dependency declared in `package.json`.

### Option A: JSDOM Simulation Test Runner (Selected)
We load the HTML page inside Node.js using `jsdom`, inject mock scripts, stub browser APIs, and trigger DOM event listeners programmatically.

*   **Pros**:
    *   **Ultra-lightweight & Instant**: Runs entirely in-process in Node.js, completing in milliseconds. No need for GUI environments or browser processes.
    *   **Workspace Compliant**: Requires no internet access or external downloads during test execution, fully aligning with `CODE_ONLY` network constraints.
    *   **Granular Mocking**: Easy to intercept and mock the global `fetch` API and third-party script objects (`Chart.js`) before executing `spending.js`.
*   **Cons**:
    *   **No Layout & Visual Engine**: Cannot test actual element overlapping, pixel alignment, or CSS animation triggers.
    *   **No Native Canvas Context**: The HTML5 Canvas `getContext('2d')` returns `null` inside JSDOM unless compiled native binaries (`canvas` package) are installed. Chart.js visual output cannot be rendered or captured via screenshots.
    *   **CSS Variable Resolution Limitation**: JSDOM's CSS parser does not resolve CSS variables (`var(--bg)`) dynamically through `getComputedStyle()`. We can only verify that class changes were applied (e.g. `classList.contains('light-theme')`), rather than validating that colors changed.

### Option B: Browser-Based E2E Testing (e.g. Playwright, Cypress)
We install a browser testing framework to spin up a headless browser (Chromium/Firefox) that visits the running application served by `local-api.js`.

*   **Pros**:
    *   **True E2E Fidelity**: Validates real browser behavior, layout, responsiveness, focus behavior, and real canvas rendering.
    *   **Visual Regression Testing**: Allows screenshot comparison to verify the premium visual polish.
*   **Cons**:
    *   **Heavyweight & Environment Restrictions**: Requires downloading large browser binaries, which is blocked in a strict `CODE_ONLY` network environment.
    *   **Configuration Overhead**: Requires running the mock API server concurrently in the background and managing browser state cleanup.

### Decision & Recommendation
Given the strict `CODE_ONLY` constraint and the presence of `jsdom` in `package.json`, **Option A (JSDOM Simulation)** is the only viable and highly efficient method to implement immediately. 

#### Recommended JSDOM Test Architecture
The test suite can be constructed as a pure Node.js test script that:
1.  Reads the raw HTML from `frontEnd/spending.html` and creates a `JSDOM` instance.
2.  Supplements the JSDOM `window` global scope with stubs for `localStorage` and `fetch`.
3.  Injects a **Mock Chart class** into `window.Chart` before loading `spending.js`. This mock class records all constructor arguments so tests can verify that datasets, styling, and label dates match our expectations.
4.  Simulates user interactions by querying elements and dispatching events (e.g., `button.click()`, `input.value = ...`).

#### Code Pattern for JSDOM Mocks Setup
```javascript
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 1. Load HTML
const html = fs.readFileSync(path.resolve(__dirname, '../../frontEnd/spending.html'), 'utf8');

// 2. Setup mock local storage
const mockLocalStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

// 3. Setup mock Chart.js
class MockChart {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    MockChart.instances.push(this);
  }
  update() { MockChart.updates.push(this.config); }
  destroy() { MockChart.destroyed.push(this); }
}
MockChart.instances = [];
MockChart.updates = [];
MockChart.destroyed = [];

// 4. Initialize JSDOM
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost:8080/spending.html"
});

const { window } = dom;

// Inject stubs into DOM window
window.localStorage = mockLocalStorage;
window.Chart = MockChart;
window.fetch = async (url, options) => {
  // Return stubbed responses based on route
  if (url.includes('/api/spending/budget')) {
    return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
  }
  if (url.includes('/api/spending')) {
    return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
  }
  // Fallback
  return { ok: false, status: 404 };
};
```

---

## 3. Four-Tier Test Suite Specification

### Tier 1: Feature Coverage (>=5 test cases per feature)

#### Feature 1: UI/UX Premium Experience & Theme Support
1.  **Test Case 1.1: Default Theme Initialization**
    *   *Description*: Verify that the system loads the default `dark` theme when no theme is cached in `localStorage`.
    *   *Asserts*: `document.documentElement.className` contains no theme override classes (or contains `dark-theme`), and the theme icon element displays the Moon symbol `🌙`.
2.  **Test Case 1.2: Switch to Light Theme**
    *   *Description*: Select the "Light" theme card in settings and verify style propagation.
    *   *Asserts*: `document.documentElement.className` includes `light-theme`, and `localStorage.getItem('caltdhy_theme')` equals `'light'`.
3.  **Test Case 1.3: Switch to Cream Theme**
    *   *Description*: Select the "Cream" theme card in settings and verify style propagation.
    *   *Asserts*: `document.documentElement.className` includes `cream-theme`, and `localStorage.getItem('caltdhy_theme')` equals `'cream'`.
4.  **Test Case 1.4: Switch to Green Theme**
    *   *Description*: Select the "Green" theme card in settings and verify style propagation.
    *   *Asserts*: `document.documentElement.className` includes `green-theme`, and `localStorage.getItem('caltdhy_theme')` equals `'green'`.
5.  **Test Case 1.5: Side Rail Folding Toggle**
    *   *Description*: Click the `.btn-rail-toggle` sidebar control button to toggle side navigation.
    *   *Asserts*: The body element or primary layout container contains the rail-collapsed class (e.g. `.rail-collapsed`), reducing sidebar footprint.

#### Feature 2: Daily Spending Trend Chart Canvas & Live Updates
1.  **Test Case 2.1: Trend Chart Canvas Presence**
    *   *Description*: Verify that the canvas element with ID `dailyTrendChart` is correctly integrated inside `#view-analytics`.
    *   *Asserts*: Query selector `#view-analytics canvas#dailyTrendChart` returns a valid DOM element.
2.  **Test Case 2.2: Chart Object Instantiation**
    *   *Description*: Switch view to 'analytics' and verify that Chart.js is invoked to build the daily spending trend.
    *   *Asserts*: A new entry is appended to `MockChart.instances` with `canvas` parameter matching the `dailyTrendChart` element.
3.  **Test Case 2.3: Reactive Chart updates on Transaction Addition**
    *   *Description*: Log a new expense transaction and verify that the chart data increases.
    *   *Asserts*: The instantiated chart's `update()` method is triggered, and the dataset includes the newly added expense amount mapped to the transaction date.
4.  **Test Case 2.4: Reactive Chart updates on Transaction Deletion**
    *   *Description*: Delete an existing expense transaction and verify chart regression.
    *   *Asserts*: The chart's `update()` is triggered, and the dataset reflects the deduction of the deleted transaction.
5.  **Test Case 2.5: Month Switch Refreshes Chart Scope**
    *   *Description*: Select a different month filter in the dashboard UI.
    *   *Asserts*: The trend chart updates its labels to match the exact number of days of the newly selected month, and datasets reload with corresponding data.

#### Feature 3: Transactions CRUD (Offline-First Local Sync)
1.  **Test Case 3.1: Load Existing Transactions**
    *   *Description*: Verify that existing transactions are loaded and listed in the ledger UI on initialization.
    *   *Asserts*: Transaction list contains rows matching the dummy or retrieved transaction array length, displaying correct amount and tags.
2.  **Test Case 3.2: Create New Transaction**
    *   *Description*: Fill in description, select category, input valid amount, click submit.
    *   *Asserts*: Table displays the new item, total balance updates, and transaction persists in `localStorage` under `caltdhy_txns`.
3.  **Test Case 3.3: Edit Existing Transaction**
    *   *Description*: Click edit button on a transaction, change its amount, and click save.
    *   *Asserts*: Row updates in the table, local database reflects the changes, and cumulative balance updates correctly.
4.  **Test Case 3.4: Delete Transaction**
    *   *Description*: Click delete button on a transaction item in the UI.
    *   *Asserts*: Row is removed from the table, transactions array size decreases by 1, and balance updates instantly.
5.  **Test Case 3.5: Client Server Sync When Online**
    *   *Description*: Trigger sync action while server status is mock-connected.
    *   *Asserts*: A `POST` fetch call to `/api/spending` is executed with transaction payloads matching the local additions.

---

### Tier 2: Boundary & Corner Cases (>=5 test cases per feature)

#### Feature 1: UI/UX Premium Experience & Theme Support
1.  **Test Case 1.6: Corrupted Local Storage Theme Recovery**
    *   *Description*: Initialize the page with `localStorage` containing an invalid theme identifier (e.g. `'malicious-hacked-theme'`).
    *   *Asserts*: The application falls back gracefully to `dark` theme without throwing JavaScript errors or breaking stylesheet rendering.
2.  **Test Case 1.7: Extreme Title/Username Length Ellipsis**
    *   *Description*: Set the user display name to a 200-character long string.
    *   *Asserts*: Layout structure remains stable, and visual container elements do not break out of screen boundaries.
3.  **Test Case 1.8: Rapid Successive Theme Clicking**
    *   *Description*: Click the theme toggler or theme cards repeatedly in sub-millisecond intervals.
    *   *Asserts*: No canvas rendering loops or memory leaks occur. Chart instance destruction resolves correctly.
4.  **Test Case 1.9: Settings Modal Focus Trap Isolation**
    *   *Description*: Open settings modal, press Tab repeatedly.
    *   *Asserts*: Focus stays contained within the active modal panel boundaries (cannot tab to background elements). Pressing `Escape` closes the modal.
5.  **Test Case 1.10: Localization Missing Key Fallback**
    *   *Description*: Switch active language to Vietnamese/Chinese when certain labels do not have matching translation key records.
    *   *Asserts*: The UI renders the default English fallback text or the raw key string instead of crashing or showing `undefined`.

#### Feature 2: Daily Spending Trend Chart Canvas & Live Updates
1.  **Test Case 2.6: Zero Transactions Chart Empty State**
    *   *Description*: Load the analytics screen for a month that contains zero records.
    *   *Asserts*: The trend chart shows a flat line/bar structure (all zeroes) and does not throw NaN or arithmetic errors. The empty state placeholder (e.g. `chartEmpty`) is displayed.
2.  **Test Case 2.7: Leap Year Date Bounds**
    *   *Description*: Load the trend chart for February 2028 (leap year) vs February 2029 (non-leap year).
    *   *Asserts*: For February 2028, the chart renders exactly 29 day intervals on the X-axis. For February 2029, the chart renders exactly 28 day intervals.
3.  **Test Case 2.8: Aggregation of Multi-Transaction Single Day**
    *   *Description*: Record 5 separate transactions on the 15th of the current month.
    *   *Asserts*: The daily trend chart represents only one data point for Day 15, showing the sum total of all 5 transaction amounts combined.
4.  **Test Case 2.9: Extreme Trillion VND Financial Scale**
    *   *Description*: Add a transaction with an amount of `999,999,999,999,999` (simulating extreme VND hyperinflation testing).
    *   *Asserts*: Chart.js scales values correctly on the Y-axis without numeric overflow, and axis tick labels formatting accommodates long string values.
5.  **Test Case 2.10: Styling Contrast Update on Theme Swap**
    *   *Description*: Instantly change theme from Dark to Light while looking at the Analytics view.
    *   *Asserts*: Chart configuration options (`scales.x.ticks.color`, `scales.y.grid.color`, etc.) are updated to match light theme tokens before calling `chart.update()`.

#### Feature 3: Transactions CRUD (Offline-First Local Sync)
1.  **Test Case 3.6: Non-Positive Amount Rejection**
    *   *Description*: Attempt to save a transaction with negative value (-500,000) or zero (0).
    *   *Asserts*: Validation prevents form submission, shows input error highlights, and no transaction is added to local storage.
2.  **Test Case 3.7: Future Date Bounds Rejection**
    *   *Description*: Submit a transaction with a date set in the far future (e.g. year 2099).
    *   *Asserts*: Input validation throws error or filters it from affecting active statistics.
3.  **Test Case 3.8: XSS Script Injection Mitigation**
    *   *Description*: Input `<script>alert('xss')</script>` inside the transaction description field and save.
    *   *Asserts*: The transaction list displays the tag safely as plain text (escaped innerText), and no script execution occurs.
4.  **Test Case 3.9: Server Outage Network Fallback**
    *   *Description*: Trigger saving a transaction when `window.fetch` fails (simulating server crash/500/offline).
    *   *Asserts*: Application catches the error, updates `isServerConnected = false`, saves the data locally in `localStorage`, and displays a toast notifying the user that data is saved locally.
5.  **Test Case 3.10: Session Expiry (401 Unauthorized) Redirection**
    *   *Description*: Mock server responding with HTTP status `401 Unauthorized` during API fetch.
    *   *Asserts*: Client deletes `caltdhy_token` from `localStorage` and redirects user to `login.html`.

---

### Tier 3: Cross-Feature Combinations

#### Scenario 3.1: Active Modal Theme Switching & Layout Preservation
-   *Action Sequence*:
    1. Open the "Add Transaction" modal form.
    2. Open settings and toggle theme from Dark to Light.
    3. Input transaction details in the open modal and click Save.
-   *Expectations*:
    1. The modal background, buttons, and inputs instantly transition styles.
    2. Input fields do not lose their current user-typed text.
    3. The transaction saves successfully, closing the modal.
    4. The daily trend chart updates to include the new transaction under the new Light theme colors.

#### Scenario 3.2: Custom Category Addition & Reactive Chart Mapping
-   *Action Sequence*:
    1. Add a custom category named "Crypto Mining" in settings.
    2. Register a new expense transaction of 10,000,000 VND under the "Crypto Mining" category.
    3. Navigate to the Analytics view.
    4. Change the theme to Green.
-   *Expectations*:
    1. The transaction is recorded correctly with the custom category.
    2. The category breakdown doughnut chart includes a slice for "Crypto Mining" representing the correct proportion.
    3. The daily trend chart displays the 10,000,000 VND expense on the correct date.
    4. Toggling the theme preserves the custom category slices and updates the colors to match the Green theme palette.

#### Scenario 3.3: Offline Queue Operations & Language Toggle
-   *Action Sequence*:
    1. Simulate an offline connection state (block fetch APIs).
    2. Log 3 new transactions and delete 1 existing transaction.
    3. Change language selection from English to Vietnamese.
-   *Expectations*:
    1. UI immediately translates headings, buttons, and tables without reloading the page or wiping local transaction queues.
    2. Local transaction ledger remains updated with the offline operations.
    3. Charts display the correct accumulated offline values under the new Vietnamese locale labels (e.g., "Tháng 7" instead of "July").

---

### Tier 4: Real-World Application Scenarios

#### Scenario 4.1: Daily Budget Monitoring & Tracking Flow
-   *Context*: A user wants to manage their daily diet expenses within a strict monthly budget, choosing the Cream theme for visual comfort.
-   *Flow Steps*:
    1. User logs in. Display name greeting resolves correctly.
    2. User updates theme to Cream. Styles paint correctly.
    3. User sets a monthly budget limit of 3,000,000 VND for "Food".
    4. User logs three transactions on the same day (breakfast: 50,000 VND, lunch: 100,000 VND, dinner: 150,000 VND).
    5. User navigates to the Analytics tab.
-   *E2E Verification Points*:
    1. The theme changes immediately and persists on reload.
    2. The budget progress indicator displays 10% budget used (300,000 / 3,000,000 VND).
    3. The daily trend chart aggregates the three transactions into a single data point of 300,000 VND on the corresponding day.
    4. The category chart displays "Food" at 100% of expenses for that month.
    5. All inputs, text, and scales display clean styling matching the Cream theme palette.

#### Scenario 4.2: Offline Session Recovery & Database Reconciliation
-   *Context*: A user logs transactions on their phone while commuting (offline) and wants the database to reconcile cleanly once internet connectivity is restored at the office.
-   *Flow Steps*:
    1. Simulate app startup with server offline. Load cached local storage data.
    2. Add Transaction A (150,000 VND, Category: Transport).
    3. Add Transaction B (200,000 VND, Category: Coffee).
    4. Delete Transaction C (old record from server stored locally).
    5. Update connection state to online. Trigger sync update.
-   *E2E Verification Points*:
    1. The transactions table, metric cards, and daily trend chart update immediately in offline mode.
    2. When connection is restored, the application executes sync requests:
       - `POST /api/spending` for Transaction A.
       - `POST /api/spending` for Transaction B.
       - `DELETE /api/spending/:id` for Transaction C.
    3. The client receives a success status from the server and marks `isServerConnected` as true.
    4. No duplicate entries or "zombie records" are created, and local storage values align perfectly with the server database.
