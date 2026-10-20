# Design decisions — pi-nft-provenance

## D1 — REST, not Soroban RPC, for transaction data

**Measurement (2026-10-19):**

| Host | Result |
|---|---|
| `https://api.mainnet.minepi.com` | **works** — Horizon 28.0.1, `Pi Network`, protocol 28, history from ledger 2 |
| `https://api.testnet.minepi.com` | **works** — pi-horizon 28.0.1, `Pi Testnet` |
| `https://rpc.testnet.minepi.com` | **works** — Soroban JSON-RPC, protocol 28, 7-day retention |
| `https://rpc.mainnet.minepi.com` | **HTTP 503** — certificate expired 2023-05-30 |
| `https://soroban-rpc.mainnet.minepi.com` | **HTTP 503** — same |

**Decision:** the portable source for **transaction** data is the Horizon REST API.
There is no public Soroban RPC on Mainnet, so contract-event reads are offered via
`--rpc`, which must be pointed at the Testnet RPC explicitly.

## D2 — Never label a field the API did not supply

**Reasoning:** `contractId`, `tokenId` and `minter` would be convenient, but the
REST API does not carry them and a contract's event schema is not knowable here.
Filling them from a guess is the one change that would turn a measurement into an
assertion.

**Decision:** `provenanceFrom` leaves those fields `null`. Under `--rpc`, the
**raw** `topicJson` and `valueJson` are printed and **no field is labelled**
`tokenId` or `minter`. `null` means "not read", and the tool says so.

## D3 — `txHash` matched client-side under `--rpc`

**Measurement:** `getEvents` rejects `filter.type = "transaction"` with
*"if set, type must be either 'system' or 'contract'"*.

**Decision:** the tool fetches the ledger range **unfiltered** and matches
`txHash` client-side, because the server-side filter that would do this is
rejected. The measured constraint is named in the code so a later reader knows why
the query is shaped that way.

## D4 — Always send `endLedger = L + 1`

**Measurement:** `endLedger` is exclusive — `[L, L]` returns nothing, `[L, L+1]`
returns ledger `L`.

**Decision:** the tool sends `L + 1` so a single-ledger range still finds its
events. A window that returns a full page prints a **truncation warning** rather
than pretending it saw everything.

## D5 — Accept both Horizon and bare-array response shapes

**Decision:** `recordsOf` accepts a bare array and Horizon's `_embedded.records`.
Both are observed in practice, so the mapping does not depend on which envelope a
given endpoint returns.

## D6 — Handle the ScVal shapes the RPC actually returns

**Measurement:** with `xdrFormat: "json"`, the RPC returns ScVals shaped
`{ symbol }`, `{ string }`, `{ i128: "100000" }`, `{ u128: "7" }`, `{ address }`,
`{ map: [{ key, val }] }`; older responses use `{ sym }`, `{ str }`,
`{ obj: { entries } }`, `{ lo, hi }`.

**Decision:** `extract.mjs` handles all of these, and returns `null` for an
unknown shape instead of guessing. `unknown shapes return null` is asserted in the
tests, so a future ScVal shape degrades to `null` rather than a wrong value.

## D7 — `--fixture` for offline replay

**Reasoning:** a verifier that can only run against the live API cannot be
verified deterministically.

**Decision:** `--fixture <saved.json>` re-verifies a saved `/transactions/<hash>`
response with **no network**, producing the same record. `--tx` and `--fixture`
are mutually exclusive, and a non-hex `--tx` exits `1` **before** any network call.

## D8 — Read-only, like everything in this family

**Decision:** the tool never builds, signs or submits a transaction, never writes
a file, and needs no API key. Its whole surface is GET requests to public
endpoints.
