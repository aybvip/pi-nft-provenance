# Sources — pi-nft-provenance

Every figure here is an observation of a live endpoint, or a mapping of a field
shape the endpoint actually returned. The "source" is a **request** and the host
it targets.

## Endpoints

| Endpoint | Role | Measured 2026-10-19 |
|---|---|---|
| `https://api.mainnet.minepi.com` | Horizon REST — the default source | works — Horizon 28.0.1, passphrase `Pi Network`, protocol 28, history from ledger 2 |
| `https://api.testnet.minepi.com` | Horizon REST for Testnet | works — pi-horizon 28.0.1, passphrase `Pi Testnet` |
| `https://rpc.testnet.minepi.com` | Soroban JSON-RPC, used only under `--rpc` | works — protocol 28, 7-day retention |
| `https://rpc.mainnet.minepi.com` | attempted; not usable | **HTTP 503**; certificate expired 2023-05-30 |
| `https://soroban-rpc.mainnet.minepi.com` | attempted; not usable | **HTTP 503**; same |

The two Mainnet Soroban hosts are recorded because their absence is what forces
the REST route: there is **no public Soroban RPC on Mainnet**.

## Measured endpoints and the shapes they return

| Endpoint | Fields observed and mapped |
|---|---|
| `/transactions/<hash>` | `hash`, `ledger`, `created_at`, `successful`, `source_account`, `fee_charged`, `operation_count`, `memo` |
| `/ledgers/<seq>` | `sequence`, `closed_at`, `protocol_version`, `total_coins` |
| `/transactions/<hash>/operations` | `type`, `from`, `to`, `amount`, `asset_type` (payment shape) |
| `/transactions/<hash>/effects` | per-effect records |

Each of these is mapped by `txRecord`, `ledgerRecord`, `opRecord`,
`effectRecord`, and each returns `null` for a field that was absent — so the
mapping records what was there rather than assuming a schema.

## Measured Soroban constraints (under `--rpc`)

| Constraint | Value | How to re-measure |
|---|---|---|
| `getEvents` filter | rejects `filter.type = "transaction"` — *"if set, type must be either 'system' or 'contract'"* | send the filter and read the error |
| `endLedger` | exclusive — `[L, L]` returns nothing, `[L, L+1]` returns ledger `L` | send both bounds and compare |
| Events per response | capped at 100 | request a larger `limit` and count |
| ScVal json shapes | `{ symbol }`, `{ string }`, `{ i128: "100000" }`, `{ u128: "7" }`, `{ address }`, `{ map: [{ key, val }] }` | request with `xdrFormat: "json"` and read the topic/value |
| ScVal legacy shapes | `{ sym }`, `{ str }`, `{ obj: { entries } }`, `{ lo, hi }` | read an older response, or the fixtures |

## Re-checking everything

```bash
git clone https://github.com/aybvip/pi-nft-provenance
cd pi-nft-provenance
node --test test.mjs                                   # 29 offline checks
node verify.mjs --tx <64-hex-hash>                     # Mainnet (default)
node verify.mjs --tx <64-hex-hash> --network testnet
node verify.mjs --fixture tx.json                      # no network
node verify.mjs --tx <hash> --network testnet --rpc https://rpc.testnet.minepi.com
```

## Provenance of the numbers

The measurements were taken on **2026-10-19**. REST hosts, protocol version
(`28`) and history start are read from the responses at measurement time, and the
records printed by the tool carry the values it read, so a later reader can tell
whether the recording still applies. No third-party mirror or blog is used as a
source.
