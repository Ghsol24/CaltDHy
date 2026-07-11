# Project: CaltDHy UI/UX Polish and Analytics

## Architecture
- **Frontend**: Single-Page Application (SPA) structured around `frontEnd/spending.html` and `frontEnd/spending.js`. Styling is modularized into several CSS files under `frontEnd/css/` (including `layout.css`, `themes.css`, `components.css`, `modals.css`).
- **Backend**: Local Node.js server (`local-api.js`) which serves static assets and reads/writes transactions from/to `caltdhy_db.json`.
- **Analytics & Charting**: Chart.js loaded via a `<script>` tag in `spending.html`. Renders a daily trend chart canvas `dailyTrendChart` inside the analytics view (`#view-analytics`).

## Code Layout
- `frontEnd/spending.html`: Main HTML for the spending tracker UI.
- `frontEnd/spending.js`: Main Javascript containing frontend logic, rendering, API calls, and chart updates.
- `frontEnd/css/`: Folder containing modular CSS stylesheets.
- `caltdhy_db.json`: JSON file serving as the local database.
- `local-api.js`: Static file server & API server for data load/save.
- `verify_ui_charts.js`: Automated UI/UX and JS logic verification script.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Test Suite | Build opaque-box E2E test suite (Tiers 1-4) reflecting requirements | None | PLANNED |
| 2 | UI/UX Assessment & Polish | Clean up layout, improve spacing/padding/colors, and refine retro chassis/frame aesthetics without breaking it | None | PLANNED |
| 3 | Daily Spending Trend Chart | Integrate `dailyTrendChart` in `#view-analytics`, bind data, auto-update on transaction changes/month changes | M2 | PLANNED |
| 4 | Final E2E Pass & Hardening | Pass 100% of E2E tests, run adversarial testing, and get clean Forensic Audit verdict | M1, M3 | PLANNED |

## Interface Contracts
### Client ↔ Server API
- **Load Database**: `GET /api/load`
  - Response: `{ transactions: Array, budgets: Object, customCategories: Array }`
- **Save Database**: `POST /api/save`
  - Request: JSON body of the updated database structure.
  - Response: `{ success: true }` or `{ success: false, error: String }`

### Client ↔ Chart.js API
- Canvas: `<canvas id="dailyTrendChart"></canvas>` inside `<div id="view-analytics">`
- Chart Object: Instantiated in `spending.js` as `dailyTrendChart` using `new Chart()`.
- Updating logic: Triggers on `renderAnalytics()`, updates labels (days 1 to N of month) and datasets (total expense for each day).
