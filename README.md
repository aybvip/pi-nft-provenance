# Pi NFT Provenance Verifier

A read-only, zero-dependency verifier that answers: **who created this NFT, when, and on which Soroban contract — directly from Pi Mainnet/Testnet RPC.**

- **Source of truth:** Pi RPC (`getTransaction`, `getEvents`, `getLedger`)
- **No database, no API keys required for public reads**
- **English only in repo files**
- **Claims are measurement, not opinion**

## Goal
Given a transaction hash (mint/create) or a token ID + contract ID, produce a minimal, verifiable provenance record.

## Non-goals
- Writing to chain
- Indexing the whole ledger
- Rendering full marketplace UI

## Quick start (planned)
```bash
node verify.mjs --tx <mint-tx-hash> --network testnet
```

## Scope
- Parse mint-related events (topic/args) from Soroban
- Resolve ledger close time
- Show contract ID, token ID, minter/account
- Hash/tx linkage for reproducibility
