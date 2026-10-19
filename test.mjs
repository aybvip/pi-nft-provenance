import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  txRecord,
  ledgerRecord,
  opRecord,
  effectRecord,
  recordsOf,
  provenanceFrom,
  REST_BASE,
} from "./rest.mjs";
import {
  extractTokenIdFromScVal,
  extractAccount,
  extractEventName,
  isMintLike,
} from "./extract.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "verify.mjs");

function run(args) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", stdio: "pipe" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

function fixture(obj) {
  const dir = mkdtempSync(join(tmpdir(), "provenance-"));
  const p = join(dir, "tx.json");
  writeFileSync(p, JSON.stringify(obj));
  return { path: p, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// --- REST mapping -----------------------------------------------------------

const REAL_TX = {
  hash: "e0916b2f64bef9da8ac6c2e784a98e48102637a77654a1a73055cb2b6927914c",
  ledger: 27024280,
  created_at: "2026-06-04T16:20:39Z",
  successful: true,
  source_account: "GBWKGBVDEJO3JKRV7IUBHXMBE7A2JYHOGMUMKEO2XM5RFIRBRVSYHTZA",
  fee_charged: "100000",
  max_fee: "100000",
  operation_count: 1,
  memo: "VV352v94UwCxraXcrr75XYHSHUrT",
  memo_type: "text",
  signatures: ["abc"],
};

test("txRecord keeps the measured fields", () => {
  const r = txRecord(REAL_TX);
  assert.equal(r.hash, REAL_TX.hash);
  assert.equal(r.ledger, 27024280);
  assert.equal(r.created_at, REAL_TX.created_at);
  assert.equal(r.successful, true);
  assert.equal(r.source_account, REAL_TX.source_account);
  assert.equal(r.fee_charged, "100000");
  assert.equal(r.operation_count, 1);
  assert.equal(r.memo_type, "text");
  assert.equal(r.signatures, 1);
});

test("txRecord never invents a missing field", () => {
  const r = txRecord({ hash: "h" });
  assert.equal(r.ledger, null);
  assert.equal(r.memo, null);
  assert.equal(r.signatures, null);
});

test("txRecord rejects a non-object", () => {
  assert.throws(() => txRecord(null), /transaction object/);
});

test("ledgerRecord maps closed_at and protocol_version", () => {
  const r = ledgerRecord({
    sequence: 27024280,
    closed_at: "2026-06-04T16:20:39Z",
    protocol_version: 23,
    total_coins: "100000000000.0000000",
  });
  assert.equal(r.sequence, 27024280);
  assert.equal(r.closed_at, "2026-06-04T16:20:39Z");
  assert.equal(r.protocol_version, 23);
  assert.equal(r.total_coins, "100000000000.0000000");
});

test("opRecord maps a payment operation", () => {
  const r = opRecord({ type: "payment", type_i: 1, from: "GA", to: "GB", amount: "129.21", asset_type: "native" });
  assert.deepEqual(r, {
    type: "payment",
    type_i: 1,
    source_account: null,
    from: "GA",
    to: "GB",
    amount: "129.21",
    asset_type: "native",
    transaction_successful: null,
  });
});

test("effectRecord maps an account_credited effect", () => {
  const r = effectRecord({ type: "account_credited", type_i: 2, account: "GB", amount: "129.21", asset_type: "native" });
  assert.equal(r.type, "account_credited");
  assert.equal(r.account, "GB");
  assert.equal(r.amount, "129.21");
});

test("recordsOf accepts a bare array", () => {
  assert.equal(recordsOf([{ a: 1 }]).length, 1);
});

test("recordsOf accepts Horizon _embedded.records", () => {
  assert.equal(recordsOf({ _embedded: { records: [{ a: 1 }, { b: 2 }] } }).length, 2);
});

test("recordsOf returns [] for an unexpected shape", () => {
  assert.deepEqual(recordsOf({ nope: true }), []);
  assert.deepEqual(recordsOf(null), []);
});

test("provenanceFrom leaves contract-level fields null", () => {
  const p = provenanceFrom({ tx: REAL_TX, ledger: null, operations: [], effects: [] });
  assert.equal(p.contractId, null);
  assert.equal(p.tokenId, null);
  assert.equal(p.minter, null);
  assert.equal(p.tx.hash, REAL_TX.hash);
});

test("REST bases are the measured hosts", () => {
  assert.equal(REST_BASE.mainnet, "https://api.mainnet.minepi.com");
  assert.equal(REST_BASE.testnet, "https://api.testnet.minepi.com");
});

// --- Soroban ScVal extraction (used by --rpc) --------------------------------

test("i128 token id returns its low word", () => {
  assert.equal(extractTokenIdFromScVal({ i128: { lo: "42", hi: "0" } }), "42");
});

test("unknown ScVal shapes return null", () => {
  assert.equal(extractTokenIdFromScVal({}), null);
  assert.equal(extractTokenIdFromScVal({ bytes: "00" }), null);
});

test("a direct address is extracted", () => {
  assert.equal(extractAccount({ address: "GABC" }), "GABC");
});

test("an address inside obj.entries is extracted", () => {
  assert.equal(extractAccount({ obj: { entries: [{ val: { address: "GXYZ" } }] } }), "GXYZ");
});

test("event names come from sym, str, or a vec", () => {
  assert.equal(extractEventName({ sym: "mint" }), "mint");
  assert.equal(extractEventName({ str: "transfer" }), "transfer");
  assert.equal(extractEventName({ vec: [{ sym: "nft" }, { sym: "mint" }] }), "nft.mint");
});

test("mint-like detection is case-insensitive", () => {
  assert.equal(isMintLike("MintEvent"), true);
  assert.equal(isMintLike("transfer"), false);
});

// --- CLI --------------------------------------------------------------------

test("--help exits 0", () => {
  const r = run(["--help"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /--fixture/);
  assert.match(r.out, /--rpc/);
});

test("no source exits 1", () => {
  assert.equal(run([]).code, 1);
});

test("--tx together with --fixture exits 1", () => {
  assert.equal(run(["--tx", "a".repeat(64), "--fixture", "x.json"]).code, 1);
});

test("a non-hex --tx exits 1 before any network call", () => {
  const r = run(["--tx", "not-a-hash"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /64-character hex/);
});

test("--fixture replays a saved transaction without the network", () => {
  const f = fixture(REAL_TX);
  try {
    const r = run(["--fixture", f.path]);
    assert.equal(r.code, 0);
    assert.match(r.out, new RegExp(REAL_TX.hash));
    assert.match(r.out, /fee_charged:\s+100000/);
    assert.match(r.out, /"contractId": null/);
  } finally {
    f.cleanup();
  }
});

test("--fixture defaults to mainnet in the header", () => {
  const f = fixture(REAL_TX);
  try {
    const r = run(["--fixture", f.path]);
    assert.match(r.out, /network: mainnet/);
  } finally {
    f.cleanup();
  }
});

test("--fixture accepts --network testnet", () => {
  const f = fixture(REAL_TX);
  try {
    const r = run(["--fixture", f.path, "--network", "testnet"]);
    assert.match(r.out, /network: testnet/);
  } finally {
    f.cleanup();
  }
});

test("a fixture that is a JSON array is rejected", () => {
  const f = fixture([1, 2, 3]);
  try {
    const r = run(["--fixture", f.path]);
    assert.equal(r.code, 2);
    assert.match(r.out, /not a JSON object/);
  } finally {
    f.cleanup();
  }
});

test("a missing fixture file exits 2", () => {
  const r = run(["--fixture", "Z:/no/such/file.json"]);
  assert.equal(r.code, 2);
});
