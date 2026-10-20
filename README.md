# Pi NFT Provenance Verifier

A **read-only, zero-dependency** verifier that answers: **what happened in this
transaction, on which ledger, and when — directly from Pi's public API.**

- **Source of truth:** Pi's Horizon-compatible REST API (`/transactions`,
  `/ledgers`, `/operations`, `/effects`)
- **Offline replay:** `--fixture` re-verifies a saved transaction response
- **No database, no API keys, no writes**

> **Plainly:** a transaction hash proves a transaction exists; it does **not**
  name a person, a venue, or an NFT's creator. This tool prints only what the API
  returned. `contractId`, `tokenId` and `minter` stay `null` unless a Soroban
> event actually supplied them.

## Why REST and not Soroban RPC

Measured 2026-10-19:

| Host | Result |
|---|---|
| `https://api.mainnet.minepi.com` | **works** — Horizon 28.0.1, passphrase `Pi Network`, protocol 28, history from ledger 2 |
| `https://api.testnet.minepi.com` | **works** — pi-horizon 28.0.1, passphrase `Pi Testnet` |
| `https://rpc.testnet.minepi.com` | **works** — Soroban JSON-RPC, protocol 28, 7-day retention |
| `https://rpc.mainnet.minepi.com` | **HTTP 503** — no healthy backend; certificate expired 2023-05-30 |
| `https://soroban-rpc.mainnet.minepi.com` | **HTTP 503** — same |

There is therefore **no public Soroban RPC on Mainnet**. The REST API is the
portable source for transaction data; the testnet Soroban RPC is available via
`--rpc` when contract events are needed.

## Quick start

```bash
# Mainnet (default): transaction + ledger + operations + effects
node verify.mjs --tx e0916b2f64bef9da8ac6c2e784a98e48102637a77654a1a73055cb2b6927914c

# Testnet REST
node verify.mjs --tx <hash> --network testnet

# Re-verify a saved /transactions/<hash> response with no network
node verify.mjs --fixture tx.json

# Also read Soroban contract events (testnet RPC only, measured)
node verify.mjs --tx <hash> --network testnet --rpc https://rpc.testnet.minepi.com
```

No install. No API keys. No writes.

## Output

```
# Transaction
hash:          e0916b2f…914c
ledger:        27024280
created_at:    2026-06-04T16:20:39Z
successful:    true
source:        GBWKGBVD…HTZA
fee_charged:   100000 stroops
operations:    1
memo:          VV352v94UwCxraXcrr75XYHSHUrT (text)

# Ledger
sequence:      27024280
closed_at:     2026-06-04T16:20:39Z
protocol:      23
total_coins:   100000000000.0000000

# Operations
  [0] {"type":"payment","from":"GBWK…HTZA","to":"GC55…MIU","amount":"0.8000000","asset_type":"native"}
```

A JSON provenance record is printed at the end for machine use.

## Soroban events (`--rpc`)

Two measured constraints shape this mode:

- `getEvents` rejects `filter.type = "transaction"` (`if set, type must be either
  'system' or 'contract'`), so the tool fetches the ledger range **unfiltered**
  and matches `txHash` client-side.
- `endLedger` is **exclusive**: `[L, L]` returns nothing, `[L, L+1]` returns
  ledger `L`. The tool sends `L + 1`.

If the response hits 100 events, the tool prints a truncation warning rather than
pretending it saw everything.

## What this tool does **not** claim

| Not claimed | Why |
|---|---|
| That a transaction hash identifies a person | The API records accounts, never names. Attribution is external. |
| That `source_account` is the NFT creator | A mint may be submitted by a relayer or marketplace. |
| That `contractId` / `tokenId` / `minter` are known from REST alone | They are `null` unless a Soroban event supplied them; `null` means "not read", not "absent". Under `--rpc`, the **raw** `topicJson` and `valueJson` arrays are printed and **no field is labelled** `tokenId` or `minter`, because a contract's event schema is not knowable here. |
| That the transaction is the first mint of a token | This tool reads one transaction, not a token's full history. |
| That operations/effects are complete for every tx type | The tool prints what the API returned for that endpoint. |

## Tests

```bash
node --test test.mjs
```

29 checks, **all offline**:

- `txRecord` / `ledgerRecord` / `opRecord` / `effectRecord` map real measured
  field shapes and return `null` for fields that were absent
- `recordsOf` accepts both a bare array and Horizon `_embedded.records`
- `provenanceFrom` leaves `contractId` / `tokenId` / `minter` as `null`
- the REST bases are the measured hosts
- ScVal extraction handles the **json** shapes the RPC actually returns
  (`{ symbol }`, `{ i128: "100000" }`, `{ address }`, `{ map: [...] }`) and the
  older `{ sym }` / `{ str }` / `{ obj: { entries } }` shapes
- unknown ScVal shapes return `null` instead of guessing
- `--tx` + `--fixture` is rejected; a non-hex `--tx` exits `1` before any network
- `--fixture` replays a saved transaction and prints the same record offline
- a JSON array fixture and a missing fixture file both exit `2`

## See also

- `pi-soroban-events` — walk contract events with measured truncation
- `pi-contract-upgrade-trail` — track `wasmHash` changes across deployments
- `pi-nft-fee-check` — reconcile declared fees against on-chain events
