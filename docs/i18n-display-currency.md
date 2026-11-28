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

The backend owns a reference USD→VND snapshot and serves it at
`GET /api/fx/usd` as `{ success, vndPerUsd, source, sourceUrl, asOf }`.

- Provider: [ExchangeRate-API](https://www.exchangerate-api.com) open access
  endpoint `https://open.er-api.com/v6/latest/USD` (no API key, updated once a
  day). Its terms require attribution, so the Settings note links the source.
- The latest valid snapshot is stored in Mongo (`exchangerates` collection, one
  document `pair: "USD_VND"`) and in memory. It is refreshed lazily on request at
  most once per 24 hours; after a failed attempt the server waits an hour before
  asking again. A 5 second timeout applies and the startup warm-up never blocks
  the server.
- Payloads are validated (`result: success`, `base_code: USD`, numeric VND rate
  between 1,000 and 1,000,000, publish time not in the future). Anything else is
  discarded and the last known good snapshot is served. With no snapshot at all
  the endpoint answers `503 FX_UNAVAILABLE`.

Backend overrides (optional; nothing needs to be set on Render):

```env
FX_AUTO_REFRESH=false          # never call the provider; serve the stored copy or 503
FX_VND_PER_USD=<number>        # all three together: a fixed rate, no provider calls
FX_SOURCE=<provider name>
FX_AS_OF=<ISO date or timestamp>
```

The frontend asks for the snapshot when Settings → Language & region opens, or
at start-up when the saved display currency is USD. The last valid snapshot is
remembered in the browser (`caltdhy_fx_usd`) so a reload does not flash VND.
The build-time values below are only a fallback when the server has nothing:

```env
VITE_VND_PER_USD=<positive number>
VITE_FX_SOURCE=<provider or publication name>
VITE_FX_AS_OF=<ISO date or timestamp>
```

Whatever its origin, a snapshot without source and as-of metadata, or published
more than 7 days ago, is not usable: the USD option stays disabled with the
"unavailable" note and amounts display in VND. The saved USD choice is kept and
returns as soon as a fresh rate arrives. The rate is never written into
transactions, balances, budgets or any user data.

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
