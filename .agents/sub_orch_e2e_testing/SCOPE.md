# Scope: E2E Testing Track

## Architecture
- **Test Platform**: Node.js + `jsdom` (since it is the only dependency in `package.json`).
- **Target page**: `frontEnd/spending.html` loaded as a DOM instance.
- **Mocks**:
  - Global `window.fetch` stubbed to return JSON responses for backend API endpoints.
  - Global `window.Chart` mocked with a spy constructor to record constructor configurations and method calls.
  - Global `window.localStorage` stubbed to verify state persistence.
- **Test execution**: Programmatic event dispatch (clicks, form inputs) to simulate user actions, followed by DOM assertions and mock checks.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Test Plan & Design | Analyze requirements, design 4-tier test specs, and write analysis.md | None | DONE |
| 2 | Test Runner & Infrastructure | Implement test harness/runner using JSDOM + mocks, write TEST_INFRA.md | M1 | PLANNED |
| 3 | Test Case Implementation | Implement Tiers 1, 2, 3, and 4 test cases | M2 | PLANNED |
| 4 | Verification & Handoff | Verify the test suite runs correctly, output TEST_READY.md, and write handoff.md | M3 | PLANNED |

## Interface Contracts
### E2E Test Runner Interface
- Command: `npm test` or `node tests/run-e2e.js`
- Test Output: Console log detailing passed and failed tests, followed by an exit code (0 if all passed, non-zero if any failed).
- Reports: Creates `TEST_READY.md` containing the E2E Test Suite status.
