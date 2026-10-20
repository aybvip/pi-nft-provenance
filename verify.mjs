#!/usr/bin/env node
/**
 * Pi NFT Provenance Verifier — read-only.
 *
 * Primary source: Pi's Horizon-compatible REST API.
 *   https://api.mainnet.minepi.com   (measured 2026-10-19)
 *   https://api.testnet.minepi.com
 *
 * Why REST and not Soroban RPC: as of 2026-10-19 there is no public Soroban
 * JSON-RPC on Pi Mainnet. rpc.mainnet.minepi.com and soroban-rpc.mainnet.minepi.com
 * both answer HTTP 503 and serve a certificate that expired 2023-05-30. The
 * testnet Soroban RPC (https://rpc.testnet.minepi.com) does exist and can be
 * consulted with --rpc to read contract events.
 *
 * Read-only. GET / JSON-RPC reads only. No writes. No database.
 */

import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { REST_BASE, provenanceFrom, recordsOf, txRecord, ledgerRecord } from "./rest.mjs";
import { extractEventName, isMintLike } from "./extract.mjs";

function usage() {
  console.log(
    [
      "Pi NFT Provenance Verifier",
      "",
      "  node verify.mjs --tx <hash> [--network mainnet|testnet]",
      "  node verify.mjs --fixture <saved-transaction.json>",
      "  node verify.mjs --tx <hash> --rpc <soroban-rpc-url> [--maxEvents 100]",
      "",
      "Reads a transaction, its ledger, operations and effects from Pi's REST API",
      "and prints a minimal provenance record. With --rpc it also reads Soroban",
      "contract events (only the testnet RPC is known to exist).",
      "",
      "--fixture reads a previously saved /transactions/<hash> response instead",
      "of the network, so a record can be re-verified offline.",
    ].join("\n")
  );
}

const { values } = parseArgs({
  options: {
    tx: { type: "string" },
    fixture: { type: "string" },
    network: { type: "string", default: "mainnet" },
    rpc: { type: "string" },
    maxEvents: { type: "string", default: "100" },
    help: { type: "boolean", default: false },
  },
});

if (values.help || (!values.tx && !values.fixture)) {
  usage();
  process.exit(values.help ? 0 : 1);
}
if (values.tx && values.fixture) {
  console.error("ERROR: use either --tx or --fixture, not both");
  process.exit(1);
}

const network = values.network === "testnet" ? "testnet" : "mainnet";
const base = REST_BASE[network];
const maxEvents = Math.max(1, Number(values.maxEvents) || 100);

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep null */
  }
  if (!res.ok) {
    const detail = (body && (body.detail || body.title)) || text.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`HTTP ${res.status} ${url}\n      ${detail}`);
  }
  return body;
}

async function sorobanRpc(url, method, params = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}

function printTx(t) {
  console.log("");
  console.log("# Transaction");
  console.log(`hash:          ${t.hash}`);
  console.log(`ledger:        ${t.ledger}`);
  console.log(`created_at:    ${t.created_at}`);
  console.log(`successful:    ${t.successful}`);
  console.log(`source:        ${t.source_account}`);
  console.log(`fee_charged:   ${t.fee_charged} stroops`);
  console.log(`operations:    ${t.operation_count}`);
  console.log(`memo:          ${t.memo_type === "none" ? "none" : `${t.memo} (${t.memo_type})`}`);
  console.log(`signatures:    ${t.signatures}`);
}

function printLedger(l) {
  if (!l) return;
  console.log("");
  console.log("# Ledger");
  console.log(`sequence:      ${l.sequence}`);
  console.log(`closed_at:     ${l.closed_at}`);
  console.log(`protocol:      ${l.protocol_version}`);
  console.log(`total_coins:   ${l.total_coins}`);
  console.log(`ledger_hash:   ${l.hash}`);
}

