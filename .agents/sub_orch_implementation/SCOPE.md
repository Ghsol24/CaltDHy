# Scope: Implementation Track for CaltDHy UI/UX Polish and Analytics

## Architecture
- **Frontend SPA**: `frontEnd/spending.html` and `frontEnd/spending.js`. Styling resides in `frontEnd/css/*`.
- **Backend API**: Node.js server in `local-api.js` using `caltdhy_db.json` as persistent storage.
- **Charting**: Chart.js rendering on `<canvas id="dailyTrendChart">` in `#view-analytics` container.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 2 | UI/UX Assessment & Polish | Clean up & upgrade UI/UX premium feel of `spending.html`, `spending.js`, and related CSS files, keeping the retro frame style but making it smoother/finer. | None | PLANNED |
| 3 | Daily Spending Trend Chart | Implement `dailyTrendChart` in `#view-analytics` using Chart.js, binding data correctly and automatically updating on transactions changes and month changes. | M2 | PLANNED |
| 4 | Final E2E Pass & Hardening | Pass all E2E tests once `TEST_READY.md` is published. Run Phase 2 (Adversarial Coverage Hardening) to audit and fix. | M3 | PLANNED |

## Interface Contracts
### Client ↔ Server API
- `GET /api/load`: Returns db JSON structure.
- `POST /api/save`: Sends db JSON structure to server.

### Client ↔ Chart.js API
- Canvas: `<canvas id="dailyTrendChart"></canvas>` in `#view-analytics` container.
- Class: `Chart` from global window scope.
- Instance name: `dailyTrendChart` (or locally managed but accessible/bound correctly to update cycle).
