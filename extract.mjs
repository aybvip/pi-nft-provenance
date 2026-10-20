/**
 * Pure extraction helpers for Soroban event values. No I/O.
 *
 * Handles BOTH shapes the Pi RPC can return:
 *
 *   1. xdrFormat = "json"  -> topicJson / valueJson, e.g.
 *        { "symbol": "fee" }
 *        { "address": "G..." }
 *        { "i128": "100000" }            <- string, not {lo,hi}
 *        { "map": [{ "key": ..., "val": ... }] }
 *
 *   2. default (base64 XDR) -> not decoded here; the caller should request
 *      xdrFormat: "json" before using these helpers.
 *
 * Anything unrecognised returns null rather than guessing — a provenance tool
 * must never invent a field it did not read.
 */

/** Best-effort numeric/string identifier from a decoded ScVal. */
export function extractTokenIdFromScVal(scVal) {
  if (!scVal || typeof scVal !== "object") return null;

  // json format: i128 / u128 are decimal strings.
  if (typeof scVal.i128 === "string") return scVal.i128;
  if (typeof scVal.u128 === "string") return scVal.u128;

  // some encoders use { lo, hi }.
  if (scVal.i128 && typeof scVal.i128 === "object") {
    return scVal.i128.lo !== undefined ? String(scVal.i128.lo) : null;
  }
  if (scVal.u128 && typeof scVal.u128 === "object") {
    return scVal.u128.lo !== undefined ? String(scVal.u128.lo) : null;
  }

  if (scVal.i64 !== undefined) return String(scVal.i64);
  if (scVal.u64 !== undefined) return String(scVal.u64);
  if (scVal.i32 !== undefined) return String(scVal.i32);
  if (scVal.u32 !== undefined) return String(scVal.u32);

  // json format says "string"; older/other encoders say "str" / "sym".
  if (scVal.string !== undefined) return scVal.string;
  if (scVal.symbol !== undefined) return scVal.symbol;
  if (scVal.str !== undefined) return scVal.str;
  if (scVal.sym !== undefined) return scVal.sym;

  return null;
}

/** Address string from a direct address ScVal, or the first address in a map. */
export function extractAccount(scVal) {
  if (!scVal || typeof scVal !== "object") return null;
  if (scVal.address !== undefined) return scVal.address;

  // json format map: [{ key, val }]
  if (Array.isArray(scVal.map)) {
    for (const e of scVal.map) {
      const v = e?.val ?? e?.value;
      if (v && v.address !== undefined) return v.address;
    }
  }

  // XDR-object style map: { obj: { entries: [...] } }
  if (scVal.obj) {
    for (const e of scVal.obj.entries ?? []) {
      const v = e?.val ?? e?.value;
      if (v && v.address !== undefined) return v.address;
    }
  }

  return null;
}

/** Symbol or string name of an event from its first topic. */
export function extractEventName(topic0) {
  if (!topic0 || typeof topic0 !== "object") return null;
  if (topic0.symbol !== undefined) return topic0.symbol;
  if (topic0.sym !== undefined) return topic0.sym;
  if (topic0.string !== undefined) return topic0.string;
  if (topic0.str !== undefined) return topic0.str;

  const vec = topic0.vec;
  if (Array.isArray(vec)) {
    const parts = vec
      .map((x) => x?.symbol ?? x?.sym ?? x?.string ?? x?.str ?? "")
      .filter(Boolean);
    if (parts.length) return parts.join(".");
  }
  return null;
}

/** True when an event name looks like a mint (case-insensitive substring). */
export function isMintLike(name) {
  return typeof name === "string" && name.toLowerCase().includes("mint");
}
