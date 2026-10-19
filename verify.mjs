#!/usr/bin/env node
/**
 * Pi NFT Provenance Verifier — read-only.
 * Fetches a transaction and its events from Pi RPC and extracts minimal
 * provenance fields (contract, tokenId, minter, ledger, closeTime).
 * No writes, no DB. Measurement only.
 */

import { parseArgs } from "node:util";

const RPCS = {
  testnet: "https://rpc.testnet.minepi.com",
  mainnet: "https://api.mainnet.minepi.com",
};

function usage() {
  console.log(
    `Usage: node verify.mjs --tx <txHash> [--network testnet|mainnet] [--maxEvents 2000]\n`
  );
}

const { values } = parseArgs({
  options: {
    tx: { type: "string" },
    network: { type: "string", default: "testnet" },
    maxEvents: { type: "string", default: "2000" },
    help: { type: "boolean", default: false },
  },
});

if (values.help || !values.tx) {
  usage();
  process.exit(values.help ? 0 : 1);
}

const network = values.network === "mainnet" ? "mainnet" : "testnet";
const rpcUrl = RPCS[network];
const txHash = values.tx.trim();
const maxEvents = Number(values.maxEvents) || 2000;

async function rpc(method, params = {}) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}

function extractTokenIdFromScVal(scVal) {
  if (!scVal) return null;
  if (scVal.i128) return scVal.i128.lo?.toString() ?? scVal.i128.hi?.toString();
  if (scVal.u128) return scVal.u128.lo?.toString() ?? scVal.u128.hi?.toString();
  if (scVal.i64) return String(scVal.i64);
  if (scVal.u64) return String(scVal.u64);
  if (scVal.i32) return String(scVal.i32);
  if (scVal.u32) return String(scVal.u32);
  if (scVal.str) return scVal.str;
  if (scVal.sym) return scVal.sym;
  return null;
}

function extractAccount(scVal) {
  if (!scVal) return null;
  if (scVal.address) return scVal.address;
  if (scVal.obj) {
    for (const e of scVal.obj.entries ?? []) {
      const v = e.val ?? e.value;
      if (v?.address) return v.address;
    }
  }
  return null;
}

(async () => {
  console.log("# Pi NFT Provenance (measurement)");
  console.log(`network: ${network}`);
  console.log(`rpc: ${rpcUrl}`);
  console.log(`tx: ${txHash}`);

  const tx = await rpc("getTransaction", { hash: txHash });
  if (!tx) {
    console.error("NOT_FOUND: transaction not found");
    process.exit(2);
  }

  console.log(`status: ${tx.status}`);
  console.log(`ledger: ${tx.ledger}`);
  console.log(`fee: ${tx.fee}`);
  console.log(`applicationOrder: ${tx.applicationOrder ?? "n/a"}`);
  if (tx.memo) console.log(`memo: ${tx.memo}`);

  const ledger = await rpc("getLedger", { ledgerSeq: tx.ledger });
  const closeTime = ledger?.closeTime ?? ledger?.closed_at ?? null;
  if (closeTime) {
    const d = new Date(closeTime * 1000);
    console.log(`closeTime: ${closeTime} (${d.toISOString()})`);
  } else {
    console.log("closeTime: n/a");
  }

  let events = [];
  try {
    const ev = await rpc("getEvents", {
      filters: [{ type: "transaction", hashes: [txHash] }],
      limit: maxEvents,
    });
    events = ev.events ?? [];
  } catch (e) {
    console.warn(`events: fetch failed (${e.message})`);
  }
  console.log(`events: ${events.length}`);

  let found = false;
  for (const [i, ev] of events.entries()) {
    const contractId = ev.contractId ?? ev.contract_id;
    const topics = ev.topic ?? [];
    const data = ev.data;
    const t0 = topics[0];
    let eventName = null;
    if (t0?.sym) eventName = t0.sym;
    if (t0?.str) eventName = t0.str;
    if (t0?.vec) {
      const s = extractTokenIdFromScVal({ str: t0.vec.map((x) => x.sym ?? x.str ?? "").join(".") });
      if (!eventName) eventName = s;
    }
    console.log(`\n[${i}] event: ${eventName ?? "unknown"}`);
    if (contractId) console.log(`  contractId: ${contractId}`);
    if (topics.length > 1) {
      const t1 = topics[1];
      const tid = extractTokenIdFromScVal(t1);
      if (tid) console.log(`  tokenId: ${tid}`);
    }
    const acct = extractAccount(data);
    if (acct) console.log(`  account/owner/minter: ${acct}`);
    if (eventName?.toLowerCase().includes("mint")) found = true;
  }

  console.log(`\nprovenance_mint_like_found: ${found}`);
  console.log("\n# Measurement complete — no inference beyond what RPC returned");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
