/**
 * Pure mapping helpers for Pi's Horizon-compatible REST API. No I/O.
 *
 * Measured 2026-10-19:
 *   https://api.mainnet.minepi.com  horizon 28.0.1, passphrase "Pi Network",
 *                                   history from ledger 2, protocol 28
 *   https://api.testnet.minepi.com  pi-horizon 28.0.1, passphrase "Pi Testnet"
 *
 * Endpoints used:
 *   GET /transactions/<hash>
 *   GET /ledgers/<seq>
 *   GET /transactions/<hash>/operations
 *   GET /transactions/<hash>/effects
 *
 * Everything here returns only fields that were present in the response.
 * Missing fields stay null — a provenance record must never invent a value.
 */

export const REST_BASE = {
  mainnet: "https://api.mainnet.minepi.com",
  testnet: "https://api.testnet.minepi.com",
};

const pick = (o, k) => (o && o[k] !== undefined ? o[k] : null);

export function txRecord(tx) {
  if (!tx || typeof tx !== "object") throw new Error("txRecord needs a transaction object");
  return {
    hash: pick(tx, "hash"),
    ledger: pick(tx, "ledger"),
    created_at: pick(tx, "created_at"),
    successful: pick(tx, "successful"),
    source_account: pick(tx, "source_account"),
    fee_charged: pick(tx, "fee_charged"),
    max_fee: pick(tx, "max_fee"),
    operation_count: pick(tx, "operation_count"),
    memo: pick(tx, "memo"),
    memo_type: pick(tx, "memo_type"),
    signatures: Array.isArray(tx.signatures) ? tx.signatures.length : null,
  };
}

export function ledgerRecord(lg) {
  if (!lg || typeof lg !== "object") throw new Error("ledgerRecord needs a ledger object");
  return {
    sequence: pick(lg, "sequence"),
    closed_at: pick(lg, "closed_at"),
    protocol_version: pick(lg, "protocol_version"),
    total_coins: pick(lg, "total_coins"),
    base_fee_in_stroops: pick(lg, "base_fee_in_stroops"),
    hash: pick(lg, "hash"),
  };
}

export function opRecord(op) {
  if (!op || typeof op !== "object") throw new Error("opRecord needs an operation object");
  return {
    type: pick(op, "type"),
    type_i: pick(op, "type_i"),
    source_account: pick(op, "source_account"),
    from: pick(op, "from"),
    to: pick(op, "to"),
    amount: pick(op, "amount"),
    asset_type: pick(op, "asset_type"),
    transaction_successful: pick(op, "transaction_successful"),
  };
}

export function effectRecord(e) {
  if (!e || typeof e !== "object") throw new Error("effectRecord needs an effect object");
  return {
    type: pick(e, "type"),
    type_i: pick(e, "type_i"),
    account: pick(e, "account"),
    amount: pick(e, "amount"),
    asset_type: pick(e, "asset_type"),
  };
}

/** Extract records from either a bare array or a Horizon `_embedded.records`. */
export function recordsOf(body) {
  if (Array.isArray(body)) return body;
  const rec = body && body._embedded && body._embedded.records;
  return Array.isArray(rec) ? rec : [];
}

/**
 * A minimal, reproducible provenance record. `contractId`, `tokenId` and
 * `minter` stay null unless a Soroban event actually supplied them — the REST
 * API describes the transaction, not the contract-level token identity.
 */
export function provenanceFrom({ tx, ledger, operations = [], effects = [] }) {
  const t = txRecord(tx);
  const l = ledger ? ledgerRecord(ledger) : null;
  return {
    tx: t,
    ledger: l,
    operations: operations.map(opRecord),
    effects: effects.map(effectRecord),
    // Fields that require Soroban events; null here means "not read", not "absent".
    contractId: null,
    tokenId: null,
    minter: null,
    note: "contractId/tokenId/minter require Soroban events; use --rpc on a network that exposes a Soroban RPC.",
  };
}
