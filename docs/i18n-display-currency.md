# Internationalization and display currency

## Invariants

- VND remains the only internal/base currency.
- Transaction, Wallet, Jar and Budget values remain integer VND amounts.
- No database field, migration or historical conversion is introduced.
- USD conversion happens only inside the presentation formatter. API payloads,
  persistence, balances, limits and financial calculations continue to use VND.

## Locales

The interface supports `vi`, `en` and `zh-CN`. The saved preference is sent as
`Accept-Language` so API messages use the same locale. Date, number, percentage
and currency output is centralized in `src/utils/formatters.js`.

## USD display rate

The repository did not contain a trustworthy exchange-rate provider. Therefore
USD display stays disabled unless deployment supplies all three values:

```env
VITE_VND_PER_USD=<positive number>
VITE_FX_SOURCE=<provider or publication name>
VITE_FX_AS_OF=<ISO date or timestamp>
```

A numeric rate without source and as-of metadata is rejected. The UI falls back
to VND and does not guess or hard-code a rate. This opt-in build-time snapshot
does not refresh automatically; deployment must maintain its freshness.

For production, prefer a backend-owned rate endpoint with provider attribution,
an `asOf` timestamp, caching, staleness limits and a last-known-good policy. The
frontend should consume that validated snapshot only for formatting. It must
never rewrite stored amounts or participate in financial calculations.

## Audit notes

- The JSX text/attribute audit found no untranslated static Vietnamese UI labels.
  Existing large views still contain Vietnamese source literals; the compatibility
  catalog translates those text nodes and accessible attributes at render time.
  Moving every legacy view to direct semantic keys remains a maintainability task,
  not a change to stored financial data.
- The remaining untranslated Vietnamese string literals in frontend source are
  classifier keywords in icon, category and brand detection, not rendered copy.
- `VND` on money-entry fields, VND CSV headers and API validation text is
  intentional: entered/exported amounts are still base-currency VND. The
  `vi-VN` locale mapping and backend VND formatter are intentional; the
  backend `en-CA` date string produces an internal calendar key, not UI copy.
- App-generated Vietnamese descriptions already persisted in transaction or jar
  history are translated only when recognized at the display boundary. User-written
  names, categories and notes are never rewritten or translated automatically.
- CSS pseudo-element labels now use attributes rather than embedded language text.

## Files changed in this implementation

This workspace has no Git metadata, so this is the implementation file inventory,
excluding generated build output.

- Configuration and report: `package.json`, `frontEnd-react/.env.example`,
  `docs/i18n-display-currency.md`.
- Localization and display formatting: `frontEnd-react/src/i18n/translations.js`,
  `frontEnd-react/src/i18n/legacyTranslations.js`,
  `frontEnd-react/src/i18n/legacyAdditionalTranslations.js`,
  `frontEnd-react/src/i18n/LocalizationObserver.jsx`,
  `frontEnd-react/src/i18n/useTranslation.js`,
  `frontEnd-react/src/stores/useLangStore.js`,
  `frontEnd-react/src/stores/useCurrencyStore.js`,
  `frontEnd-react/src/utils/exchangeRate.js`,
  `frontEnd-react/src/utils/formatters.js`.
- Shell, navigation and services: `frontEnd-react/src/App.jsx`,
  `frontEnd-react/src/navigation/spendingRoutes.js`,
  `frontEnd-react/src/components/layout/AppShellSkeleton.jsx`,
  `frontEnd-react/src/components/layout/MobileNavigation.jsx`,
  `frontEnd-react/src/components/layout/SidebarNav.jsx`,
  `frontEnd-react/src/components/layout/SpendingRouteSync.jsx`,
  `frontEnd-react/src/components/layout/Topbar.jsx`,
  `frontEnd-react/src/components/auth/ProtectedRoute.jsx`,
  `frontEnd-react/src/services/api.js`,
  `frontEnd-react/src/services/sessionRuntime.js`.
- Shared UI: `frontEnd-react/src/components/ui/AppUtilities.jsx`,
  `frontEnd-react/src/components/ui/ConfirmDialog.jsx`,
  `frontEnd-react/src/components/ui/EmptyState.jsx`,
  `frontEnd-react/src/components/ui/ErrorBoundary.jsx`,
  `frontEnd-react/src/components/ui/FloatingInput.jsx`,
  `frontEnd-react/src/components/ui/MoneyDisplayGuard.jsx`,
  `frontEnd-react/src/components/ui/PageSkeleton.jsx`,
  `frontEnd-react/src/components/ui/ToastRegion.jsx`,
  `frontEnd-react/src/stores/useConfirmStore.js`.
- Pages: `frontEnd-react/src/pages/LandingPage.jsx`,
  `frontEnd-react/src/pages/LoginPage.jsx`,
  `frontEnd-react/src/pages/SignupPage.jsx`,
  `frontEnd-react/src/pages/ResetPasswordPage.jsx`,
  `frontEnd-react/src/pages/VerifyEmailPage.jsx`,
  `frontEnd-react/src/pages/SpendingPage.jsx`.
- Features: `frontEnd-react/src/features/account/AccountModal.jsx`,
  `frontEnd-react/src/features/analytics/AnalyticsView.jsx`,
  `frontEnd-react/src/features/guide/ContextualSectionGuide.jsx`,
  `frontEnd-react/src/features/home/AttentionPanel.jsx`,
  `frontEnd-react/src/features/home/AvailableToSpendCard.jsx`,
  `frontEnd-react/src/features/home/HomeView.jsx`,
  `frontEnd-react/src/features/home/RecentTransactions.jsx`,
  `frontEnd-react/src/features/transactions/TransactionModal.jsx`,
  `frontEnd-react/src/features/jars/FinancialTipsModal.jsx`,
  `frontEnd-react/src/features/jars/JarModal.jsx`,
  `frontEnd-react/src/features/jars/JarTransactionModal.jsx`,
  `frontEnd-react/src/features/jars/JarsView.jsx`,
  `frontEnd-react/src/features/plan/ArchiveWalletModal.jsx`,
  `frontEnd-react/src/features/plan/BudgetEditModal.jsx`,
  `frontEnd-react/src/features/plan/PlanOverviewTab.jsx`,
  `frontEnd-react/src/features/plan/RecurringModal.jsx`,
  `frontEnd-react/src/features/plan/RecurringTab.jsx`,
  `frontEnd-react/src/features/plan/TransferModal.jsx`,
  `frontEnd-react/src/features/plan/WalletModal.jsx`,
  `frontEnd-react/src/features/plan/WalletsTab.jsx`.
- Styling: `frontEnd-react/src/assets/css/account.css`,
  `frontEnd-react/src/assets/css/components.css`,
  `frontEnd-react/src/assets/css/layout.css`.
- API and tests: `backEnd/server/server.js`,
  `backEnd/server/routes/wallets.js`, `backEnd/server/utils/i18n.js`,
  `backEnd/server/tests/i18n.test.js`,
  `frontEnd-react/tests/i18n-formatters.test.mjs`,
  `frontEnd-react/tests/money-precision.test.mjs`,
  `tests/browser-security.cjs`.
