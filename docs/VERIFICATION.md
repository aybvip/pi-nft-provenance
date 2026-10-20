# Verification — pi-nft-provenance

Two things are checked, and they are separate: the **record mapping and ScVal
extraction** (offline, deterministic) and the **endpoint behaviour** (measured,
and therefore dated).

## Offline: the test suite

```bash
git clone https://github.com/aybvip/pi-nft-provenance
cd pi-nft-provenance
node --test test.mjs
```

Expected result: **29 pass, 0 fail**, with **no network access**.

What the 29 checks cover:

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

## Offline: replay a saved transaction

```bash
node verify.mjs --fixture tx.json
```

The same record is produced with **no network**, so a previously observed
transaction can be re-read at any time and compared against what the tool printed
the first time. This is how provenance checks are reproduced without re-querying
the chain.

## Live: read a transaction

```bash
node verify.mjs --tx <64-hex-hash>                      # Mainnet (default)
node verify.mjs --tx <64-hex-hash> --network testnet
node verify.mjs --tx <hash> --network testnet --rpc https://rpc.testnet.minepi.com
```

The output names the hash, ledger, close time, success flag, source account, fee,
operation count and memo, then the operations. A JSON provenance record follows
for machine use. With `--rpc`, contract events are read too, with the raw
`topicJson` / `valueJson` printed and no field labelled.

## What a passing run does and does not show

- A passing suite shows the **mapping and extraction** are as specified: which
  fields are read, what `null` means, which ScVal shapes are understood.
- A successful live read shows the **API returned that transaction** at that time,
  and nothing about who submitted it or who created anything.
- It does **not** show `contractId` / `tokenId` / `minter`: those stay `null`
  unless a Soroban event supplied them, and a full event read may still be
  truncated at 100 events (a warning is printed in that case).

## Reproducibility note

No digest or signature is attached to these results, and none is claimed. A
digest would prove integrity, not truth, and a signature would require naming an
authority this project does not have. What is offered instead — for a saved
response — is a `--fixture` replay whose outcome anyone can recompute.