(async () => {
  let tx;
  let txSource;

  if (values.fixture) {
    const raw = await readFile(values.fixture, "utf8");
    tx = JSON.parse(raw);
    txSource = `fixture ${values.fixture}`;
    if (!tx || typeof tx !== "object" || Array.isArray(tx)) {
      throw new Error("fixture is not a JSON object");
    }
  } else {
    const hash = String(values.tx).trim();
    if (!/^[0-9a-f]{64}$/i.test(hash)) {
      console.error("ERROR: --tx must be a 64-character hex transaction hash");
      process.exit(1);
    }
    tx = await getJson(`${base}/transactions/${hash}`);
    txSource = `${base}/transactions/${hash}`;
  }

  const t = txRecord(tx);

  console.log("# Pi NFT Provenance (measurement)");
  console.log(`network: ${network}`);
  console.log(`source:  ${txSource}`);

  printTx(t);

  // Ledger: only fetched over the network; a fixture may include a "ledger_data".
  let ledger = tx.ledger_data ?? null;
  if (!ledger && !values.fixture && t.ledger) {
    try {
      ledger = await getJson(`${base}/ledgers/${t.ledger}`);
    } catch (e) {
      console.warn(`ledger: unavailable (${e.message})`);
    }
  }
  printLedger(ledger ? ledgerRecord(ledger) : null);

  // Operations and effects: network only.
  let operations = [];
  let effects = [];
  if (!values.fixture && t.hash) {
    try {
      operations = recordsOf(await getJson(`${base}/transactions/${t.hash}/operations`));
    } catch (e) {
      console.warn(`operations: unavailable (${e.message})`);
    }
    try {
      effects = recordsOf(await getJson(`${base}/transactions/${t.hash}/effects`));
    } catch (e) {
      console.warn(`effects: unavailable (${e.message})`);
    }
  }

  if (operations.length) {
    console.log("");
    console.log("# Operations");
    operations.forEach((op, i) => {
      const r = { type: op.type, from: op.from, to: op.to, amount: op.amount, asset_type: op.asset_type };
      console.log(`  [${i}] ${JSON.stringify(r)}`);
    });
  }

  if (effects.length) {
    console.log("");
    console.log("# Effects");
    effects.forEach((e, i) => {
      console.log(`  [${i}] ${e.type} ${e.account ?? ""} ${e.amount ?? ""} ${e.asset_type ?? ""}`.trimEnd());
    });
  }

  // Optional Soroban event pass (testnet RPC is the only measured one).
  let mintLike = false;
  let eventCount = 0;
  if (values.rpc) {
    console.log("");
    console.log(`# Soroban events (${values.rpc})`);
    try {
      // MEASURED: filter type "transaction" is rejected ("if set, type must be
      // either 'system' or 'contract'"), so the range is fetched unfiltered and
      // the transaction hash is matched client-side. endLedger is exclusive.
      // xdrFormat: "json" makes the RPC return topicJson/valueJson as decoded
      // ScVal objects instead of base64 XDR strings.
      const ev = await sorobanRpc(values.rpc, "getEvents", {
        startLedger: t.ledger,
        endLedger: Number(t.ledger) + 1,
        filters: [],
        limit: maxEvents,
        xdrFormat: "json",
      });
      const all = ev.events ?? [];
      const events = all.filter((e) => e.txHash === t.hash);
      console.log(`  ledger ${t.ledger} returned ${all.length} event(s); ${events.length} match this tx`);
      if (all.length >= 100) {
        console.log(`  WARNING: the response hit the 100-event page cap; events may be truncated.`);
      }
      eventCount = events.length;
      for (const [i, e] of events.entries()) {
        const topics = e.topicJson ?? [];
        const name = extractEventName(topics[0]);
        const contractId = e.contractId ?? null;
        // Print the raw measured topic/value arrays. A contract's event schema
        // is not knowable here, so no field is labelled "tokenId" or "minter".
        console.log(
          `  [${i}] name=${name ?? "unknown"} contract=${contractId ?? "-"}`
        );
        console.log(`       topics=${JSON.stringify(topics)}`);
        console.log(`       value=${JSON.stringify(e.valueJson ?? null)}`);
        if (isMintLike(name)) mintLike = true;
      }
      if (events.length === 0) {
        console.log("  (no event in this ledger matched the transaction hash)");
      }
    } catch (e) {
      console.log(`  events unavailable: ${e.message}`);
    }
  }

  const record = provenanceFrom({ tx, ledger, operations, effects });
  console.log("");
  console.log("# Provenance record");
  console.log(JSON.stringify({ ...record, soroban_events_read: values.rpc ? eventCount : null, mint_like_found: values.rpc ? mintLike : null }, null, 2));
  console.log("");
  console.log("# Measurement complete — no inference beyond what the API returned");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(2);
});
