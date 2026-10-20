# What this tool does **not** claim

A transaction hash looks like an identity. It is not one. This repository's
central discipline is to print only what the API returned and to leave every
inferred field as `null`, and the boundary below is the full statement of that.

| Not claimed | Why |
|---|---|
| That a transaction hash identifies a **person** | The API records accounts, never names. Attribution is external. |
| That `source_account` is the NFT **creator** | A mint may be submitted by a relayer or marketplace. |
| That `contractId` / `tokenId` / `minter` are known from REST alone | They are `null` unless a Soroban event supplied them. `null` means **"not read"**, not **"absent"**. Under `--rpc`, the **raw** `topicJson` and `valueJson` arrays are printed and **no field is labelled** `tokenId` or `minter`, because a contract's event schema is not knowable here. |
| That the transaction is the **first mint** of a token | This tool reads one transaction, not a token's full history. |
| That operations/effects are complete for **every** tx type | The tool prints what the API returned for that endpoint. |
| That the ScVal interpretation covers every shape | It handles the measured shapes and returns `null` for unknown ones rather than guessing. |
| That a Mainnet Soroban query is possible | There is no public Soroban RPC on Mainnet; both hosts answer HTTP 503. |
| That a truncated event read saw everything | When a response hits 100 events, a truncation warning is printed instead. |
| That this is the first such tool | The prior-art position is **"no prior work found"**, not "we are first". |
| That Pi Network has adopted, reviewed or endorsed this | Adoption is **not-claimed**. |

## The shape of the claim

- **Measured** — an observation of the live API: which endpoints work, which field
  names and types each record actually carries, and the two Soroban constraints.
- **Verifiable** — decided by this repository's own code, so an offline test
  settles it: how records are mapped, how ScVal shapes are extracted, how
  fixtures replay, what the exit codes are.
- **Not claimed** — every inference. Identity, creation, completeness and
  authenticity are all outside what an API response supports.

The reason `null` is emphasised is that a `null` field is the honest answer to
"was this read?". Replacing it with a guess would be the one change that turns a
measurement into an assertion, so the tool never does it.
