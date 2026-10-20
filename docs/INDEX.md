# Documentation index — pi-nft-provenance

A read-only, zero-dependency verifier that answers: **what happened in this
transaction, on which ledger, and when** — from Pi's public API.

| Document | What it covers |
|---|---|
| [`BOUNDARIES.md`](BOUNDARIES.md) | every claim this tool does **not** make, and why |
| [`DECISIONS.md`](DECISIONS.md) | why REST rather than Soroban RPC, and why nothing is inferred |
| [`SOURCES.md`](SOURCES.md) | the measured endpoints and the field shapes |
| [`VERIFICATION.md`](VERIFICATION.md) | how to reproduce the 29 offline checks |
| [`../README.md`](../README.md) | the full description and quick start |
| [`../llms.txt`](../llms.txt) | a compact summary for machine readers |

## The one-line answer

> A transaction hash proves a transaction exists; it does **not** name a person, a
> venue, or an NFT's creator. This tool prints only what the API returned, and
> leaves `contractId`, `tokenId` and `minter` as `null` unless a Soroban event
> actually supplied them.

## Claim status at a glance

| Statement | Status |
|---|---|
| Pi Mainnet REST works; Mainnet Soroban RPC does not | **measured** (2026-10-19) |
| Field shapes returned by each REST endpoint | **measured** (recorded per record) |
| `getEvents` rejects `filter.type = "transaction"` | **measured** |
| `endLedger` is exclusive | **measured** |
| ScVal json shapes (`{symbol}`, `{i128}`, `{map}`) | **measured** |
| A hash identifies a person | **not claimed** |
| `contractId` / `tokenId` / `minter` from REST alone | **not claimed** |
| Operations/effects are complete for every tx type | **not claimed** |
