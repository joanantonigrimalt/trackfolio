# Finasset - Real Data Plan

## Non-negotiable rule

- No fake series in production.
- If an asset has no verified real quote/history source, the UI must show `Sin histÃ³rico disponible`.

## Current conclusion

Financial Modeling Prep is not enough for Grigom's real portfolio:

- US stocks like AAPL work.
- European UCITS ETFs, ETCs, and Spanish/Luxembourg funds do not work reliably on the current FMP plan.
- In several cases, symbol discovery works, but quote/history access returns premium-plan restrictions.

## Provider strategy

### 1) EODHD (or equivalent exchange EOD provider)
Use for exchange-traded instruments once mapped to listing ticker:

- SWDA.L
- IGLN.L
- EIMI.L
- SGLD.L
- EXW1.DE
- GBDV.L
- TDIV.AS

### 2) Fund/NAV source
Use for Spanish and Luxembourg fund classes where ISIN is the primary identifier and exchange APIs are a poor fit:

- ES0146309002
- ES0112611001
- ES0146311008
- LU1598719752
- IE00BYX5P602 (pending verification)
- ES0173311103
- ES0159259011
- ES0174115057
- LU0084617165
- IE00BZ4BMM98 (pending mapping/verification)

### 3) FMP
Keep only as a complementary provider for instruments it actually supports under the current plan.

## Required data model per asset

Each asset in Finasset should store:

- `isin`
- `displayName`
- `assetType`
- `quantity`
- `buyPrice`
- `provider`
- `providerSymbol`
- `quoteSupport`
- `historySupport`
- `lastQuoteAt`
- `lastHistoryAt`

## UI behavior

- Real quote + real history -> render normally.
- Real quote + no history -> show current value but mark chart unavailable.
- No verified source -> show asset card with unsupported status.

## Next engineering steps

1. Replace fake seeded history with explicit unsupported state.
2. Load provider mapping from `portfolio-providers.json`.
3. Implement provider router:
   - `fmp`
   - `eodhd`
   - `fund-source`
4. Add per-asset coverage badges in UI.
5. Only build aggregate portfolio chart from assets with real history.

