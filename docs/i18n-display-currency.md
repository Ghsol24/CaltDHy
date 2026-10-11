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
