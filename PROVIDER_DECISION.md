# Finasset - Provider Decision

## Decision

Primary recommendation for Finasset real-data coverage:

1. **Twelve Data** as the main provider to evaluate next
2. **FMP** only as a complement for assets it already supports well
3. **EODHD** only if a working authenticated key is confirmed

## Why Twelve Data

From the current documentation review, Twelve Data explicitly documents support for:

- Stocks
- ETFs
- Funds
- Mutual funds
- Quote / latest price / end of day price
- Dividends
- ETFs full data
- Mutual funds full data
- Mutual funds summary / performance / risk / ratings / composition

This is a much better fit for Grigom's portfolio than FMP alone.

## Why not rely on FMP only

FMP current access works for simple US equities, but failed on:

- European UCITS ETFs and ETCs
- ISIN-based instruments
- Spanish/Luxembourg funds

## Why EODHD is not enough right now

The current EODHD key tested from this environment returns unauthorized.
So even though the exchange-ticker mapping is ready, the provider is not usable yet from this setup.

## Portfolio fit

### Likely good candidates for Twelve Data

- UCITS ETFs / ETCs listed on exchanges
- Mutual funds / fund-like instruments where ISIN and fund metadata matter
- Dividend data for ETF positions

### Keep as unresolved until tested

- Specific Spanish fund share classes
- Luxembourg fund classes that may need exact identifier mapping
- Some exchange suffixes/listings

## Next implementation step

Replace the current provider priority with:

1. `twelvedata`
2. `fmp`
3. `eodhd` (only if working auth is confirmed)

## Product rule

Do not enable aggregate chart until at least one provider returns verified real history for the mapped assets.

