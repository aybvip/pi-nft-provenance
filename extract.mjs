/**
 * Pure extraction helpers for Soroban event values. No I/O.
 *
 * These decode the subset of ScVal shapes that mint / transfer events use.
 * Anything unrecognised returns null rather than guessing — a provenance tool
 * must never invent a field it did not read.
 */

/** Best-effort numeric/string identifier from an ScVal. Returns null if unknown. */
export function extractTokenIdFromScVal(scVal) {
  if (!scVal || typeof scVal !== "object") return null;
  if (scVal.i128) return scVal.i128.lo !== undefined ? String(scVal.i128.lo) : null;
  if (scVal.u128) return scVal.u128.lo !== undefined ? String(scVal.u128.lo) : null;
  if (scVal.i64 !== undefined) return String(scVal.i64);
  if (scVal.u64 !== undefined) return String(scVal.u64);
  if (scVal.i32 !== undefined) return String(scVal.i32);
  if (scVal.u32 !== undefined) return String(scVal.u32);
  if (scVal.str !== undefined) return scVal.str;
  if (scVal.sym !== undefined) return scVal.sym;
  return null;
}

/** Address string from a direct address ScVal, or the first address in an object. */
export function extractAccount(scVal) {
  if (!scVal || typeof scVal !== "object") return null;
  if (scVal.address !== undefined) return scVal.address;
  if (scVal.obj) {
    for (const e of scVal.obj.entries ?? []) {
      const v = e.val ?? e.value;
      if (v && v.address !== undefined) return v.address;
    }
  }
  return null;
}

/** Symbol or string name of an event from its first topic. */
export function extractEventName(topic0) {
  if (!topic0 || typeof topic0 !== "object") return null;
  if (topic0.sym !== undefined) return topic0.sym;
  if (topic0.str !== undefined) return topic0.str;
  if (topic0.vec) {
    const parts = topic0.vec.map((x) => x?.sym ?? x?.str ?? "").filter(Boolean);
    if (parts.length) return parts.join(".");
  }
  return null;
}

/** True when an event name looks like a mint (case-insensitive substring). */
export function isMintLike(name) {
  return typeof name === "string" && name.toLowerCase().includes("mint");
}
